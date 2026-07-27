import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter, Caveat } from "next/font/google";
import "./globals.css";

// Body sans-serif. 300/400/500/600/700 covers all weights used in the prototype.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

// Display serif. Italic 400 is used for the burgundy accent in headings.
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

// Script font for the countdown line and the footer signature.
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Notre Vie à Deux",
  description: "Wedding planning hub for Celal & his fiancée.",
};

/**
 * `viewportFit: "cover"` is what makes iOS report real values for
 * env(safe-area-inset-*). Without it Safari returns 0 for all of them, so
 * the fixed bottom tab bar had no idea the home indicator was there and
 * sat underneath it — where iOS also swallows taps for the swipe gesture.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${cormorant.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
