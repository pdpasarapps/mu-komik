import { cookies, headers } from "next/headers";
import { getLocaleFromCountry, isLocale, LOCALE_COOKIE_NAME } from "@/lib/locale";

export async function getRequestLocale() {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const localeCookie = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  return isLocale(localeCookie) ? localeCookie : getLocaleFromCountry(requestHeaders.get("cf-ipcountry"));
}
