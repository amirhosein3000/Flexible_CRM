"use client";
import {Languages} from "lucide-react";
import {NextIntlClientProvider} from "next-intl";
import {CalendarContext,changeLanguage,useCopy,useFormatting} from "../i18n/client";
import type {Calendar,Locale} from "../i18n/config";
import type {MessageId} from "../i18n/messages";
export function LocaleProvider({locale,calendar,messages,children}:{locale:Locale;calendar?:Calendar;messages:Record<MessageId,string>;children:React.ReactNode}) {
  return <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC"><CalendarContext.Provider value={calendar}>{children}</CalendarContext.Provider></NextIntlClientProvider>;
}
export function LanguageSwitch() {
  const t=useCopy();
  const {locale}=useFormatting();
  return <label className="language-switch">
    <Languages aria-hidden="true" size={16}/>
    <span className="sr-only">{t("language")}</span>
    <select aria-label={t("language")} value={locale} onChange={event=>changeLanguage(event.target.value as Locale)}>
      <option value="fa-IR" lang="fa-IR">فارسی</option>
      <option value="en" lang="en">English</option>
    </select>
  </label>;
}
