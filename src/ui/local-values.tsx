"use client";
import type {FieldValue} from "../domain/validation";
import {useCopy,useFormatting} from "../i18n/client";
import {dateInputValue,parseDateInput,parseTimestampInput,timestampInputValue} from "../i18n/format";
import type {Calendar,Locale} from "../i18n/config";
import {Input} from "./primitives";

export function FieldDisplay({value,kind}:{value?:FieldValue;kind:string}) {
  const t=useCopy();
  const {amount,date,number}=useFormatting();
  if(value===undefined||value===null||value===""||Array.isArray(value)&&!value.length)return <>—</>;
  if(typeof value==="boolean")return <>{t(value?"yes":"no")}</>;
  if(kind==="currency")return <bdi>{amount(String(value))}</bdi>;
  if(kind==="decimal"||kind==="number")return <bdi className="number">{number(String(value))}</bdi>;
  if(kind==="date"||kind==="timestamp")return <time dateTime={String(value)}>{date(String(value),kind==="timestamp"?{dateStyle:"medium",timeStyle:"short"}:undefined)}</time>;
  if(Array.isArray(value))return <bdi dir="auto">{value.join(t("listSeparator"))}</bdi>;
  return <bdi dir={["email","url","phone"].includes(kind)?"ltr":"auto"}>{value}</bdi>;
}
export function LocalDateInput({label,name,value,required=false,timestamp=false}:{label:string;name:string;value?:string;required?:boolean;timestamp?:boolean}) {
  const t=useCopy();
  const {calendar,locale,region}=useFormatting();
  const display=timestamp?timestampInputValue(value??"",locale,calendar,region.timeZone):dateInputValue(value??"",locale,calendar);
  const text=calendar==="persian"||locale==="fa-IR";
  const placeholder=calendar==="persian"?(timestamp?t("jalaliTimestampExample"):t("jalaliExample")):timestamp?"2026-11-23 09:30":"2026-11-23";
  return <Input name={name} label={label} type={text?"text":timestamp?"datetime-local":"date"} dir="ltr" value={text?display.replace("T"," "):display} placeholder={text?placeholder:undefined} required={required}/>;
}
export function formDate(raw:string,calendar:Calendar,locale:Locale,timeZone:string,timestamp=false) {
  if(!raw)return null;
  const value=timestamp?parseTimestampInput(raw,calendar,timeZone):parseDateInput(raw,calendar);
  if(!value) throw new Error(messageForDate(locale,calendar,timestamp));
  return value;
}
import {message} from "../i18n/messages";
function messageForDate(locale:Locale,calendar:Calendar,timestamp:boolean) {
  return message(locale,timestamp?"invalidDateTime":calendar==="persian"?"invalidJalali":"errorEnterAValidDate");
}
