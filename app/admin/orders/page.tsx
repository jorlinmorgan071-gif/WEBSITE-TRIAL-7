import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getAdminAuth } from "@/lib/server/admin-auth";
import { listRecentOrders } from "@/lib/server/orders";
import type { DbOrder } from "@/lib/server/db";
import OrderCard from "@/components/admin/OrderCard";
import SignOutButton from "@/components/admin/SignOutButton";

/**
 * STEP 4A — owner orders dashboard (minimal; the full admin comes in 4B).
 *
 * AUTH IS ENFORCED HERE ON THE SERVER for every request:
 *   - no session            → redirect to /admin/login (no data rendered)
 *   - session, not an admin → 404 (no hint that the page exists)
 *   - admin (ADMIN_EMAILS)  → newest orders first
 * Each server action re-checks admin access itself (see actions.ts).
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Orders",
  robots: { index: false, follow: false },
};

export default async function AdminOrdersPage() {
  const auth = await getAdminAuth();
  if (auth.kind === "unconfigured" || auth.kind === "no-session") {
    redirect("/admin/login");
  }
  if (auth.kind === "forbidden") {
    notFound();
  }

  let orders: DbOrder[] = [];
  let dbError = false;
  try {
    orders = await listRecentOrders(50);
  } catch (error) {
    dbError = true;
    console.error(
      "[admin] could not load orders:",
      error instanceof Error ? error.message : error
    );
  }

  return (
    <main className="relative min-h-dvh w-full bg-background px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
              Lake Flavour
            </p>
            <h1 className="mt-1 font-serif text-3xl font-semibold text-cream sm:text-4xl">
              Orders
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden font-sans text-xs text-muted sm:inline">
              {auth.email}
            </span>
            <SignOutButton />
          </div>
        </header>

        {dbError ? (
          <div
            role="alert"
            className="rounded-2xl border border-gold-light/50 bg-gold/10 px-5 py-4 font-sans text-sm text-gold-light"
          >
            We could not load orders from the database. Please refresh in a
            moment — new orders are still being saved safely.
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-cream/10 bg-surface/40 px-5 py-10 text-center font-sans text-sm text-muted">
            No orders yet. When a customer places an order on the website it
            appears here instantly.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}

        <p className="text-center font-sans text-xs text-muted">
          Status flow: New → Confirmed → Out for delivery → Delivered, or
          Cancelled (which returns the stock).
        </p>
      </div>
    </main>
  );
}
