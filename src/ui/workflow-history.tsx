"use client";

import {Check, CircleMinus, History, Undo2, X} from "lucide-react";
import {useEffect,useState} from "react";
import {useCopy,useFormatting} from "../i18n/client";
import type {workflowHistory} from "../domain/workflows";
import type {Read} from "./types";
import {Empty,ErrorNotice,Modal} from "./primitives";

const stepLabel={task:"historyCreateTask",assign:"historyAssignRecord",notify:"historyNotify"} as const;
const stepStatus={
  completed:{label:"completed",icon:Check},
  failed:{label:"historyFailed",icon:X},
  reverted:{label:"historyRolledBack",icon:Undo2},
  skipped:{label:"historyNotRun",icon:CircleMinus},
} as const;

export function WorkflowHistory({id,name,read,close}:{id:string;name:string;read:Read;close:()=>void}) {
  const t=useCopy();
  const {date}=useFormatting();
  const [result,setResult]=useState<Awaited<ReturnType<typeof workflowHistory>>>();
  const [error,setError]=useState("");
  useEffect(()=>{
    let live=true;
    read<Awaited<ReturnType<typeof workflowHistory>>>({kind:"workflow-history",id})
      .then(value=>{if(live)setResult(value);})
      .catch(problem=>{if(live)setError(problem.message);});
    return ()=>{live=false;};
  },[id,read]);
  return <Modal drawer title={t("runHistory")} description={name} close={close}>
    {error?<ErrorNotice text={error}/>:!result?<p role="status">{t("loadingHistory")}</p>:result.runs.length?<ol className="workflow-history">
      {result.runs.map(run=><li key={run.id}>
        <header><strong dir="auto">{run.record_title??t("historyWorkspaceRun")}</strong>
          <time dateTime={run.created_at}>{date(run.created_at,{dateStyle:"medium",timeStyle:"short"})}</time></header>
        {run.status==="failed"&&<p role="note">{t(run.step_index===null?"historyFailedBeforeActions":run.retryable?"historyFailedRetryable":"historyFailedRule")}</p>}
        <ol>{result.steps.map((step,index)=>{
          const status=run.status==="completed"?"completed":run.step_index===null||index>run.step_index?"skipped":index<run.step_index?"reverted":"failed";
          const {label,icon:Icon}=stepStatus[status];
          return <li key={index} className={"history-step "+status}><Icon aria-hidden="true" size={15}/><span>{t(stepLabel[step])}</span><small>{t(label)}</small></li>;
        })}</ol>
      </li>)}
    </ol>:<Empty title={t("historyEmpty")} icon={<History size={24}/>}>{t("historyEmptyHelp")}</Empty>}
  </Modal>;
}
