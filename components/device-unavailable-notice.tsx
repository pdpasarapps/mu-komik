"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";

export default function DeviceUnavailableNotice({ deviceName }: { deviceName: string }) {
  const { t } = useLocale();
  return (
    <main className="reader-detail-page">
      <div className="reader-detail-not-found">
        <h1>{t("Komik ini tidak tersedia di perangkat ini.")}</h1>
        <p>{t("Kreator mengatur komik ini untuk dibaca di")} {t(deviceName)}. {t("Buka tautan ini dari perangkat yang sesuai untuk melanjutkan.")}</p>
        <Link className="reader-detail-secondary-link" href="/">{t("Jelajahi komik")}</Link>
      </div>
    </main>
  );
}
