import type { Metadata } from "next";
import "./globals.css";

// Static metadata (compatible with `output: "export"`). Relative image URLs
// resolve via metadataBase, which Next derives from the Vercel production URL
// at build time (localhost fallback for local builds).
export const metadata: Metadata = {
  title: "Portfolio Health | Fischer Product Lab",
  description: "A decision-ready ITSM operating dashboard from Fischer Product Lab.",
  openGraph: {
    title: "Portfolio Health",
    description: "Fischer Product Lab presents operational health in one decision-ready view.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Portfolio Health",
    description: "Fischer Product Lab presents operational health in one decision-ready view.",
    images: ["/og.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
