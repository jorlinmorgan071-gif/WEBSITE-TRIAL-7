"use client";

/**
 * STEP 4A — lazily loads the checkout section so the checkout code stays out
 * of the initial landing-page bundle entirely: the chunk is only imported
 * once the visitor approaches the section (IntersectionObserver, generous
 * root margin, so it is ready before they arrive). The skeleton keeps the
 * #order anchor in the server HTML the whole time, and the noscript message
 * stays for browsers without JavaScript.
 *
 * The server page passes the database catalogue (or the fallback) down as
 * plain props, so the prices shown are always the server's.
 */

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/products";
import CheckoutSkeleton from "./CheckoutSkeleton";

const CheckoutSection = dynamic(() => import("@/components/sections/CheckoutSection"));

export default function CheckoutLazy({ products }: { products: Product[] }) {
  const holderRef = useRef<HTMLDivElement>(null);
  /** True once the visitor is near the checkout section. */
  const [load, setLoad] = useState(false);

  useEffect(() => {
    if (load) return;
    const el = holderRef.current;
    if (!el) return;
    // No IntersectionObserver (very old browsers): just load it.
    if (typeof IntersectionObserver === "undefined") {
      setLoad(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLoad(true);
          io.disconnect();
        }
      },
      // Start loading well before the section is visible so it is ready.
      { rootMargin: "900px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [load]);

  return (
    <div ref={holderRef}>
      {load ? <CheckoutSection products={products} /> : <CheckoutSkeleton />}
    </div>
  );
}
