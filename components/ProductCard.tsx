"use client";

/**
 * STEP 3 — compact card used in the product grid (2+ products).
 * Orders via WhatsApp at the product's default size; the featured
 * single-product layout is ProductShowcase.
 */

import { useState } from "react";
import Image from "next/image";
import { MessageCircle } from "lucide-react";
import { BUSINESS } from "@/lib/business";
import type { Product } from "@/lib/products";
import { formatPrice, orderMessage, whatsappUrl } from "@/lib/order";
import PriceTag from "./PriceTag";

export default function ProductCard({
  product,
  entered,
}: {
  product: Product;
  /** True once the section has entered the viewport (gates image loads). */
  entered: boolean;
}) {
  const [failed, setFailed] = useState(false);

  const option =
    product.options.find((o) => o.id === product.defaultOptionId) ??
    product.options[0];
  const waUrl = whatsappUrl(BUSINESS, orderMessage(BUSINESS, product, option));
  const photo = product.images[0];

  return (
    <article className="lift-card relative flex flex-col overflow-hidden rounded-2xl border border-gold/20 bg-surface shadow-2xl shadow-black/60">
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {entered && !failed && photo ? (
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            sizes="(max-width: 768px) 92vw, (max-width: 1024px) 45vw, 30vw"
            className="object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-surface" aria-hidden />
        )}
        {product.badge && (
          <span className="absolute left-3 top-3 rounded-full border border-gold/50 bg-black/55 px-3 py-1 font-sans text-[11px] font-semibold uppercase tracking-[0.15em] text-gold-light backdrop-blur-sm">
            {product.badge}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="font-serif text-2xl font-semibold text-cream">
            {product.name}
          </h3>
          <p className="mt-0.5 font-sans text-xs font-medium uppercase tracking-[0.18em] text-gold-light">
            {product.tagline}
          </p>
        </div>

        <p
          className={`flex items-center gap-2 font-sans text-sm ${
            product.inStock ? "text-cream/85" : "text-muted"
          }`}
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${
              product.inStock ? "bg-gold" : "bg-cream/30"
            }`}
          />
          {product.inStock ? "In stock" : "Out of stock"}
        </p>

        <div className="mt-auto flex flex-col gap-3 pt-2">
          <div>
            <PriceTag
              price={formatPrice(option.priceKes, BUSINESS.currency)}
              changeKey={option.id}
              size="md"
            />
            <p className="mt-1 font-sans text-xs text-muted">
              {option.label} · {option.localName}
            </p>
          </div>
          <a
            href={product.inStock ? waUrl : undefined}
            target={product.inStock ? "_blank" : undefined}
            rel="noopener noreferrer"
            aria-label={`Order on WhatsApp — ${product.name}, ${option.label}`}
            aria-disabled={!product.inStock}
            className={`inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-full font-sans text-sm font-semibold transition-all duration-300 ease-luxe focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light ${
              product.inStock
                ? "bg-gold text-background hover:bg-gold-light"
                : "pointer-events-none cursor-not-allowed bg-gold/25 text-background/70 opacity-50"
            }`}
          >
            <MessageCircle aria-hidden className="h-5 w-5" strokeWidth={1.8} />
            Order on WhatsApp
          </a>
        </div>
      </div>
    </article>
  );
}
