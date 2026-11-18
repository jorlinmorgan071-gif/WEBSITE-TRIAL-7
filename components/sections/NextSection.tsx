/**
 * Dark placeholder section below the hero — target of the "Explore"
 * button and the surface the hero scroll-fade dissolves into.
 * Real content arrives in Steps 2-5.
 */
export default function NextSection() {
  return (
    <section
      id="next-section"
      className="relative flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-background px-6 py-24 text-center"
    >
      <h2 className="font-serif text-3xl font-semibold text-cream sm:text-4xl">
        Steps coming in Step 2
      </h2>
      <div className="gold-rule w-40" aria-hidden />
      <p className="max-w-md font-sans text-sm leading-relaxed text-muted">
        The story, product and ordering sections of Lake Flavour will be
        built here in the next steps.
      </p>
    </section>
  );
}
