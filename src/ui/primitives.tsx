"use client";
import {useCopy,useFormatting} from "../i18n/client";

import * as D from "@radix-ui/react-dialog";
import {ArrowUpRight,Building2,CalendarDays,ChevronDown,CircleHelp,Layers3,Target,Users,BriefcaseBusiness,X} from "lucide-react";
import {useState,type ReactNode,type ButtonHTMLAttributes,type FormEvent} from "react";
export const icons={layers:Layers3,users:Users,building:Building2,target:Target,briefcase:BriefcaseBusiness};
export function ObjectIcon({name,size=17}:{name:string;size?:number}) {const Icon=icons[name as keyof typeof icons]??Layers3;return <Icon size={size}/>;}
export function Button({variant="secondary",className="",...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:"primary"|"secondary"|"ghost"|"danger"}) {return <button {...props} className={"button "+variant+" "+className}/>;}
export function Modal({title,description,close,children,drawer=false}:{title:string;description:string;close:()=>void;children:ReactNode;drawer?:boolean}) {
  const t=useCopy();
  return <D.Root open onOpenChange={open=>{if(!open)close();}}><D.Portal><D.Overlay className="overlay"/><D.Content className={"modal "+(drawer?"drawer":"")}>
    <div className="modal-head"><div><D.Title>{title}</D.Title><D.Description>{description}</D.Description></div><D.Close asChild><Button variant="ghost" className="square" aria-label={t("close")}><X size={19}/></Button></D.Close></div>
    <div className="modal-content">{children}</div>
  </D.Content></D.Portal></D.Root>;
}
export function Form({children,onSave,action,cancel}:{children:ReactNode;onSave:(form:FormData)=>Promise<void>;action?:string;cancel?:()=>void}) {
  const t=useCopy();
  const [error,setError]=useState(""),[busy,setBusy]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy)return;
    const form=event.currentTarget;
    const invalid=form.querySelector<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>("input:invalid,select:invalid,textarea:invalid");
    if(invalid){setError(t(invalid.validity.valueMissing?"requiredValue":invalid.type==="email"?"errorEnterAValidEmailAddress":"errorEnterAValidValue"));invalid.focus();return;}
    const data=new FormData(form);
    setBusy(true);setError("");
    try{await onSave(data);}catch(e){setError(e instanceof Error?e.message:t("somethingWentWrong"));}finally{setBusy(false);}
  }
  return <form noValidate onSubmit={submit} className="form-stack">{children}{error&&<p className="form-error" role="alert">{error}</p>}<div className="form-actions">{cancel&&<Button type="button" onClick={cancel}>{t("cancel")}</Button>}<Button variant="primary" disabled={busy}>{busy?t("saving"):(action??t("save"))}</Button></div></form>;
}
export const formText=(form:FormData,name:string)=>String(form.get(name)??"").trim();
export function Input({label,name,type="text",required=false,value,placeholder,dir}:{label:string;name:string;type?:string;required?:boolean;value?:string;placeholder?:string;dir?:"auto"|"ltr"|"rtl"}) {
  return <label className="field"><span>{label}{required&&<small aria-hidden="true"> *</small>}</span><input dir={dir??(["email","url","tel","password","time","number"].includes(type)?"ltr":"auto")} name={name} type={type} required={required} defaultValue={value} placeholder={placeholder}/></label>;
}
export function Select({label,name,items,value,required=false,empty}:{label:string;name:string;items:{id:string;name:string}[];value?:string;required?:boolean;empty?:string}) {
  return <label className="field"><span>{label}</span><div className="select-wrap"><select aria-label={label} name={name} dir="auto" defaultValue={value??""} required={required}>{empty&&<option value="">{empty}</option>}{items.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={14}/></div></label>;
}
export function Empty({title,children,icon=<Layers3 size={23}/> }:{title:string;children:ReactNode;icon?:ReactNode}) {return <div className="empty"><div>{icon}</div><h3>{title}</h3><p>{children}</p></div>;}
export function Avatar({name,size="md"}:{name:string;size?:"sm"|"md";index?:number}) {return <span className={"avatar "+size+" avatar-"+(Array.from(name).reduce((n,c)=>n*31+c.charCodeAt(0),0)>>>0)%4} aria-hidden="true">{name.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join("").toUpperCase()}</span>;}
export function DateLabel({value}:{value:string|null}) {const {date}=useFormatting();return <span className="date-label"><CalendarDays size={14}/>{date(value)}</span>;}
export function WorldLink({href,children}:{href:string;children:ReactNode}) {return <a className="quiet-link" href={href} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={13}/></a>;}
export function ErrorNotice({text,retry}:{text:string;retry?:()=>void}) {
  const t=useCopy();return <div className="error-notice" role="alert"><CircleHelp size={18}/>{text}{retry&&<Button onClick={retry}>{t("tryAgain")}</Button>}</div>;}
