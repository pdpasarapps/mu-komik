import type { Metadata, Viewport } from "next";
import PwaSupport from "./pwa-support";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://mu-komik.pdpasarapps.workers.dev"),
  title: {
    default: "mu-komik | Baca Komik Indonesia",
    template: "%s | mu-komik",
  },
  description: "Temukan dan baca komik Indonesia dari kreator independen. Jelajahi cerita fantasi, horor, romansa, aksi, dan genre lainnya di mu-komik.",
  applicationName: "mu-komik",
  authors: [{ name: "mu-komik" }],
  creator: "mu-komik",
  publisher: "mu-komik",
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "mu-komik",
    title: "mu-komik | Baca Komik Indonesia",
    description: "Temukan dan baca komik Indonesia dari kreator independen.",
  },
  twitter: {
    card: "summary",
    title: "mu-komik | Baca Komik Indonesia",
    description: "Temukan dan baca komik Indonesia dari kreator independen.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "mu-komik",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/pwa/icon.svg", type: "image/svg+xml" },
      { url: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/pwa/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f6f2",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <PwaSupport />
      </body>
    </html>
  );
}
