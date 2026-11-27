import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS } from "@/lib/business";

/**
 * STEP 4A — Privacy Notice.
 * Explains plainly what the checkout collects, why, who sees it and how to
 * ask for deletion. DRAFT until the owner reviews it.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy Notice",
  description:
    "What Lake Flavour collects when you order, why we collect it, who sees it, and how to ask us to delete it.",
};

export default function PrivacyPage() {
  // Owner contact comes from the environment (OWNER_EMAIL) so it stays
  // correct without editing this page.
  const ownerEmail = process.env.OWNER_EMAIL?.trim() || null;

  return (
    <main className="relative w-full bg-background px-4 py-16 sm:px-6 sm:py-24">
      <article className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <header className="flex flex-col items-center gap-4 text-center">
          <span className="inline-flex items-center rounded-full border border-gold/40 bg-gold/10 px-3 py-1 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-light">
            Draft — owner to review
          </span>
          <h1 className="font-serif text-3xl font-semibold text-cream sm:text-4xl md:text-5xl">
            Privacy Notice
          </h1>
          <div className="gold-rule w-40" aria-hidden />
          <p className="max-w-xl font-sans text-sm leading-relaxed text-muted sm:text-base">
            {BUSINESS.name} keeps this notice short and honest. It explains what
            we collect when you place an order, why we collect it, who sees
            it, and how to have it deleted.
          </p>
        </header>

        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-xl font-semibold text-cream">
            What we collect
          </h2>
          <p className="font-sans text-sm leading-relaxed text-cream/80">
            When you place an order we collect your{" "}
            <strong className="text-cream">full name, phone number, email
            address, delivery area (Nairobi estate), building or house with a
            landmark</strong>{" "}
            and any notes you add for your order (for example a spice
            preference). We also keep the order details themselves: what you
            ordered, the prices at the time, the order number and its status.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-xl font-semibold text-cream">
            Why we collect it
          </h2>
          <p className="font-sans text-sm leading-relaxed text-cream/80">
            Only to process and deliver your order: to confirm the order with
            you on WhatsApp or phone, to bring it to the right address in
            Nairobi, and to keep a record in case anything needs correcting.
            We never sell your details and we never use them for advertising.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-xl font-semibold text-cream">
            Who sees it
          </h2>
          <p className="font-sans text-sm leading-relaxed text-cream/80">
            Only the {BUSINESS.name} business — the owner who prepares and
            delivers your order. No one else. Your order is stored on our
            website&apos;s secured database, protected so that only the
            business can read it.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-xl font-semibold text-cream">
            How long we keep it
          </h2>
          <p className="font-sans text-sm leading-relaxed text-cream/80">
            For as long as the order history is useful for the business — for
            example to handle a delivery question or a repeat order. You can
            ask us to delete your details at any time (see below).
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-xl font-semibold text-cream">
            Your choices and deletion
          </h2>
          <p className="font-sans text-sm leading-relaxed text-cream/80">
            You can ask us at any time to show you what we hold about you, or
            to delete it. Email the owner at{" "}
            {ownerEmail ? (
              <a
                href={`mailto:${ownerEmail}`}
                className="font-medium text-gold-light underline decoration-gold/40 underline-offset-4 transition-colors duration-300 ease-luxe hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
              >
                {ownerEmail}
              </a>
            ) : (
              <>
                the address on your order confirmation, or reach us on WhatsApp
                at{" "}
                <a
                  href={`https://wa.me/${BUSINESS.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-gold-light underline decoration-gold/40 underline-offset-4 transition-colors duration-300 ease-luxe hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
                >
                  {BUSINESS.displayPhone}
                </a>
              </>
            )}
            . We delete your details as soon as we reasonably can after your
            request.
          </p>
        </section>

        <footer className="mt-4 text-center">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-gold/50 px-6 font-sans text-sm font-semibold text-gold transition-colors duration-300 ease-luxe hover:border-gold hover:bg-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light"
          >
            Back to the shop
          </Link>
        </footer>
      </article>
    </main>
  );
}
