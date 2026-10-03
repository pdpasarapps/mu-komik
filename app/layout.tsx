import type { Metadata, Viewport } from "next";
import PwaSupport from "./pwa-support";
import "./globals.css";

export const metadata: Metadata = {
  title: "mu-komik | Kisah penuh warna",
  description: "Ruang independen untuk komik, kreator, dan cerita yang layak dinikmati.",
  applicationName: "mu-komik",
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
