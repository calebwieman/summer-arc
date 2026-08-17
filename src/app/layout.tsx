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
    /*
      NOT black-translucent.

      That value is an instruction to draw the page *under* the status bar, and
      iOS then paints a legibility backdrop over that band which samples the
      content beneath — which is what rendered the date line smeared in the
      installed app while leaving it crisp in Safari, where content never goes
      under the status bar at all.

      Three rounds of clearance tried to dodge the band by pushing content past
      it. `default` removes it: iOS reserves the status bar, the viewport starts
      below it, and there is no overlay to smear anything. The bar takes its
      colour from the `themeColor` viewport entries below, which already track
      --bg in both schemes, so nothing about the look changes.

      The trade is the edge-to-edge top. Worth it for legible type.
    */
    statusBarStyle: "default",
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
