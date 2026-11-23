export type Locale = "fa-IR" | "en";
export type Calendar = "persian" | "gregory";
export const localeCookie = "cairn_locale";
export const calendarCookie = "cairn_calendar";
export const locales = ["fa-IR", "en"] as const;
export function resolveLocale(value?: string | null): Locale {return value === "en" ? "en" : "fa-IR";}
export function resolveCalendar(value?: string | null): Calendar | undefined {
  return value === "persian" || value === "gregory" ? value : undefined;
}
export function calendarFor(locale: Locale, preferred?: Calendar): Calendar {
  return preferred ?? (locale === "fa-IR" ? "persian" : "gregory");
}
export function direction(locale: Locale) {return locale === "fa-IR" ? "rtl" : "ltr";}
export function requestLocale(request?: Request): Locale {
  const choice=request?.headers.get("cookie")?.match(/(?:^|;\s*)cairn_locale=(en|fa-IR)(?:;|$)/)?.[1];
  return resolveLocale(choice);
}
export type Region = {currency: string | null; timeZone: string};
export const defaultRegion: Region = {currency:null,timeZone:"UTC"};
