export type Locale = "id" | "en";

export const LOCALE_COOKIE_NAME = "mu-komik-locale";

export function getLocaleFromCountry(country: string | null): Locale {
  return country && country.toUpperCase() !== "ID" ? "en" : "id";
}

export function isLocale(value: string | undefined): value is Locale {
  return value === "id" || value === "en";
}
