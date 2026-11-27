import "server-only";

/**
 * STEP 4A — database access layer.
 *
 * ONE source of truth: the SQL schema and functions in supabase/migrations.
 * Two thin transports call the exact same SQL:
 *
 *   1. @supabase/supabase-js with the SERVICE ROLE key — used when the app
 *      runs against a Supabase project (production). The service role key is
 *      only ever used in this server-only module.
 *   2. postgres.js with DATABASE_URL — used for local development and tests
 *      against a direct Postgres connection.
 *
 * All order writes go through create_order_v1 / set_order_status_v1 (the
 * SECURITY DEFINER functions in migration 0003), so the transactional
 * guarantees (atomic stock, order numbers, idempotency) are identical on both
 * transports.
 */

import postgres from "postgres";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "./env";

// ---------------------------------------------------------------------------
// Row types (snake_case, as in the database)
// ---------------------------------------------------------------------------

export interface DbProductOption {
  id: string;
  option_key: string;
  label: string;
  local_name: string;
  price_kes: number;
  stock_quantity: number | null;
  low_stock_threshold: number;
  is_active: boolean;
}

export interface DbProduct {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  highlights: string[];
  images: { src: string; alt: string }[];
  badge: string | null;
  is_active: boolean;
  options: DbProductOption[];
}

export interface DbOrderItem {
  product_name: string;
  option_label: string;
  unit_price_kes: number;
  quantity: number;
  line_total_kes: number;
}

export interface DbOrder {
  id: string;
  order_number: string;
  status: string;
  customer_name: string;
  phone: string;
  email: string | null;
  area: string;
  address_details: string;
  notes: string | null;
  payment_method: string;
  payment_status: string;
  subtotal_kes: number;
  delivery_fee_kes: number | null;
  total_kes: number | null;
  consent_given: boolean;
  created_at: string;
  items: DbOrderItem[];
}

/** Payload accepted by create_order_v1 (snake_case on purpose — SQL world). */
export interface CreateOrderPayload {
  customer: {
    name: string;
    phone: string;
    email: string;
    area: string;
    address_details: string;
    notes: string | null;
    consent_given: boolean;
    payment_method: string;
  };
  items: { option_id: string; quantity: number }[];
  delivery_fee_kes: number | null;
  idempotency_key: string | null;
}

export type CreateOrderOutcome =
  | { ok: true; idempotent: boolean; order: DbOrder }
  | {
      ok: false;
      code:
        | "validation_failed"
        | "unknown_option"
        | "inactive_option"
        | "insufficient_stock"
        | "duplicate_in_progress"
        | string;
      message?: string;
      option_label?: string;
      available?: number;
    };

export type SetOrderStatusOutcome =
  | { ok: true; order: DbOrder }
  | { ok: false; code: string; message?: string; from?: string; to?: string };

// ---------------------------------------------------------------------------
// Driver interface — everything above this line is shared
// ---------------------------------------------------------------------------

export interface DbDriver {
  getActiveProducts(): Promise<DbProduct[]>;
  createOrder(payload: CreateOrderPayload): Promise<CreateOrderOutcome>;
  listRecentOrders(limit: number): Promise<DbOrder[]>;
  setOrderStatus(
    orderId: string,
    newStatus: string,
    note: string | null
  ): Promise<SetOrderStatusOutcome>;
  insertOrderEvent(
    orderId: string,
    type: string,
    note: string | null
  ): Promise<void>;
}

// ---------------------------------------------------------------------------
// Transport 1: Supabase (hosted project), service role key
// ---------------------------------------------------------------------------

let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdmin) return supabaseAdmin;
  const env = getServerEnv();
  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    throw new Error("Supabase is not configured (need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).");
  }
  supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    // A hard timeout keeps page rendering and order placement from hanging
    // when the database is unreachable (the catalogue then falls back).
    global: {
      fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(8000) }),
    },
  });
  return supabaseAdmin;
}

function sortOptions(options: DbProductOption[]): DbProductOption[] {
  return [...options].sort((a, b) => a.price_kes - b.price_kes);
}

const supabaseDriver: DbDriver = {
  async getActiveProducts() {
    const { data, error } = await getSupabaseAdmin()
      .from("products")
      .select("*, product_options(*)")
      .eq("is_active", true)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => {
      const { product_options, ...product } = p;
      return { ...product, options: sortOptions(product_options ?? []) };
    });
  },

  async createOrder(payload) {
    const { data, error } = await getSupabaseAdmin().rpc("create_order_v1", {
      p_payload: payload,
    });
    if (error) throw new Error(error.message);
    return data as CreateOrderOutcome;
  },

  async listRecentOrders(limit) {
    const { data, error } = await getSupabaseAdmin()
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map((o) => {
      const { order_items, ...order } = o;
      return { ...order, items: sortItems(order_items ?? []) } as DbOrder;
    });
  },

  async setOrderStatus(orderId, newStatus, note) {
    const { data, error } = await getSupabaseAdmin().rpc("set_order_status_v1", {
      p_order_id: orderId,
      p_new_status: newStatus,
      p_note: note,
    });
    if (error) throw new Error(error.message);
    return data as SetOrderStatusOutcome;
  },

  async insertOrderEvent(orderId, type, note) {
    const { error } = await getSupabaseAdmin()
      .from("order_events")
      .insert({ order_id: orderId, type, note });
    if (error) throw new Error(error.message);
  },
};

