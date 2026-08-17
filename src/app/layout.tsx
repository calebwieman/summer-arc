import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { MotionRoot } from "@/components/motion-root";
import { NightlyReminder } from "@/components/pwa/nightly-reminder";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { THEME_SCRIPT, ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

// Same woff2 subsets Wieman OS ships — self-hosted, no build-time network call.
const spaceGrotesk = localFont({
  src: "../../public/fonts/space-grotesk-latin.woff2",
  weight: "300 700",
  style: "normal",
  display: "swap",
  variable: "--font-space-grotesk",
});

const spaceMono = localFont({
  src: [
    { path: "../../public/fonts/space-mono-400-latin.woff2", weight: "400" },
    { path: "../../public/fonts/space-mono-700-latin.woff2", weight: "700" },
  ],
  style: "normal",
  display: "swap",
  variable: "--font-space-mono",
});

export const metadata: Metadata = {
  title: "Standard",
  description: "Hold the standard.",
  applicationName: "Standard",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Standard",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0d" },
  ],
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
    <html
      lang="en"
      // The pre-paint script overwrites this before the first frame; it only
      // matters when JS is off, where the CSS media fallback takes over.
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${spaceMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-bg font-display text-ink">
        {/* Flat colour behind the status bar — see .status-guard in globals.css.
            Sits outside the surfaces so it holds across the day, the record,
            the history and anything opened over them. */}
        <div className="status-guard" aria-hidden />
        <MotionRoot>
          <ThemeProvider>
            {children}
            <NightlyReminder />
            <ServiceWorkerRegister />
          </ThemeProvider>
        </MotionRoot>
      </body>
    </html>
  );
}
