import type { Locale } from "@/lib/locale";

export function localizedText(indonesian: string | null | undefined, english: string | null | undefined, locale: Locale): string {
  const translated = locale === "en" ? english?.trim() : "";
  return translated || indonesian || "";
}
