"use client";

import Image from "next/image";
import {ArrowRight, CalendarClock, Hand, Plus, Search, Shuffle, Sparkles, X} from "lucide-react";
import {useState} from "react";
import {useCopy,useFormatting} from "../i18n/client";
import {Button} from "./primitives";
import type {Task} from "./types";

export function usePebblePreference(userId:string) {
  const key="cairn.pebble:"+userId;
  const [enabled,setEnabled]=useState(()=>{
    try {return window.localStorage.getItem(key)==="on";}
    catch {return false;}
  });
  function setPebble(enabled:boolean) {
    setEnabled(enabled);
    try {
      if(enabled) window.localStorage.setItem(key,"on");
      else window.localStorage.removeItem(key);
    } catch {/* The setting still works for this visit. */}
  }
  return {enabled,setEnabled:setPebble};
}

function PebblePortrait({className=""}:{className?:string}) {
  return <Image src="/pebble.webp" alt="" width={144} height={144} unoptimized className={className}/>;
}

export function PebblePreference({enabled,onChange}:{enabled:boolean;onChange:(enabled:boolean)=>void}) {
  const t=useCopy();
  return <section className="surface settings-panel pebble-preference" aria-label={t("personalPreferences")}>
    <div className="pebble-preference-main">
      <PebblePortrait/>
      <div>
        <h2>{t("pebbleName")}</h2>
        <p>{t("pebblePreferenceDescription")}</p>
        <small id="pebble-device-note">{t("pebblePreferenceDevice")}</small>
      </div>
    </div>
    <label className="pebble-preference-toggle">
      <input type="checkbox" role="switch" checked={enabled} aria-describedby="pebble-device-note" onChange={event=>onChange(event.target.checked)}/>
      <span>{t("pebbleShow")}</span>
    </label>
  </section>;
}

export type PebbleActions={
  search:()=>void;
  createTask?:()=>void;
  openTasks:()=>void;
  openRecord:(id:string)=>void;
  hide:()=>void;
};

export function PebbleCompanion({tasks,actions}:{tasks:Task[];actions:PebbleActions}) {
  const t=useCopy();
  const {date,relative}=useFormatting();
  const [position,setPosition]=useState(0);
  const [highFives,setHighFives]=useState(0);
  const nextTasks=tasks.slice(0,3);
  const task=nextTasks[Math.min(position,nextTasks.length-1)];

  return <section className="pebble-panel" aria-labelledby="pebble-heading">
    <div className="pebble-intro">
      <div className="pebble-orbit" aria-hidden="true">
        <PebblePortrait key={highFives} className={highFives?"pebble-bounce":""}/>
        {highFives>0&&<Sparkles key={"spark-"+highFives} className="pebble-spark" size={28}/>}
      </div>
      <div className="pebble-copy">
        <h2 id="pebble-heading">{t("pebbleName")}</h2>
        <p aria-live="polite">{t(highFives===0?"pebbleHello":highFives%2?"pebbleCheers":"pebbleAgain")}</p>
        <div className="pebble-actions">
          <Button onClick={actions.search}><Search size={15} aria-hidden="true"/>{t("pebbleFindRecord")}</Button>
          {actions.createTask&&<Button onClick={actions.createTask}><Plus size={15} aria-hidden="true"/>{t("newTask")}</Button>}
          <Button variant="ghost" onClick={()=>setHighFives(n=>n+1)}><Hand size={15} aria-hidden="true"/>{t("pebbleHighFive")}</Button>
        </div>
      </div>
    </div>
    <div className="pebble-next">
      <h3><CalendarClock size={16} aria-hidden="true"/>{t("pebbleNextFollowUp")}</h3>
      {task?<><div className="pebble-task" aria-live="polite">
        <strong><bdi dir="auto">{task.title}</bdi></strong>
        {task.due_at&&<time dateTime={task.due_at} title={date(task.due_at)}>{relative(task.due_at)}</time>}
      </div>
      <div className="pebble-actions">
        <Button variant="ghost" onClick={()=>task.record_id?actions.openRecord(task.record_id):actions.openTasks()}>
          {t(task.record_id?"pebbleOpenLinkedRecord":"viewAllTasks")}<ArrowRight size={15} aria-hidden="true"/>
        </Button>
        {nextTasks.length>1&&<Button variant="ghost" onClick={()=>setPosition((Math.min(position,nextTasks.length-1)+1)%nextTasks.length)}>
          <Shuffle size={14} aria-hidden="true"/>{t("pebbleAnotherTask")}
        </Button>}
      </div></>:<p className="pebble-task">{t("pebbleNothingToDo")}</p>}
    </div>
    <Button variant="ghost" className="square pebble-hide" aria-label={t("pebbleHide")} title={t("pebbleHide")} onClick={actions.hide}><X size={17} aria-hidden="true"/></Button>
  </section>;
}
