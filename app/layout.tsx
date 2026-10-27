import type { Metadata, Viewport } from "next";
import { Bangers, Caveat, Comic_Neue, Nunito, Patrick_Hand } from "next/font/google";
import { siteUrl } from "@/lib/seo";
import { getPlatformSettings } from "@/lib/platform-settings";
import { cookies, headers } from "next/headers";
import { KIDS_MODE_COOKIE_NAME, readKidsModeState } from "@/lib/kids-mode";
import { getLocaleFromCountry, isLocale, LOCALE_COOKIE_NAME } from "@/lib/locale";
import Script from "next/script";
import PlatformRuntime from "./platform-runtime";
import ReaderMembershipRuntime from "./membership-runtime";
import PwaSupport from "./pwa-support";
import AppSplash from "@/components/app-splash";
import { LanguageSwitcher, LocaleProvider } from "@/components/locale-provider";
import "./globals.css";

export const dynamic = "force-dynamic";

const comicNeue = Comic_Neue({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-comic-neue", display: "swap", preload: false });
const bangers = Bangers({ subsets: ["latin"], weight: "400", variable: "--font-bangers", display: "swap", preload: false });
const patrickHand = Patrick_Hand({ subsets: ["latin", "latin-ext"], weight: "400", variable: "--font-patrick-hand", display: "swap", preload: false });
const nunito = Nunito({ subsets: ["latin", "latin-ext"], weight: ["400", "700"], variable: "--font-nunito", display: "swap", preload: false });
const caveat = Caveat({ subsets: ["latin", "latin-ext"], weight: ["400", "700"], variable: "--font-caveat", display: "swap", preload: false });

export const metadata: Metadata = {
  metadataBase: siteUrl,
  alternates: {
    canonical: siteUrl.toString(),
  },
  title: {
    default: "MU Komik — Platform Komik Indonesia",
    template: "%s | MU Komik",
  },
  description: "Baca komik Indonesia terbaru dari kreator lokal. Temukan komik komedi, horor, romansa, kehidupan sehari-hari, dan berbagai cerita menarik di MU Komik.",
  applicationName: "mu-komik",
  authors: [{ name: "mu-komik" }],
  creator: "mu-komik",
  publisher: "mu-komik",
  facebook: { appId: "1452978320076766" },
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "mu-komik",
    url: siteUrl.toString(),
    title: "MU Komik — Platform Komik Indonesia",
    description: "Baca komik Indonesia terbaru dari kreator lokal. Temukan komik komedi, horor, romansa, kehidupan sehari-hari, dan berbagai cerita menarik di MU Komik.",
  },
  twitter: {
    card: "summary",
    title: "MU Komik — Platform Komik Indonesia",
    description: "Baca komik Indonesia terbaru dari kreator lokal. Temukan komik komedi, horor, romansa, kehidupan sehari-hari, dan berbagai cerita menarik di MU Komik.",
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
    shortcut: [{ url: "/favicon.ico", type: "image/x-icon" }],
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/pwa/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f6f2",
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": new URL("#organization", siteUrl).toString(),
      name: "MU Komik",
      url: siteUrl.toString(),
      logo: {
        "@type": "ImageObject",
        url: new URL("/logo_mukomik.jpg", siteUrl).toString(),
      },
      sameAs: [
        "https://www.instagram.com/mu_komik/",
        "https://www.tiktok.com/@mukomikz",
      ],
    },
    {
      "@type": "WebSite",
      "@id": new URL("#website", siteUrl).toString(),
      name: "MU Komik",
      url: siteUrl.toString(),
      inLanguage: "id-ID",
      description: "Platform untuk membaca komik Indonesia dan menjelajahi cerita karya kreator lokal.",
      publisher: { "@id": new URL("#organization", siteUrl).toString() },
    },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { settings } = await getPlatformSettings();
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const kidsModeState = readKidsModeState(cookieStore.get(KIDS_MODE_COOKIE_NAME)?.value);
  const localeCookie = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale = isLocale(localeCookie)
    ? localeCookie
    : getLocaleFromCountry(requestHeaders.get("cf-ipcountry"));
  return (
    <html lang={locale === "id" ? "id" : "en"} className={`h-full antialiased ${comicNeue.variable} ${bangers.variable} ${patrickHand.variable} ${nunito.variable} ${caveat.variable}`} data-theme="light" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        />
        <LocaleProvider initialLocale={locale}>
          <ReaderMembershipRuntime>
            <PlatformRuntime
              initialSettings={settings}
              initialKidsMode={kidsModeState?.enabled ?? false}
              initialKidsModePinConfigured={Boolean(kidsModeState)}
            >
              {children}
            </PlatformRuntime>
          </ReaderMembershipRuntime>
          <LanguageSwitcher />
        </LocaleProvider>
        <AppSplash />
        <PwaSupport />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-6L34F8FBJM"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){window.dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-6L34F8FBJM');
          `}
        </Script>
      </body>
    </html>
  );
}
