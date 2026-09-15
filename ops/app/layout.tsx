import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Haskel Ops",
    template: "%s · Haskel Ops",
  },
  description: "Internal back office for Haskel Projects Pty.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,500;1,600&family=Poppins:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
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
