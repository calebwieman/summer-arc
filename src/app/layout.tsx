import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { BottomNav } from "@/components/nav/bottom-nav";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { NotificationScheduler } from "@/components/review/notification-scheduler";
import "./globals.css";

export const metadata: Metadata = {
  title: "Summer",
  description: "Daily discipline tracking.",
  applicationName: "Summer",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Summer",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="min-h-dvh bg-background text-foreground font-sans">
        {children}
        <BottomNav />
        <NotificationScheduler />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
