import {createTranslator} from "next-intl";
import english from "./messages/en.ts";
import persian from "./messages/fa-IR.ts";
import type {Locale} from "./config.ts";
export type MessageId = keyof typeof english;
export type Values = Record<string,string|number|Date>;
export const dictionaries = {en:english,"fa-IR":persian} satisfies Record<Locale,Record<MessageId,string>>;
export function translator(locale: Locale) {return createTranslator({locale,messages:dictionaries[locale]});}
export function message(locale: Locale,key:MessageId,values?:Values) {return translator(locale)(key,values);}
export function isolate(text: string) {return "\u2068"+text+"\u2069";}
export function bilingual<T extends {name:string;name_fa?:string|null}>(locale: Locale,entry:T) {
  return locale==="fa-IR" && entry.name_fa ? entry.name_fa : entry.name;
}
export function pluralName(locale: Locale, entry:{plural:string;plural_fa?:string|null}) {
  return locale==="fa-IR" && entry.plural_fa ? entry.plural_fa : entry.plural;
}
