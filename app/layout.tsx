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
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
