import type {Metadata} from "next";
import {LocaleProvider} from "../src/ui/regional";
import {direction} from "../src/i18n/config";
import {dictionaries,message} from "../src/i18n/messages";
import {preferences} from "../src/i18n/server";
import "@fontsource-variable/vazirmatn";
import "./globals.css";
export async function generateMetadata():Promise<Metadata>{
  const {locale}=await preferences();
  return {title:message(locale,"cairnCrm"),description:message(locale,"productDescription")};
}
export default async function Layout({children}:{children:React.ReactNode}) {
  const {locale,calendar}=await preferences();
  return <html lang={locale} dir={direction(locale)}><body><LocaleProvider locale={locale} calendar={calendar} messages={dictionaries[locale]}>{children}</LocaleProvider></body></html>;
}
