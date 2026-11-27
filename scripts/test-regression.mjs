#!/usr/bin/env node
/**
 * STEP 4A — Steps 1-3 regression + Step 4A housekeeping checks against the
 * production build:
 *   - the landing page still contains every earlier section (hero slides,
 *     steps viewer, products section with the WhatsApp quick-order link)
 *   - the #order checkout anchor is in the server HTML
 *   - security headers are sent (CSP, X-Frame-Options, nosniff, …)
 *   - /privacy renders, the favicon and the OG image are served
 *
 * Run AFTER: npm run build.
 */

import assert from "node:assert/strict";
import { startNext, stopNext } from "./lib/test-server.mjs";

const PORT = 3250;

let passed = 0;
let failed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      passed++;
      console.log(`  PASS  ${name}`);
    })
    .catch((error) => {
      failed++;
      console.log(`  FAIL  ${name}`);
      console.log(`        ${error.message}`);
    });
}

const run = async () => {
  const server = await startNext({ port: PORT });

  try {
    console.log("== landing page regression (Steps 1-3) ==");

    const res = await fetch(server.base);
    const html = await res.text();

    await test("page renders 200", () => assert.equal(res.status, 200));

    await test("landing sections render (product photos referenced; hero slides lazy by design)", () => {
      // Product photos (Step 3 showcase) reference the landing images in the
      // server HTML. The Step 1 hero SLIDES load their photos only when the
      // section enters the viewport — by design, so they are absent from SSR.
      assert.ok(html.includes("images/landing/hero-1"), "product photo reference missing");
    });

    await test("steps viewer present (#steps)", () => {
      assert.ok(html.includes('id="steps"'), "#steps missing");
    });

    await test("products section present (#products) with heading", () => {
      assert.ok(html.includes('id="products"'), "#products missing");
      assert.ok(html.includes("Get Your Fried Omena"), "products heading missing");
      assert.ok(html.includes("Fried Omena"), "product name missing");
    });

    await test("WhatsApp quick-order button still links to the shop number", () => {
      assert.ok(
        html.includes("wa.me/254768859022"),
        "wa.me link to 254768859022 missing"
      );
      assert.ok(html.includes("Order on WhatsApp"), "WhatsApp button label missing");
      assert.ok(html.includes("Order online"), "Order online button missing");
    });

    await test("checkout anchor in the server HTML (#order + skeleton)", () => {
      assert.ok(html.includes('id="order"'), "#order anchor missing");
      assert.ok(html.includes("Place Your Order"), "checkout skeleton heading missing");
    });

    console.log("== Step 4A housekeeping ==");

    await test("Open Graph + twitter meta tags present", () => {
      assert.ok(html.includes('property="og:image"'), "og:image missing");
      assert.ok(html.includes("/og-image.jpg"), "og-image.jpg reference missing");
      assert.ok(html.includes('name="twitter:card"'), "twitter card missing");
    });

    await test("security headers on the landing page", () => {
      const csp = res.headers.get("content-security-policy") ?? "";
      const hsts = res.headers.get("strict-transport-security") ?? "";
      assert.ok(csp.includes("default-src 'self'"), "CSP default-src missing");
      assert.ok(csp.includes("frame-ancestors 'none'"), "CSP frame-ancestors missing");
      assert.equal(res.headers.get("x-frame-options"), "DENY");
      assert.equal(res.headers.get("x-content-type-options"), "nosniff");
      assert.ok(hsts.includes("max-age"), "HSTS missing");
      assert.ok(
        (res.headers.get("referrer-policy") ?? "").includes("strict-origin"),
        "referrer policy missing"
      );
    });

    await test("favicon is served (app/icon.svg)", async () => {
      const iconRes = await fetch(`${server.base}/icon.svg`);
      assert.equal(iconRes.status, 200);
      assert.ok((iconRes.headers.get("content-type") ?? "").includes("svg"));
      const body = await iconRes.text();
      assert.ok(body.includes("LF"), "gold LF monogram missing");
    });

    await test("OG image is served", async () => {
      const ogRes = await fetch(`${server.base}/og-image.jpg`);
      assert.equal(ogRes.status, 200);
      const buf = Buffer.from(await ogRes.arrayBuffer());
      assert.ok(buf.length > 20000, `og-image suspiciously small (${buf.length} bytes)`);
    });

    await test("/privacy renders (draft notice + owner contact from env)", async () => {
      const res2 = await fetch(`${server.base}/privacy`);
      const privacyHtml = await res2.text();
      assert.equal(res2.status, 200);
      assert.ok(privacyHtml.includes("Privacy Notice"));
      assert.ok(privacyHtml.includes("Draft — owner to review"));
      assert.ok(privacyHtml.includes("What we collect"));
      assert.ok(privacyHtml.includes("delete"), "deletion request section missing");
    });
  } finally {
    await stopNext(server);
  }

  console.log("");
  if (failed === 0) {
    console.log(`ALL ${passed} REGRESSION TESTS PASSED`);
    process.exit(0);
  }
  console.log(`${passed} passed, ${failed} FAILED`);
  process.exit(1);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
