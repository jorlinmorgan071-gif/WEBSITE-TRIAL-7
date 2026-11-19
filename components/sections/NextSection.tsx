/**
 * Small placeholder under the cooking-steps section — target of the
 * page's continued scroll. The product grid arrives in Step 3.
 */
export default function NextSection() {
  return (
    <section
      id="next-section"
      className="relative flex min-h-[60vh] w-full flex-col items-center justify-center gap-6 bg-background px-6 py-24 text-center"
    >
      <h2 className="font-serif text-3xl font-semibold text-cream sm:text-4xl">
        Products coming in Step 3
      </h2>
      <div className="gold-rule w-40" aria-hidden />
      <p className="max-w-md font-sans text-sm leading-relaxed text-muted">
        The Lake Flavour product range and ordering details will be built
        here in the next step.
      </p>
    </section>
  );
}
