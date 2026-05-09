import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { BottomNav } from "@/components/nav/bottom-nav";

export const metadata: Metadata = {
  title: "Summer Arc",
  description: "Day N of 108 — the arc of summer 2026",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Summer Arc",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      className={`${GeistSans.variable} ${GeistMono.variable} h-full`}
      style={{ colorScheme: "dark" }}
    >
      <body className="min-h-full bg-[var(--bg)] text-[var(--text)] antialiased">
        <main className="mx-auto max-w-lg pb-28 min-h-screen">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
