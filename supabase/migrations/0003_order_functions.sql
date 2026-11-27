-- ============================================================================
-- LAKE FLAVOUR — migration 0003: order functions (atomic checkout)
-- ----------------------------------------------------------------------------
-- Idempotent: create-or-replace for functions, drop-and-recreate for policies.
--
-- SECURITY MODEL
--   * create_order_v1 / set_order_status_v1 are SECURITY DEFINER functions:
--     they run with the privileges of their owner (postgres, i.e. the role
--     the SQL editor uses), so they can write the RLS-protected order tables.
--   * EXECUTE is revoked from public / anon / authenticated and granted to
--     service_role only — the public can never call them directly.
--   * All stock checks, stock decrements and order writes happen inside ONE
--     transaction inside create_order_v1: two simultaneous orders can never
--     both take the last unit, and an insufficient-stock order creates
--     NOTHING.
--
-- CONCURRENCY SAFETY
--   * Option rows are locked (SELECT ... FOR UPDATE) in a deterministic order
--     (sorted by option id) — no deadlocks between concurrent orders.
--   * Order numbers come from a per-day counter row locked by the same
--     upsert statement (no duplicates under concurrency).
--   * The idempotency key is reserved inside the same transaction as the
--     order: a retry with the same key returns the original order and never
--     creates a second one.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Per-day order-number counter (LF-YYYYMMDD-0001).
-- The upsert locks the day's row, so concurrent transactions serialize on it.
-- ---------------------------------------------------------------------------
create table if not exists public.order_number_counters (
  order_date  date primary key,
  last_number integer not null default 0
);

