# Lake Flavour — Website

Premium Fried Omena from Lake Victoria, Kenya. **Crisp. Golden. Straight from the lake.**
Dark + gold design system, Next.js 14 (App Router), TypeScript, Tailwind CSS 3.

- **Step 1** — design system, blur welcome intro, auto-advancing landing slides
- **Step 2** — floating cooking-steps viewer
- **Step 3** — product listing with WhatsApp quick-order
- **Step 4A** — online checkout (pay on delivery), orders with **atomic stock**, owner email notifications, owner orders dashboard (`/admin/orders`)
- Upcoming: **4B** full admin (stock management), **4C** ?, **4D** pay now with M-Pesa

---

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in your values (see below)
npm run db:start             # local test database (optional, see Testing)
npm run db:migrate           # apply supabase/migrations/*.sql
npm run dev                  # http://localhost:3000
```

Production: `npm run build && npm start`.

## Environment variables

Copy `.env.example` to `.env.local` and fill in. **`.env.local` is gitignored — never commit it.**

| Variable | Where used | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Public. Your Supabase **dev** project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Public. Enables magic-link sign-in. |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Bypasses RLS — used only in `lib/server/` (guarded by the `server-only` package). |
| `RESEND_API_KEY` | server only | Resend API key for notifications. |
| `RESEND_FROM` | server only | From address. Default `Lake Flavour <onboarding@resend.dev>`. |
| `RESEND_SEND_TO_CUSTOMERS` | server only | `true` ONLY after verifying a sending domain (allows emailing customers). Default: owner email only. |
| `RESEND_API_BASE_URL` | server only | Optional override of the Resend API base (tests point it at a local mock). |
| `OWNER_EMAIL` | server only | Receives every new-order notification. |
| `ADMIN_EMAILS` | server only | Comma-separated emails allowed to open `/admin` (magic link). |
| `NEXT_PUBLIC_SITE_URL` | client + server | Absolute site URL for email links / Open Graph. |
| `DATABASE_URL` | server only | Direct Postgres (local tests only; Supabase projects don't need it). |

## Database migrations

The SQL lives in `supabase/migrations/` (numbered, commented, idempotent — safe to re-run):

1. `0001_products_and_options.sql` — catalogue tables + RLS (public reads active rows only)
2. `0002_orders_order_items_order_events.sql` — order tables + RLS (**no public access at all**)
3. `0003_order_functions.sql` — `create_order_v1` (atomic stock + order number + idempotency) and `set_order_status_v1` (status transitions + stock restore on cancel), `EXECUTE` granted to `service_role` only
4. `0004_seed_catalogue.sql` — Fried Omena, 1 kg KES 400 / 2 kg KES 800, stock 50 each (owner edits stock in 4B)

**On Supabase:** open the SQL editor of your dev project and run the files in order. (Re-running `0004` resets prices/stock to the seed values.)

**Locally:** `npm run db:migrate` (applies to the embedded Postgres, see below).

## Owner dashboard

- `/admin/orders` — newest orders first, status flow `new → confirmed → out_for_delivery → delivered` or `cancelled` (cancel restores stock). Mobile friendly.
- Sign in at `/admin/login` with a **magic link**; only emails in `ADMIN_EMAILS` get in (enforced server-side on every request and in every server action).
- Every order placed emails `OWNER_EMAIL` (Resend). Email failures never lose an order — they are recorded in `order_events`.

## Testing

Local tests use an **embedded Postgres** (`embedded-postgres`, no Docker/root) as a real database, with Supabase-compatible roles (`anon`, `authenticated`, `service_role`) so RLS is tested exactly as PostgREST sees it. The app's server code has two thin transports over the same SQL: `@supabase/supabase-js` (your project) and `postgres.js` via `DATABASE_URL` (local tests). Tests also run a mock of the Supabase **auth** API (`scripts/mock-gotrue.mjs`) and a mock Resend endpoint so the real code paths run end to end.

```bash
npm run db:start        # boot the local database (127.0.0.1:5333)
npm run db:migrate       # apply migrations (idempotent — run twice to prove it)
npm run db:stop

npm run test:unit        # pure helpers: phones, delivery areas, statuses, messages
npm run test:rls        # anon/authenticated cannot read orders, cannot write anything
npm run test:orders     # POST /api/orders: validation, phones, happy path, stock,
                        # idempotency, concurrency (3 left, 5 orders → exactly 3), rate limit, honeypot
npm run test:emails     # owner email, customer email policy, email-down never loses an order
npm run test:admin      # auth blocked/allowed, status changes, cancel restores stock
npm run test:catalogue  # database source + lib/products.ts fallback when the DB is down
node scripts/test-regression.mjs   # Steps 1–3 landing regression + headers/OG/privacy
```

All E2E suites require `npm run build` first (they run `next start` themselves).
Test values live in `.env.local` (gitignored); the ones in the repo during development are localhost-only mocks, never real secrets.

## Project structure

```
app/                    # pages + API route (App Router)
  api/orders/route.ts   # POST — zod validation, honeypot, rate limit, atomic create
  admin/…               # owner dashboard + magic-link login + server actions
  privacy/page.tsx      # Privacy Notice (draft — owner to review)
components/             # UI (checkout components in components/checkout)
lib/                    # shared pure code (products, order helpers, phone, delivery…)
lib/server/             # SERVER-ONLY: db transports, env, email, admin auth, schema
supabase/migrations/    # the four SQL files (the source of truth for data)
scripts/                # local test database, migrations, test suites
```

## Notes

- **Money is integers** (KES) everywhere — no floats.
- Prices are re-read inside `create_order_v1`; the client cannot send or change a price.
- The checkout is a lazy client chunk — it loads only when the visitor approaches the section (initial landing bundle stays light; Lighthouse mobile 90+).
- The rate limit is in-memory per instance (5 orders / IP / 10 min) — fine for a single-instance deployment; move to Redis when scaling.
- CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy and HSTS are set in `next.config.mjs`.
