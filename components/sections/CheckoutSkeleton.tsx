/**
 * STEP 4A — loading placeholder for the lazily-loaded checkout section.
 * Renders immediately (server-side) at the #order anchor so the "Order
 * online" button always has a target, while the real checkout code stays out
 * of the initial JavaScript bundle. The soft pulse respects reduced-motion.
 */
export default function CheckoutSkeleton() {
  return (
    <section
      id="order"
      aria-label="Place your order"
      className="relative flex min-h-[70vh] w-full flex-col items-center justify-center bg-background px-4 py-24 text-center sm:px-6"
    >
      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
        Order Online
      </p>
      <h2 className="mt-4 font-serif text-3xl font-semibold text-cream sm:text-4xl">
        Place Your Order
      </h2>
      <div className="gold-rule mt-4 w-40" aria-hidden />
      <div className="mt-10 flex w-full max-w-5xl flex-col gap-6 lg:flex-row">
        <div
          aria-hidden
          className="h-72 flex-1 rounded-2xl border border-gold/20 bg-surface/40 motion-safe:animate-pulse"
        />
        <div
          aria-hidden
          className="h-72 flex-1 rounded-2xl border border-cream/10 bg-surface/20 motion-safe:animate-pulse"
        />
      </div>
      <noscript>
        <p className="mt-8 max-w-md font-sans text-sm leading-relaxed text-muted">
          Online ordering needs JavaScript. You can still order on WhatsApp —
          scroll up and tap “Order on WhatsApp” to send your order instantly.
        </p>
      </noscript>
    </section>
  );
}
