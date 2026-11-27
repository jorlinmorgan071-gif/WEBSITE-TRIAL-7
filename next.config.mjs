/** @type {import('next').NextConfig} */

/**
 * STEP 4A — security headers (basic CSP-friendly set).
 * Notes:
 *  - script-src includes 'unsafe-inline' because Next.js injects its
 *    bootstrap as inline JSON; a nonce-based CSP is a later hardening step.
 *  - connect-src allows the Supabase project (if configured) so the admin
 *    sign-in works; everything else is same-origin only.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const connectSrc = ["'self'"];
if (supabaseUrl) {
  connectSrc.push(supabaseUrl, supabaseUrl.replace(/^http/, "ws"));
} else {
  connectSrc.push("https://*.supabase.co", "wss://*.supabase.co");
}

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src ${connectSrc.join(" ")}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig = {
  reactStrictMode: true,
  // postgres.js uses `new URL('.', import.meta.url)` for stack-trace cleanup,
  // which webpack turns into a raw (untranspiled) asset and the minifier
  // rejects. Externalize it — the server requires it from node_modules at
  // runtime instead. It is a server-only, direct-Postgres transport anyway.
  experimental: {
    serverComponentsExternalPackages: ["postgres"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
