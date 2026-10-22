"use client";

import Link from "next/link";
import BrandLogo from "@/components/brand-logo";
import { useLocale } from "@/components/locale-provider";

export default function ArticleSiteHeader() {
  const { t } = useLocale();
  return (
    <header className="article-site-header">
      <BrandLogo className="wordmark reader-wordmark" showName />
      <nav aria-label={t("Navigasi artikel")}>
        <Link href="/">{t("Jelajahi komik")}</Link>
        <Link href="/artikel">{t("Artikel")}</Link>
      </nav>
    </header>
  );
}
