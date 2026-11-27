import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";

// Elegant serif for headings, clean sans for body — loaded with next/font
// and exposed to Tailwind via the --font-serif / --font-sans variables.
const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "Lake Flavour — Crisp. Golden. Straight from the lake.",
    template: "%s — Lake Flavour",
  },
  description:
    "Premium Fried Omena: crispy dried lake fish from Lake Victoria, Kenya. Order online — delivered within Nairobi. Pay on delivery with cash or M-Pesa.",
  openGraph: {
    title: "Lake Flavour — Fried Omena, delivered in Nairobi",
    description:
      "Crispy fried omena from Lake Victoria. Order online — delivered within Nairobi, pay on delivery.",
    images: ["/og-image.jpg"],
    type: "website",
    siteName: "Lake Flavour",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body className="bg-background font-sans text-cream antialiased">
        {children}
      </body>
    </html>
  );
}
