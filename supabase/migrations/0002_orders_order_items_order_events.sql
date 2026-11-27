-- ============================================================================
-- LAKE FLAVOUR — migration 0002: order tables (orders, order_items, order_events)
-- ----------------------------------------------------------------------------
-- Idempotent: every statement is safe to re-run.
--
-- Access rules:
--   * RLS is enabled on ALL three tables and NO policies are created for
--     anon / authenticated — the public can neither read nor write them.
--     No grants for public roles either: even without policies, anon has no
--     table-level permission.
--   * Orders are written ONLY by the server, through create_order_v1() and
--     set_order_status_v1() (migration 0003) which are SECURITY DEFINER
--     functions, called with the service role.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- orders: one row per placed order.
--   order_number   human-readable, unique, e.g. LF-20261127-0001.
--   status         new -> confirmed -> out_for_delivery -> delivered
--                  (or cancelled; transitions enforced in set_order_status_v1).
--   phone          normalised Kenyan format 254XXXXXXXXX.
--   delivery_fee_kes / total_kes  NULL while the delivery fee is confirmed
--                  with the customer ("confirmed when we contact you").
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  order_number      text not null unique,
  status            text not null default 'new'
                      check (status in ('new', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled')),
  customer_name     text not null,
  phone             text not null,
  email             text,
  area              text not null,
  address_details   text not null default '',
  notes             text,
  payment_method    text not null default 'pay_on_delivery'
                      check (payment_method in ('pay_on_delivery', 'mpesa_pay_now')),
  payment_status    text not null default 'unpaid'
                      check (payment_status in ('unpaid', 'paid_on_delivery', 'paid_online', 'refunded')),
  subtotal_kes      integer not null check (subtotal_kes >= 0),
  delivery_fee_kes  integer check (delivery_fee_kes is null or delivery_fee_kes >= 0),
  total_kes         integer check (total_kes is null or total_kes >= 0),
  consent_given     boolean not null default false,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- order_items: one row per line. Product name, option label and unit price are
-- SNAPSHOTTED at order time so later catalogue edits never change past orders.
-- ---------------------------------------------------------------------------
create table if not exists public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete cascade,
  product_id     uuid references public.products (id),
  option_id      uuid references public.product_options (id),
  product_name   text not null,
  option_label   text not null,
  unit_price_kes integer not null check (unit_price_kes >= 0),
  quantity       integer not null check (quantity between 1 and 10),
  line_total_kes integer not null check (line_total_kes >= 0)
);

-- ---------------------------------------------------------------------------
-- order_events: append-only audit trail (created, status_changed,
-- notification_failed, notification_skipped, ...).
-- ---------------------------------------------------------------------------
create table if not exists public.order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  type       text not null,
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx     on public.orders (created_at desc);
create index if not exists order_items_order_idx     on public.order_items (order_id);
create index if not exists order_events_order_idx    on public.order_events (order_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: enabled with NO policies and NO grants for public roles.
-- anon / authenticated can neither read nor write order data. The service role
-- accesses orders through the SECURITY DEFINER functions in migration 0003.
-- ---------------------------------------------------------------------------
alter table public.orders       enable row level security;
alter table public.order_items  enable row level security;
alter table public.order_events enable row level security;

grant select, insert, update, delete
  on public.orders, public.order_items, public.order_events to service_role;
