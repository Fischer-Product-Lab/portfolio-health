import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  return {
    title: "Portfolio Health | Fischer Product Lab",
    description: "A decision-ready ITSM operating dashboard from Fischer Product Lab.",
    openGraph: {
      title: "Portfolio Health",
      description: "Fischer Product Lab presents operational health in one decision-ready view.",
      images: [`${origin}/og.png`],
    },
    twitter: {
      card: "summary_large_image",
      title: "Portfolio Health",
      description: "Fischer Product Lab presents operational health in one decision-ready view.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
