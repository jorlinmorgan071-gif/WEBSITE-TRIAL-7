-- ============================================================================
-- LAKE FLAVOUR — migration 0001: catalogue tables (products, product_options)
-- ----------------------------------------------------------------------------
-- Run in the Supabase SQL editor (or psql). Idempotent: every statement is
-- safe to re-run — running this file twice changes nothing.
--
-- Access rules implemented here:
--   * anon / authenticated (public) can READ active products and options only.
--   * No public write access to anything.
--   * The service role (server-side code; bypasses RLS in Supabase) writes.
-- ============================================================================

-- gen_random_uuid() comes from pgcrypto (already enabled on Supabase projects).
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- products: one row per product shown in the "Get Your Fried Omena" section.
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,            -- stable id, e.g. "fried-omena"
  name        text not null,                   -- "Fried Omena"
  tagline     text not null default '',        -- "Fresh from Lake Victoria"
  description text not null default '',        -- full paragraph
  highlights  jsonb not null default '[]'::jsonb, -- ["Sourced from Lake Victoria", ...]
  images      jsonb not null default '[]'::jsonb, -- [{"src": "/images/...", "alt": "..."}]
  badge       text,                             -- "Best Seller" / "New", or null
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- product_options: the sizes buyers choose between (1 kg, 2 kg, ...).
--   stock_quantity NULL means "stock is not tracked" (always available).
--   Otherwise it is the number of units left and can never go below zero.
-- ---------------------------------------------------------------------------
create table if not exists public.product_options (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid not null references public.products (id) on delete cascade,
  option_key          text not null,              -- stable key, e.g. "1kg"
  label               text not null,              -- "1 kg"
  local_name          text not null default '',   -- "Half gorogoro"
  price_kes           integer not null check (price_kes >= 0),
  stock_quantity      integer,                    -- null = not tracked
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  is_active           boolean not null default true,
  unique (product_id, option_key),
  constraint product_options_stock_not_negative
    check (stock_quantity is null or stock_quantity >= 0)
);

create index if not exists product_options_product_idx on public.product_options (product_id);

-- ---------------------------------------------------------------------------
-- Row Level Security.
-- "create policy" has no IF NOT EXISTS, so policies are dropped and recreated
-- (same result — safe to re-run).
-- ---------------------------------------------------------------------------
alter table public.products        enable row level security;
alter table public.product_options enable row level security;

drop policy if exists "public read active products" on public.products;
create policy "public read active products"
  on public.products for select
  to anon, authenticated
  using (is_active);

drop policy if exists "public read active product options" on public.product_options;
create policy "public read active product options"
  on public.product_options for select
  to anon, authenticated
  using (is_active);

-- ---------------------------------------------------------------------------
-- Table-level grants.
-- Public roles: read-only on the catalogue. Orders tables (migration 0002)
-- get NO grants for public roles at all. No public role can write anything.
-- The service role needs no explicit grant for its own RPC calls because
-- create_order_v1 / set_order_status_v1 are SECURITY DEFINER functions —
-- this grant simply mirrors the standard Supabase setup for direct access.
-- ---------------------------------------------------------------------------
grant select on public.products, public.product_options to anon, authenticated;
grant select, insert, update, delete on public.products, public.product_options to service_role;
