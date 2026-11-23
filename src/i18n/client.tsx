"use client";
import {createContext,useContext} from "react";
import {useLocale,useTranslations} from "next-intl";
import {calendarCookie,calendarFor,defaultRegion,localeCookie,type Calendar,type Locale,type Region} from "./config.ts";
import {formatDate,formatNumber,formatRelativeDate} from "./format.ts";
import type {MessageId,Values} from "./messages.ts";
export const RegionalContext=createContext<Region>(defaultRegion);
export const CalendarContext=createContext<Calendar|undefined>(undefined);
export function useCopy() {
  const t=useTranslations();
  return (key:MessageId,values?:Values)=>t(key,values);
}
export function useFormatting() {
  const locale=useLocale() as Locale;
  const region=useContext(RegionalContext);
  const preference=useContext(CalendarContext);
  const calendar=calendarFor(locale,preference);
  return {
    locale,calendar,region,
    number:(value:number|string)=>formatNumber(value,locale),
    amount:(value:number|string)=>formatNumber(value,locale,region.currency?{style:"currency",currency:region.currency}:undefined),
    date:(value:string|null|undefined,options?:Intl.DateTimeFormatOptions)=>formatDate(value,locale,region,calendar,options),
    relative:(value:string)=>formatRelativeDate(value,locale,region,new Date(),calendar)
  };
}
function preferenceCookie(name:string,value:string) {
  document.cookie=name+"="+value+"; Max-Age=31536000; Path=/; SameSite=Lax"+(location.protocol==="https:"?"; Secure":"");
  location.reload();
}
export function changeLanguage(locale:Locale){preferenceCookie(localeCookie,locale);}
export function changeCalendar(calendar:Calendar){preferenceCookie(calendarCookie,calendar);}
