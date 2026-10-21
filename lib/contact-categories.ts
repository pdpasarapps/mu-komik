export const CONTACT_CATEGORIES = [
  { value: "account_login", label: "Akun dan login" },
  { value: "comic_reading", label: "Masalah membaca komik atau episode" },
  { value: "blocked_account", label: "Akun diblokir atau akses dibatasi" },
  { value: "appeal", label: "Banding keputusan moderasi atau kurasi" },
  { value: "membership", label: "Keanggotaan Premium atau VIP" },
  { value: "payment_tokens", label: "Pembayaran berhasil, token belum masuk" },
  { value: "payment_other", label: "Pembayaran atau pengembalian dana" },
  { value: "creator_publishing", label: "Akun kreator atau penerbitan komik" },
  { value: "content_report", label: "Laporan konten atau hak cipta" },
  { value: "technical_issue", label: "Bug atau kendala teknis" },
  { value: "other", label: "Lainnya" },
] as const;

export type ContactCategory = (typeof CONTACT_CATEGORIES)[number]["value"];

export function isContactCategory(value: unknown): value is ContactCategory {
  return typeof value === "string"
    && CONTACT_CATEGORIES.some((category) => category.value === value);
}

export function getContactCategoryLabel(value: string) {
  return CONTACT_CATEGORIES.find((category) => category.value === value)?.label ?? "Lainnya";
}