-- Maps an idempotency key (from the website form) to the order it created.
-- order_id is set at the end of create_order_v1, inside the same transaction.
create table if not exists public.order_idempotency (
  key        text primary key,
  order_id   uuid references public.orders (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.order_number_counters enable row level security;
alter table public.order_idempotency      enable row level security;
grant select, insert, update, delete
  on public.order_number_counters, public.order_idempotency to service_role;

-- ---------------------------------------------------------------------------
-- next_order_number(): LF-YYYYMMDD-0001. Must be called inside the caller's
-- transaction — if that transaction rolls back, the number is freed again.
-- current_date uses the database timezone (UTC on hosted Supabase); numbers
-- remain unique and sequential either way.
-- ---------------------------------------------------------------------------
create or replace function public.next_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number integer;
  v_day    date := current_date;
begin
  insert into public.order_number_counters (order_date, last_number)
       values (v_day, 1)
  on conflict (order_date)
  do update set last_number = public.order_number_counters.last_number + 1
  returning last_number into v_number;

  return 'LF-' || to_char(v_day, 'YYYYMMDD') || '-' || lpad(v_number::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- order_snapshot_v1(order_id): the full order (customer, items, totals) as
-- jsonb — used by create_order_v1, set_order_status_v1 and idempotent retries.
-- ---------------------------------------------------------------------------
create or replace function public.order_snapshot_v1(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id',                o.id,
    'order_number',      o.order_number,
    'status',            o.status,
    'customer_name',     o.customer_name,
    'phone',             o.phone,
    'email',             o.email,
    'area',              o.area,
    'address_details',   o.address_details,
    'notes',             o.notes,
    'payment_method',    o.payment_method,
    'payment_status',    o.payment_status,
    'subtotal_kes',      o.subtotal_kes,
    'delivery_fee_kes',  o.delivery_fee_kes,
    'total_kes',         o.total_kes,
    'created_at',        o.created_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'product_name',   oi.product_name,
               'option_label',   oi.option_label,
               'unit_price_kes', oi.unit_price_kes,
               'quantity',       oi.quantity,
               'line_total_kes', oi.line_total_kes
             ) order by oi.unit_price_kes, oi.product_name)
        from public.order_items oi
       where oi.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.id = p_order_id;
$$;

-- ---------------------------------------------------------------------------
-- create_order_v1(p_payload jsonb): the ONLY public way an order is created.
--
-- p_payload = {
--   "customer": {
--     "name": string, "phone": string (254XXXXXXXXX), "email": string|null,
--     "area": string, "address_details": string,
--     "notes": string|null, "consent_given": true,
--     "payment_method": "pay_on_delivery"
--   },
--   "items": [ { "option_id": uuid, "quantity": 1..10 }, ... ],
--   "delivery_fee_kes": integer|null,   -- null while fees are confirmed on contact
--   "idempotency_key": string|null
-- }
--
-- IMPORTANT: prices, product names and option labels are re-read from the
-- database inside this function. Any prices coming from the client are
-- ignored — price tampering is impossible by design.
--
-- Returns jsonb:
--   { "ok": true, "idempotent": bool, "order": {...snapshot...} }
--   { "ok": false, "code": "...", "message": "...", "option_label": ...,
--     "available": n }
-- ---------------------------------------------------------------------------
create or replace function public.create_order_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer     jsonb;
  v_items        jsonb;
  v_key          text;
  v_item         jsonb;
  v_opt          record;
  v_qty          integer;
  v_reserved     integer;
  v_line_total   integer;
  v_subtotal     integer := 0;
  v_order_id     uuid;
  v_order_number text;
  v_existing_id  uuid;
  v_lines        jsonb := '[]'::jsonb;
begin
  v_customer := p_payload -> 'customer';
  v_items    := p_payload -> 'items';
  v_key      := nullif(p_payload ->> 'idempotency_key', '');

  -- ---- 1. Idempotency: a retry returns the order created before --------- --
  if v_key is not null then
    select i.order_id into v_existing_id
      from public.order_idempotency i
     where i.key = v_key
       and i.order_id is not null;

    if v_existing_id is not null then
      return jsonb_build_object('ok', true, 'idempotent', true,
                                'order', public.order_snapshot_v1(v_existing_id));
    end if;
  end if;

  -- ---- 2. Defence-in-depth validation (the app server validates first) -- --
  if v_customer is null
     or v_customer ->> 'consent_given' is distinct from 'true' then
    return jsonb_build_object('ok', false, 'code', 'validation_failed',
      'message', 'Consent to the Privacy Notice is required.');
  end if;

  if v_customer ->> 'payment_method' not in ('pay_on_delivery', 'mpesa_pay_now') then
    return jsonb_build_object('ok', false, 'code', 'validation_failed',
      'message', 'Unknown payment method.');
  end if;

  if v_items is null
     or jsonb_typeof(v_items) is distinct from 'array'
     or (select count(*) from jsonb_array_elements(v_items)) not between 1 and 10 then
    return jsonb_build_object('ok', false, 'code', 'validation_failed',
      'message', 'Items must contain between 1 and 10 lines.');
  end if;

  -- Customer shape checks (lengths and phone format mirror the app schema).
  if length(coalesce(v_customer ->> 'name', '')) not between 2 and 80
     or coalesce(v_customer ->> 'phone', '') !~ '^254[17][0-9]{8}$'
     or length(coalesce(v_customer ->> 'area', '')) not between 2 and 60
     or length(coalesce(v_customer ->> 'address_details', '')) not between 4 and 200
     or length(coalesce(v_customer ->> 'notes', '')) > 300
     or (v_customer ->> 'email' is not null
         and (length(v_customer ->> 'email') > 120
              or v_customer ->> 'email' !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')) then
    return jsonb_build_object('ok', false, 'code', 'validation_failed',
      'message', 'Customer details failed validation.');
  end if;

  -- ---- 3. Validate every item BEFORE touching any stock ----------------- --
  -- (v_item is a scalar jsonb: the loop assigns the single column e.value.)
  for v_item in
    select e.value
      from jsonb_array_elements(v_items) e
     order by (e.value ->> 'option_id')   -- deterministic lock order: no deadlocks
  loop
    -- option_id must be a uuid and quantity a whole number between 1 and 10
    -- (regex first — casting unvalidated text could raise instead of returning).
    if v_item ->> 'option_id' is null
       or v_item ->> 'option_id'
            !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       or v_item ->> 'quantity' !~ '^[0-9]+$'
       or (v_item ->> 'quantity')::int not between 1 and 10 then
      return jsonb_build_object('ok', false, 'code', 'validation_failed',
        'message', 'Each item needs an option id and a quantity between 1 and 10.');
    end if;

    -- Lock the option row (FOR UPDATE) and re-read price, name and stock.
    -- Prices/names come from the database — never from the client payload.
    select po.id, po.price_kes, po.stock_quantity, po.label,
           po.local_name, po.is_active,
           p.id as product_id, p.name as product_name, p.is_active as product_is_active
      into v_opt
      from public.product_options po
      join public.products p on p.id = po.product_id
     where po.id = (v_item ->> 'option_id')::uuid
       for update of po;

    if not found then
      return jsonb_build_object('ok', false, 'code', 'unknown_option',
        'message', 'That size is not available.');
    end if;

    if not v_opt.is_active or not v_opt.product_is_active then
      return jsonb_build_object('ok', false, 'code', 'inactive_option',
        'message', 'That size is not available right now.',
        'option_label', v_opt.label);
    end if;

    v_qty := (v_item ->> 'quantity')::int;

    -- Stock check (a null stock_quantity means "not tracked" = always fine).
    if v_opt.stock_quantity is not null then
      -- Count how much of this option earlier lines in THIS order already took.
      select coalesce(sum((l ->> 'quantity')::int), 0) into v_reserved
        from jsonb_array_elements(v_lines) l
       where l ->> 'option_id' = v_opt.id::text;

      if v_reserved + v_qty > v_opt.stock_quantity then
        return jsonb_build_object('ok', false, 'code', 'insufficient_stock',
          'message', 'Not enough stock for that size.',
          'option_label', v_opt.label,
          'available', greatest(v_opt.stock_quantity - v_reserved, 0));
      end if;
    end if;

    v_line_total := v_opt.price_kes * v_qty;
    v_subtotal   := v_subtotal + v_line_total;
    v_lines      := v_lines || jsonb_build_object(
      'option_id',     v_opt.id,
      'product_id',    v_opt.product_id,
      'product_name',  v_opt.product_name,
      'option_label',  v_opt.label,
      'unit_price_kes', v_opt.price_kes,
      'quantity',      v_qty,
      'line_total_kes', v_line_total);
  end loop;

  -- ---- 4. Reserve the idempotency key (inside this transaction) ---------- --
  if v_key is not null then
    insert into public.order_idempotency (key, order_id)
         values (v_key, null)
    on conflict (key) do nothing;

    if not found then
      -- Another transaction used this key. If it already committed an order,
      -- return it (idempotent retry). If it is still in flight, tell the
      -- caller to try again — nothing is created either way.
      select i.order_id into v_existing_id
        from public.order_idempotency i
       where i.key = v_key;

      if v_existing_id is not null then
        return jsonb_build_object('ok', true, 'idempotent', true,
                                  'order', public.order_snapshot_v1(v_existing_id));
      end if;

      return jsonb_build_object('ok', false, 'code', 'duplicate_in_progress',
        'message', 'This order is already being placed — please wait a moment.');
    end if;
  end if;

  -- ---- 5. Create the order (all checks passed — writes can now happen) -- --
  v_order_number := public.next_order_number();

  insert into public.orders (
    order_number, status, customer_name, phone, email, area, address_details,
    notes, payment_method, payment_status, subtotal_kes, delivery_fee_kes,
    total_kes, consent_given
  ) values (
    v_order_number, 'new',
    v_customer ->> 'name',
    v_customer ->> 'phone',
    nullif(v_customer ->> 'email', ''),
    v_customer ->> 'area',
    v_customer ->> 'address_details',
    nullif(v_customer ->> 'notes', ''),
    v_customer ->> 'payment_method',
    'unpaid',
    v_subtotal,
    case when p_payload ? 'delivery_fee_kes'
         then (p_payload ->> 'delivery_fee_kes')::integer
         else null end,
    case when p_payload ? 'delivery_fee_kes'
         then v_subtotal + (p_payload ->> 'delivery_fee_kes')::integer
         else null end,
    true
  )
  returning id into v_order_id;

  -- Order items (snapshot of names and prices) + stock decrement per line.
  -- (v_item is a scalar jsonb, same as the validation loop above.)
  for v_item in select e.value from jsonb_array_elements(v_lines) e
  loop
    insert into public.order_items (
      order_id, product_id, option_id, product_name, option_label,
      unit_price_kes, quantity, line_total_kes
    ) values (
      v_order_id,
      (v_item ->> 'product_id')::uuid,
      (v_item ->> 'option_id')::uuid,
      v_item ->> 'product_name',
      v_item ->> 'option_label',
      (v_item ->> 'unit_price_kes')::int,
      (v_item ->> 'quantity')::int,
      (v_item ->> 'line_total_kes')::int
    );

    update public.product_options
       set stock_quantity = stock_quantity - (v_item ->> 'quantity')::int
     where id = (v_item ->> 'option_id')::uuid
       and stock_quantity is not null;   -- untracked stock stays untracked
  end loop;

  insert into public.order_events (order_id, type, note)
       values (v_order_id, 'created', 'Order placed on the website.');

  -- Attach the idempotency key to the new order (same transaction).
  if v_key is not null then
    update public.order_idempotency
       set order_id = v_order_id
     where key = v_key;
  end if;

  return jsonb_build_object('ok', true, 'idempotent', false,
                            'order', public.order_snapshot_v1(v_order_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- set_order_status_v1(order_id, new_status, note): owner status changes.
--   Allowed: new -> confirmed -> out_for_delivery -> delivered
--            new / confirmed / out_for_delivery -> cancelled
--   Cancelling RESTORES the stock of every line (tracked stock only).
--   Every change appends an order_events row.
-- ---------------------------------------------------------------------------
create or replace function public.set_order_status_v1(
  p_order_id   uuid,
  p_new_status text,
  p_note       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
  v_allowed boolean;
begin
  if p_new_status not in ('confirmed', 'out_for_delivery', 'delivered', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', 'validation_failed',
      'message', 'Unknown status.');
  end if;

  select status into v_current
    from public.orders
   where id = p_order_id
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'unknown_order',
      'message', 'Order not found.');
  end if;

  v_allowed := case v_current
    when 'new'             then p_new_status in ('confirmed', 'cancelled')
    when 'confirmed'        then p_new_status in ('out_for_delivery', 'cancelled')
    when 'out_for_delivery' then p_new_status in ('delivered', 'cancelled')
    else false   -- delivered and cancelled are final
  end;

  if not v_allowed then
    return jsonb_build_object('ok', false, 'code', 'invalid_transition',
      'message', 'Cannot change status from ' || v_current || ' to ' || p_new_status || '.',
      'from', v_current, 'to', p_new_status);
  end if;

  if p_new_status = 'cancelled' then
    -- Give the stock back (options with untracked stock stay untracked).
    update public.product_options po
       set stock_quantity = po.stock_quantity + oi.quantity
      from public.order_items oi
     where oi.order_id = p_order_id
       and oi.option_id = po.id
       and po.stock_quantity is not null;
  end if;

  update public.orders
     set status = p_new_status
   where id = p_order_id;

  insert into public.order_events (order_id, type, note)
       values (p_order_id, 'status_changed',
               v_current || ' -> ' || p_new_status
               || case when nullif(p_note, '') is not null
                       then ' — ' || p_note else '' end);

  return jsonb_build_object('ok', true, 'order', public.order_snapshot_v1(p_order_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: public roles can NEVER call the order functions.
-- ---------------------------------------------------------------------------
revoke execute on function public.create_order_v1(jsonb)                        from public, anon, authenticated;
revoke execute on function public.set_order_status_v1(uuid, text, text)         from public, anon, authenticated;
revoke execute on function public.next_order_number()                           from public, anon, authenticated;
revoke execute on function public.order_snapshot_v1(uuid)                       from public, anon, authenticated;

grant execute on function public.create_order_v1(jsonb)                to service_role;
grant execute on function public.set_order_status_v1(uuid, text, text) to service_role;
