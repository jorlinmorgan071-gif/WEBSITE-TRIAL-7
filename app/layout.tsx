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
  title: "Lake Flavour — Crisp. Golden. Straight from the lake.",
  description:
    "Premium Fried Omena: crispy dried lake fish from Kenya. Crisp. Golden. Straight from the lake.",
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
