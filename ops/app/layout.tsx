import type { Metadata } from "next";
import { Playfair_Display, Poppins } from "next/font/google";
import "./globals.css";

/*
 * Fonts are downloaded at build time and served from this app.
 *
 * They used to come from a Google Fonts stylesheet linked in <head>: a
 * render-blocking request to a third party on every page, two more
 * connections before any text could be drawn, and a jump when the real font
 * swapped in. Self-hosted, they preload with the page, and the fallback is
 * sized to match so the swap does not shift the layout.
 *
 * Same families, weights and styles as before. globals.css reads the two
 * variables through --font-sans and --font-display.
 */
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["italic"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Haskel Ops",
    template: "%s · Haskel Ops",
  },
  description: "Internal back office for Haskel Project Pty.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" className={`${poppins.variable} ${playfair.variable}`}>
      <head>
        <link
          rel="icon"
          href={
            'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
            '<rect width="64" height="64" rx="16" fill="%23a34d68"/>' +
            '<text x="32" y="44" font-family="Georgia,serif" font-size="30" font-weight="bold" ' +
            'text-anchor="middle" fill="%23fff">H</text></svg>'
          }
        />
      </head>
      <body className="bg-cream text-ink">{children}</body>
    </html>
  );
}
