/**
 * Small placeholder under the products section — the scroll target of
 * the "Order online" button. Online ordering and payment arrive in Step 4.
 */
export default function OrderPlaceholder() {
  return (
    <section
      id="order"
      className="relative flex min-h-[60vh] w-full flex-col items-center justify-center gap-6 bg-background px-6 py-24 text-center"
    >
      <h2 className="font-serif text-3xl font-semibold text-cream sm:text-4xl">
        Online ordering and payment arrive in Step 4
      </h2>
      <div className="gold-rule w-40" aria-hidden />
      <p className="max-w-md font-sans text-sm leading-relaxed text-muted">
        In the meantime, order on WhatsApp — the button above opens a chat
        with your order message ready to send.
      </p>
    </section>
  );
}