function sortItems(items: DbOrderItem[]): DbOrderItem[] {
  return [...items].sort((a, b) => a.unit_price_kes - b.unit_price_kes);
}

// ---------------------------------------------------------------------------
// Transport 2: direct Postgres via postgres.js (local dev/tests)
// ---------------------------------------------------------------------------

type Sql = ReturnType<typeof postgres>;
let sqlSingleton: Sql | null = null;

function getSql(): Sql {
  if (sqlSingleton) return sqlSingleton;
  const env = getServerEnv();
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }
  sqlSingleton = postgres(env.databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 3,
  });
  return sqlSingleton;
}

const postgresDriver: DbDriver = {
  async getActiveProducts() {
    const sqlDb = getSql();
    const rows = (await sqlDb`
      select p.id, p.slug, p.name, p.tagline, p.description,
             p.highlights, p.images, p.badge, p.is_active,
             coalesce(json_agg(
               json_build_object(
                 'id', o.id, 'option_key', o.option_key, 'label', o.label,
                 'local_name', o.local_name, 'price_kes', o.price_kes,
                 'stock_quantity', o.stock_quantity,
                 'low_stock_threshold', o.low_stock_threshold,
                 'is_active', o.is_active
               ) order by o.price_kes asc
             ) filter (where o.id is not null), '[]'::json) as options
        from public.products p
        left join public.product_options o
               on o.product_id = p.id and o.is_active
       where p.is_active
       group by p.id
       order by p.created_at asc`) as unknown as DbProduct[];
    return rows.map((r) => ({ ...r, options: sortOptions(r.options) }));
  },

  async createOrder(payload) {
    const sqlDb = getSql();
    // sql.json() serialises the payload as a json parameter (postgres.js
    // stringifies plain strings in a json/jsonb cast context, which would
    // double-encode it). The database function re-reads prices and stock
    // inside the transaction.
    const rows = (await sqlDb`
      select public.create_order_v1(${sqlDb.json(payload)}::jsonb) as result`) as unknown as {
      result: CreateOrderOutcome;
    }[];
    return rows[0].result;
  },

  async listRecentOrders(limit) {
    const sqlDb = getSql();
    const rows = (await sqlDb`
      select o.id, o.order_number, o.status, o.customer_name, o.phone, o.email,
             o.area, o.address_details, o.notes, o.payment_method,
             o.payment_status, o.subtotal_kes, o.delivery_fee_kes, o.total_kes,
             o.consent_given, o.created_at,
             coalesce(json_agg(
               json_build_object(
                 'product_name', i.product_name, 'option_label', i.option_label,
                 'unit_price_kes', i.unit_price_kes, 'quantity', i.quantity,
                 'line_total_kes', i.line_total_kes
               ) order by i.unit_price_kes asc
             ) filter (where i.id is not null), '[]'::json) as items
        from public.orders o
        left join public.order_items i on i.order_id = o.id
       group by o.id
       order by o.created_at desc
       limit ${limit}`) as unknown as DbOrder[];
    return rows.map((r) => ({ ...r, items: sortItems(r.items) }));
  },

  async setOrderStatus(orderId, newStatus, note) {
    const sqlDb = getSql();
    const rows = (await sqlDb`
      select public.set_order_status_v1(
        ${orderId}::uuid, ${newStatus}, ${note}
      ) as result`) as unknown as { result: SetOrderStatusOutcome }[];
    return rows[0].result;
  },

  async insertOrderEvent(orderId, type, note) {
    await getSql()`
      insert into public.order_events (order_id, type, note)
      values (${orderId}::uuid, ${type}, ${note})`;
  },
};

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function getDb(): DbDriver {
  const env = getServerEnv();
  if (env.databaseUrl) return postgresDriver;
  if (env.supabaseUrl && env.supabaseServiceKey) return supabaseDriver;
  throw new Error(
    "No database configured: set DATABASE_URL (direct Postgres) or " +
      "NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (Supabase)."
  );
}

/** True when a database is configured at all (used by the fallback tests). */
export function isDbConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.databaseUrl || (env.supabaseUrl && env.supabaseServiceKey));
}
