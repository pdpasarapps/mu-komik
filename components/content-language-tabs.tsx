"use client";

import type { Locale } from "@/lib/locale";

export default function ContentLanguageTabs({ value, onChange }: { value: Locale; onChange: (locale: Locale) => void }) {
  return (
    <div className="content-language-tabs" role="group" aria-label="Bahasa konten">
      <button type="button" aria-pressed={value === "id"} onClick={() => onChange("id")}>Indonesia</button>
      <button type="button" aria-pressed={value === "en"} onClick={() => onChange("en")}>English</button>
    </div>
  );
}
