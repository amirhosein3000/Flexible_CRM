import jalaali from "jalaali-js";
const {isValidJalaaliDate,toGregorian,toJalaali}=jalaali;
import {calendarFor,defaultRegion,type Calendar,type Locale,type Region} from "./config.ts";

export function asciiDigits(text:string) {
  return text.replace(/[۰-۹٠-٩]/g,value=>String(value.codePointAt(0)!-(value>="۰"?0x6f0:0x660)));
}
export function canonicalNumber(text:string) {
  const raw=asciiDigits(text).replace(/٫/g,".").replace(/−/g,"-");
  if(!/[,٬\u00a0\u202f]/.test(raw))return raw;
  return /^-?\d{1,3}(?:[,٬\u00a0\u202f]\d{3})+(?:\.\d+)?$/.test(raw)?raw.replace(/[,٬\u00a0\u202f]/g,""):raw;
}
export function searchText(text:string) {
  return text.toLowerCase().replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/[\u0640\u064b-\u065f\u0670]/g,"").replace(/[\u200c\u200d]/g," ").replace(/\s+/g," ").trim();
}
function tag(locale:Locale,calendar?:Calendar) {
  return locale+"-u-nu-"+(locale==="fa-IR"?"arabext":"latn")+(calendar?"-ca-"+calendar:"");
}
export function formatNumber(value:string|number,locale:Locale,options?:Intl.NumberFormatOptions) {
  const formatter=new Intl.NumberFormat(tag(locale),{maximumFractionDigits:8,...options});
  return formatter.format(value as number);
}
export function formatDate(value:string|null|undefined,locale:Locale,region:Region=defaultRegion,calendar?:Calendar,options:Intl.DateTimeFormatOptions={month:"short",day:"numeric",year:"numeric"}) {
  if(!value) return "—";
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return "—";
  return new Intl.DateTimeFormat(tag(locale,calendarFor(locale,calendar)),{timeZone:/^\d{4}-\d{2}-\d{2}$/.test(value)?"UTC":region.timeZone,...options}).format(date);
}
export function workspaceDay(timeZone:string,now=new Date()) {
  const {year,month,day}=wallParts(now,timeZone);
  return iso(year,month,day);
}
export function formatRelativeDate(value:string,locale:Locale,region:Region=defaultRegion,now=new Date(),calendar?:Calendar) {
  const {year,month,day}=wallParts(now,region.timeZone);
  const today=Date.UTC(year,month-1,day);
  const date=new Date(value);
  const difference=Math.round((date.getTime()-today)/86400000);
  if(Math.abs(difference)>6||!Number.isFinite(difference))return formatDate(value,locale,region,calendar);
  return new Intl.RelativeTimeFormat(tag(locale),{numeric:"auto"}).format(difference,"day");
}
function iso(y:number,m:number,d:number) {return String(y).padStart(4,"0")+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0");}
export function parseDateInput(value:string,calendar:Calendar): string | null {
  const canonical=asciiDigits(value).trim();
  if(calendar==="gregory") {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(canonical))return null;
    const date=new Date(canonical);
    return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===canonical?canonical:null;
  }
  const match=/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/.exec(canonical);
  if(!match)return null;
  const [year,month,day]=match.slice(1).map(Number);
  if(!isValidJalaaliDate(year,month,day))return null;
  const {gy,gm,gd}=toGregorian(year,month,day);
  return iso(gy,gm,gd);
}
export function dateInputValue(value:string,locale:Locale,calendar:Calendar) {
  if(!value||calendar!=="persian")return value;
  const [y,m,d]=value.split("-").map(Number);
  if(!y||!m||!d)return "";
  try {
    const {jy,jm,jd}=toJalaali(y,m,d);
    const display=iso(jy,jm,jd).replaceAll("-","/");
    return locale==="fa-IR"?display.replace(/\d/g,digit=>String.fromCodePoint(0x6f0+Number(digit))):display;
  } catch {return "";}
}
function wallParts(date:Date,timeZone:string) {
  const fields=new Intl.DateTimeFormat("en-u-ca-gregory-nu-latn",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);
  const parts=Object.fromEntries(fields.map(field=>[field.type,Number(field.value)]));
  return {year:parts.year,month:parts.month,day:parts.day,hour:parts.hour,minute:parts.minute};
}
export function timestampInputValue(value:string,locale:Locale,calendar:Calendar,timeZone:string) {
  if(!value)return "";
  const instant=new Date(value);
  if(!Number.isFinite(instant.getTime()))return "";
  const {year,month,day,hour,minute}=wallParts(instant,timeZone);
  const date=dateInputValue(iso(year,month,day),locale,calendar);
  const time=String(hour).padStart(2,"0")+":"+String(minute).padStart(2,"0");
  return date+(calendar==="persian"?" ":"T")+time;
}
export function parseTimestampInput(value:string,calendar:Calendar,timeZone:string) {
  const [date,time]=asciiDigits(value).trim().split(/[T\s]+/);
  const day=parseDateInput(date,calendar);
  if(!day||!time||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))return null;
  const desired=Date.parse(day+"T"+time+":00Z");
  let candidate=desired;
  for(let attempt=0;attempt<4;attempt++) {
    const wall=wallParts(new Date(candidate),timeZone);
    const delta=desired-Date.UTC(wall.year,wall.month-1,wall.day,wall.hour,wall.minute);
    if(!delta)return new Date(candidate).toISOString();
    candidate+=delta;
  }
  return null;
}

export function booleanInput(raw:string) {
  const value=searchText(raw);
  if(["true","yes","بله"].includes(value))return true;
  if(["false","no","خیر"].includes(value))return false;
  return undefined;
}
