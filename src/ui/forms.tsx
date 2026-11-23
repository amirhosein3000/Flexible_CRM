"use client";
import {useCopy,useFormatting} from "../i18n/client";
import {bilingual,pluralName,isolate} from "../i18n/messages";

import {Link2,MessageSquare,Plus,ArrowDown,ArrowUp,Sparkles,Trash2} from "lucide-react";
import {useEffect,useRef,useState} from "react";
import {Avatar,Button,Empty,ErrorNotice,Form,formText,Input,Modal,Select} from "./primitives";
import {FieldDisplay,LocalDateInput,formDate} from "./local-values";
import {csvColumns} from "../i18n/csv-columns";
import {asciiDigits,booleanInput,searchText} from "../i18n/format";
import type {Bootstrap,Detail,DialogState,Execute,Field,ListData,Read} from "./types";
import type {FieldValue} from "../domain/validation";
const label=(id:string,name:string)=>({id,name});

const nullable=(fd:FormData,k:string)=>formText(fd,k)||null;
function Dynamic({field,current}:{field:Field;current?:FieldValue}) {
  const t=useCopy();
  const {locale}=useFormatting();
  const name=bilingual(locale,field);
  const type={email:"email",url:"url",phone:"tel"}[field.kind as "email"];
  if(field.kind==="date"||field.kind==="timestamp")return <LocalDateInput label={name} name={field.id} value={typeof current==="string"?current:undefined} required={field.required} timestamp={field.kind==="timestamp"}/>;
  if(field.kind==="boolean") return <Select label={name} name={field.id} items={[label("true",t("yes")),label("false",t("no"))]} empty={t("unset")} required={field.required} value={current===undefined||current===null?"":String(current)}/>;
  if(field.kind==="select") return <Select label={name} name={field.id} items={field.options.map(v=>label(v,v))} empty={t("chooseAnOption")} value={typeof current==="string"?current:undefined} required={field.required}/>;
  if(field.kind==="multi") return <label className="field"><span>{name}</span><select multiple name={field.id} required={field.required} defaultValue={Array.isArray(current)?current:[]}>{field.options.map(v=><option key={v}>{v}</option>)}</select></label>;
  if(field.kind==="longtext") return <label className="field"><span>{field.name}</span><textarea name={field.id} required={field.required} defaultValue={typeof current==="string"?current:""}/></label>;
  return <Input label={name} name={field.id} type={type??"text"} dir={["decimal","currency","number"].includes(field.kind)?"ltr":undefined} value={typeof current==="string"?current:undefined} required={field.required}/>;
}
export function Dialogs({state,data,exec,read,close,done,refresh}:{
  state:DialogState;data:Bootstrap;exec:Execute;read:Read;close:()=>void;done:(message:string)=>void;refresh:()=>void;
}) {
  const t=useCopy();
  const {locale,region,calendar,number}=useFormatting();
const kinds=[["text",t("shortText")],["longtext",t("longText")],["decimal",t("decimal")],["currency",t("currency")],["date",t("date")],["timestamp",t("dateAndTime")],["boolean",t("checkbox")],["email",t("email")],["phone",t("phone")],["url",t("url")],["select",t("singleSelect")],["multi",t("multiSelect")]].map(([id,name])=>label(id,name));
  const [extra,setExtra]=useState<{fields:Field[];revision:number}>();
  const [pipeline,setPipeline]=useState(state.record?.pipeline_id??"");
  const [kind,setKind]=useState("text");
  const [flowObject,setFlowObject]=useState(data.objects[0]?.id??"");
  const [flowFields,setFlowFields]=useState<Field[]>([]);
  const [layout,setLayout]=useState(state.object?.layout??[]);
  const nextStageKey=useRef(0);
  const [stages,setStages]=useState<{key:string;id?:string;name:string}[]>(state.pipeline?.stages.map(stage=>({key:stage.id,id:stage.id,name:bilingual(locale,stage)}))??[{key:"initial",name:""}]);
  const [trigger,setTrigger]=useState("stage");
  const [steps,setSteps]=useState(["task"]);
  const [linkRelation,setLinkRelation]=useState("");
  const [targets,setTargets]=useState<{id:string;name:string}[]>([]);
  const [csv,setCsv]=useState("");
  const [filename,setFilename]=useState("");
  const [preview,setPreview]=useState<{id?:string;headers:string[];valid?:number;invalid?:number;errors?:{row:number;message:string}[];needsMapping?:boolean}>();
  const [inviteUrl,setInviteUrl]=useState("");
  const [error,setError]=useState("");
  const object=state.object;
  const options=data.objects.map(item=>label(item.id,pluralName(locale,item)));
  const mates=data.people.map(item=>label(item.id,item.name));
  const p=data.pipelines.filter(item=>item.object_id===object?.id);
  const relation=data.relations.find(item=>item.id===linkRelation);
  useEffect(()=>{
    if(state.kind==="record"&&object&&!state.fields) read<ListData>({kind:"list",objectId:object.id,limit:"1"}).then(result=>setExtra({fields:result.fields,revision:result.object.revision})).catch(e=>setError(e.message));
  },[state.kind,state.fields,object,read]);
  useEffect(()=>{
    if(state.kind==="workflow"&&flowObject) read<ListData>({kind:"list",objectId:flowObject,limit:"1"}).then(result=>setFlowFields(result.fields)).catch(e=>setError(e.message));
  },[state.kind,flowObject,read]);
  useEffect(()=>{
    if(!relation||!state.detail) return;
    const target=relation.source_object===state.detail.record.object_id?relation.target_object:relation.source_object;
    read<ListData>({kind:"list",objectId:target,limit:"100",sort:"title",dir:"asc"}).then(result=>setTargets(result.records.filter(r=>r.id!==state.detail?.record.id).map(r=>label(r.id,r.title)))).catch(e=>setError(e.message));
  },[relation,state.detail,read]);
  const save=(action:string,body:unknown,message:string)=>exec(action,body).then(()=>done(message));
  const list=state.fields??extra?.fields??[];
  const columns=csvColumns(locale,list);
  const localDate=(raw:string,timestamp=false)=>formDate(raw,calendar,locale,region.timeZone,timestamp);
  const conditionValue=(form:FormData)=>{
    const field=flowFields.find(field=>field.id===formText(form,"condition"));
    const raw=formText(form,"equals");
    if(!raw)return null;
    if(field?.kind==="boolean"){
      const value=booleanInput(raw);
      if(value===undefined)throw Error(t("errorFieldRequiresTrueOrFalse",{field:bilingual(locale,field)}));
      return value;
    }
    if(field?.kind==="date"||field?.kind==="timestamp")return localDate(raw,field.kind==="timestamp");
    return raw;
  };
  const host=(heading:string,desc:string,children:React.ReactNode)=><Modal title={heading} description={desc} close={close}>{error&&<ErrorNotice text={error}/>} {children}</Modal>;
  if(state.kind==="record"&&object) return host(t(state.record?"editType":"createType",{type:bilingual(locale,object).toLowerCase()}),t("setTheDetailsYourWorkspaceTracks"),!state.fields&&!extra?<p role="status">{t("loadingFields")}</p>:<Form cancel={close} action={state.record?t("saveChanges"):t("createRecord")} onSave={async form=>{
    const values:Record<string,FieldValue>={};
    for(const field of list) values[field.id]=field.kind==="multi"?form.getAll(field.id).map(String):field.kind==="boolean"?(nullable(form,field.id)===null?null:formText(form,field.id)==="true"):field.kind==="date"||field.kind==="timestamp"?localDate(formText(form,field.id),field.kind==="timestamp"):nullable(form,field.id);
    await save("saveRecord",{id:state.record?.id,version:state.record?.version,objectId:object.id,revision:extra?.revision??object.revision,title:formText(form,"title"),ownerId:nullable(form,"owner"),pipelineId:pipeline||null,stageId:nullable(form,"stage"),fields:values},state.record?t("recordUpdated"):t("recordCreated"));
  }}><Input name="title" label={t("name")} required value={state.record?.title}/>{list.map(field=><Dynamic key={field.id} field={field} current={state.record?.fields[field.id]}/>)}
  <Select label={t("owner")} name="owner" items={mates} empty={t("unassigned")} value={state.record?.owner_id??undefined}/>
  {p.length>0&&<><label className="field"><span>{t("pipeline")}</span><select value={pipeline} onChange={event=>setPipeline(event.target.value)}><option value="">{t("noPipeline")}</option>{p.map(item=><option key={item.id} value={item.id}>{bilingual(locale,item)}</option>)}</select></label>{pipeline&&<Select key={pipeline} label={t("stage")} name="stage" items={p.find(item=>item.id===pipeline)?.stages.map(stage=>label(stage.id,bilingual(locale,stage)))??[]} value={state.record?.stage_id??undefined} required empty={t("chooseAStage")}/>}</>}
  </Form>);
  if(state.kind==="task") return host(t("newTask"),t("keepTheNextStepVisible"),<Form cancel={close} action={t("addTask")} onSave={form=>save("addTask",{title:formText(form,"title"),dueDate:localDate(formText(form,"due")),assigneeId:nullable(form,"assignee"),recordId:state.record?.id},t("taskAdded"))}><Input label={t("taskName")} name="title" required/><LocalDateInput label={t("dueDate")} name="due"/><Select label={t("assignee")} name="assignee" items={mates} empty={t("unassigned")}/></Form>);
  if(state.kind==="activity"&&state.record) return host(t("logActivity"),t("addAnEntryToThisRecordSTimeline"),<Form cancel={close} action={t("logActivity")} onSave={form=>save("activity",{recordId:state.record?.id,kind:formText(form,"kind"),body:formText(form,"body")},t("activityLogged"))}><Select name="kind" label={t("activityType")} items={["note","call","meeting"].map(v=>label(v,t(v==="note"?"note":v==="call"?"call":"meeting")))}/><label className="field"><span>{t("details")}</span><textarea name="body" required/></label></Form>);
  if(state.kind==="object") return host(t("newObject"),t("defineATypeOfRecordYourTeamNeedsToTrack"),<Form cancel={close} action={t("createObject")} onSave={form=>save("addObject",{name:formText(form,"name"),plural:formText(form,"plural"),icon:formText(form,"icon")},t("objectCreated"))}><Input name="name" label={t("singularName")} placeholder={t("engagement")} required/><Input name="plural" label={t("pluralName")} placeholder={t("engagements")} required/><Select name="icon" label={t("icon")} items={[label("layers",t("layers")),label("target",t("target")),label("building",t("building")),label("users",t("people")),label("briefcase",t("briefcase"))]}/></Form>);
  if(state.kind==="field"&&object) return host(t("addField"),t("chooseWhichValuesThisObjectShouldStore"),<Form cancel={close} action={t("addField")} onSave={form=>save("addField",{objectId:object.id,name:formText(form,"name"),kind,required:form.has("required"),options:formText(form,"options").split(/[,،]/).map(x=>x.trim()).filter(Boolean)},t("fieldAdded"))}><Input label={t("fieldName")} name="name" required/><label className="field"><span>{t("fieldType")}</span><select aria-label={t("fieldType")} value={kind} onChange={e=>setKind(e.target.value)}>{kinds.map(k=><option key={k.id} value={k.id}>{k.name}</option>)}</select></label>{["select","multi"].includes(kind)&&<Input label={t("optionsSeparatedByCommas")} name="options" required/>}<label className="check-label"><input type="checkbox" name="required"/> {t("requiredForEveryRecord")}</label></Form>);
  if(state.kind==="layout"&&object) return host(t("editRecordLayout"),t("groupFieldsIntoNamedSectionsUnassignedFieldsRemainInDetails"),<Form cancel={close} action={t("saveLayout")} onSave={()=>save("setLayout",{objectId:object.id,revision:object.revision,sections:layout},t("layoutSaved"))}>
    {layout.map((section,index)=><div className="step-group" key={index}><label className="field"><span>{t("sectionName")}</span><input required value={section.name} onChange={e=>setLayout(layout.map((s,i)=>i===index?{...s,name:e.target.value}:s))}/></label><label className="field"><span>{t("fields")}</span><select aria-label={t("fields")} multiple value={section.fieldIds} onChange={e=>{const selected=Array.from(e.target.selectedOptions,option=>option.value);setLayout(layout.map((s,i)=>i===index?{...s,fieldIds:selected}:{...s,fieldIds:s.fieldIds.filter(id=>!selected.includes(id))}));}}>{list.map(field=><option key={field.id} value={field.id}>{bilingual(locale,field)}</option>)}</select></label><Button type="button" onClick={()=>setLayout(layout.filter((_,i)=>i!==index))}>{t("removeSection")}</Button></div>)}
    {layout.length<12&&<Button type="button" onClick={()=>setLayout([...layout,{name:"",fieldIds:[]}])}><Plus size={15}/> {t("addSection")}</Button>}</Form>);
  if(state.kind==="pipeline") {
    const selected=state.pipeline;
    const move=(from:number,to:number)=>setStages(previous=>{const next=[...previous];[next[from],next[to]]=[next[to],next[from]];return next;});
    return host(selected?t("editPipeline"):t("newPipeline"),t("setTheOrderOfWorkForAWorkspaceObject"),<Form cancel={close} action={selected?t("savePipeline"):t("createPipeline")} onSave={form=>selected?
      save("updatePipeline",{id:selected.id,name:formText(form,"name")===bilingual(locale,selected)?selected.name:formText(form,"name"),expected:selected.stages.map(({id,name})=>({id,name})),stages:stages.map(({id,name})=>{const old=selected.stages.find(stage=>stage.id===id);return {id,name:old&&name===bilingual(locale,old)?old.name:name};})},t("pipelineUpdated")):
      save("addPipeline",{objectId:formText(form,"object"),name:formText(form,"name"),stages:stages.map(stage=>stage.name)},t("pipelineCreated"))}>
      <Input label={t("pipelineName")} name="name" required value={selected?bilingual(locale,selected):undefined}/>{!selected&&<Select name="object" label={t("object")} items={options} required/>}
      {stages.map((stage,index)=><div className="stage-editor" key={stage.key}><label className="field"><span>{t("stageIndex",{index:index+1})}</span><input value={stage.name} required onChange={e=>setStages(stages.map((s,i)=>i===index?{...s,name:e.target.value}:s))}/></label><Button type="button" className="square" aria-label={t("stageUp",{index:index+1})} disabled={index===0} onClick={()=>move(index,index-1)}><ArrowUp size={15}/></Button><Button type="button" className="square" aria-label={t("stageDown",{index:index+1})} disabled={index===stages.length-1} onClick={()=>move(index,index+1)}><ArrowDown size={15}/></Button><Button type="button" className="square" aria-label={t("stageRemove",{index:index+1})} disabled={stages.length===1} onClick={()=>setStages(stages.filter((_,i)=>i!==index))}><Trash2 size={15}/></Button></div>)}
      {stages.length<16&&<Button type="button" onClick={()=>setStages([...stages,{key:"draft-"+nextStageKey.current++,name:""}])}><Plus size={15}/> {t("addStage")}</Button>}
    </Form>);
  }
  if(state.kind==="relation") return host(t("newRelationship"),t("connectRecordsFromTwoObjects"),<Form cancel={close} action={t("createRelationship")} onSave={form=>save("addRelation",{source:formText(form,"source"),target:formText(form,"target"),label:formText(form,"label"),inverse:formText(form,"inverse"),cardinality:formText(form,"cardinality")},t("relationshipCreated"))}><Select name="source" label={t("fromObject")} items={options}/><Select name="target" label={t("toObject")} items={options}/><Input name="label" label={t("forwardLabel")} required/><Input name="inverse" label={t("reverseLabel")} required/><Select name="cardinality" label={t("cardinality")} items={[label("one-many",t("oneToMany")),label("one-one",t("oneToOne")),label("many-many",t("manyToMany"))]}/></Form>);
  if(state.kind==="link"&&state.detail) {
    const rid=state.detail.record.id,oid=state.detail.record.object_id;
    const defs=data.relations.filter(r=>r.source_object===oid||r.target_object===oid);
    return host(t("linkARecord"),t("chooseARelationshipAndAnExistingRecord"),defs.length?<Form cancel={close} action={t("linkRecord")} onSave={form=>save("link",{relation:linkRelation,source:relation?.source_object===oid?rid:formText(form,"target"),target:relation?.source_object===oid?formText(form,"target"):rid},t("recordLinked"))}><label className="field"><span>{t("relationship")}</span><select aria-label={t("relationship")} required value={linkRelation} onChange={e=>{setLinkRelation(e.target.value);setTargets([]);}}><option value="">{t("chooseARelationship")}</option>{defs.map(r=><option value={r.id} key={r.id}>{r.source_object===oid?(locale==="fa-IR"?r.label_fa??r.label:r.label):(locale==="fa-IR"?r.inverse_fa??r.inverse:r.inverse)}</option>)}</select></label>{linkRelation&&<Select name="target" label={t("relatedRecord")} items={targets} empty={t("chooseARecord")} required/>}</Form>:<Empty title={t("noRelationshipsConfigured")}>{t("createARelationshipInSettingsFirst")}</Empty>);
  }
  if(state.kind==="view"&&object) return host(t(state.filters?.mode==="board"?"saveBoard":"saveView"),t(state.filters?.mode==="board"?"saveBoardDescription":"keepTheseFiltersAndColumnsAvailableForLater"),<Form cancel={close} action={t(state.filters?.mode==="board"?"saveBoard":"saveView")} onSave={form=>save("saveView",{objectId:object.id,name:formText(form,"name"),shared:form.has("shared"),query:{...state.filters,columns:form.getAll("columns").map(String)}},t("viewSaved"))}><Input label={t("viewName")} name="name" required/>{state.fields?.map(f=><label key={f.id} className="check-label"><input type="checkbox" name="columns" value={f.id} defaultChecked={!state.filters?.columns||state.filters.columns.includes(f.id)}/> <bdi dir="auto">{bilingual(locale,f)}</bdi></label>)}{["owner","admin"].includes(data.role)&&<label className="check-label"><input type="checkbox" name="shared"/> {t("shareWithWorkspace")}</label>}</Form>);
  if(state.kind==="import"&&object) return host(t("importCsv"),t("mapSpreadsheetColumnsValidateTheRowsAndConfirmTheImport"),<><Form cancel={close} action={t("previewImport")} onSave={async form=>{
    const mapping=preview?Object.fromEntries(columns.map(column=>[column.id,formText(form,"map-"+column.id)])):undefined;
    setPreview(await exec("previewImport",{objectId:object.id,csv,mapping}));
  }}><label className="field file-picker"><span>{t("csvFile")}</span><span className="file-choice"><span className="button secondary">{t("chooseFile")}</span><bdi dir="auto">{filename||t("noFileSelected")}</bdi></span><input type="file" accept=".csv,text/csv" onChange={e=>{const file=e.target.files?.[0];setFilename(file?.name??"");setPreview(undefined);if(file){if(file.size>1000000)setError(t("chooseACsvSmallerThan1Mb"));else{setError("");void file.text().then(setCsv);}}}}/></label><label className="field"><span>{t("orPasteCsv")}</span><textarea dir="auto" value={csv} onChange={e=>{setCsv(e.target.value);setPreview(undefined);}} placeholder={t("csvExample")} required/></label>{preview&&columns.map(column=><Select name={"map-"+column.id} key={column.id} label={column.id==="title"?t("recordNameColumn"):column.name} items={preview.headers.map(h=>label(h,h))} value={preview.headers.find(h=>column.aliases.some(alias=>searchText(alias)===searchText(h)))} empty={t("doNotMap")} required={column.id==="title"}/>)}</Form>{preview?.needsMapping&&<p>{t("chooseTheColumnThatContainsRecordNames")}</p>}{preview?.id&&<div className="import-result"><strong>{t("importResult",{valid:preview.valid??0,invalid:preview.invalid??0})}</strong>{preview.errors?.map(e=><p key={e.row}>{t("importRow",{row:e.row,error:e.message})}</p>)}<Button variant="primary" disabled={!preview.valid} onClick={()=>void save("commitImport",preview.id,t("importCompleted")).catch(e=>setError(e.message))}>{t("importCount",{count:preview.valid??0})}</Button></div>}</>);
  if(state.kind==="invite") return host(t("inviteATeammate"),t("copyTheInviteForThePersonWithThisEmailAddress"),<Form cancel={close} action={t("createInvitation")} onSave={async form=>{const result=await exec<{url:string}>("invite",{email:formText(form,"email"),role:formText(form,"role")});setInviteUrl(location.origin+result.url);refresh();}}><Input label={t("emailAddress")} type="email" name="email" required/><Select label={t("role")} name="role" items={[label("member",t("member")),label("viewer",t("viewer")),...(data.role==="owner"?[label("admin",t("admin"))]:[])]}/>{inviteUrl&&<label className="field"><span>{t("invitationLink")}</span><input dir="ltr" readOnly value={inviteUrl} onFocus={e=>e.target.select()}/></label>}</Form>);
  if(state.kind==="workflow") return host(t("newAutomation"),t("chooseATriggerAndTheInternalActionsToPerform"),<Form cancel={close} action={t("publishAutomation")} onSave={form=>save("saveWorkflow",{
    name:formText(form,"name"),objectId:flowObject,trigger,stageId:trigger==="stage"?formText(form,"stage"):undefined,frequency:formText(form,"frequency")||undefined,time:formText(form,"time")||undefined,zone:formText(form,"zone")||undefined,
    conditions:formText(form,"condition")?[{fieldId:formText(form,"condition"),equals:conditionValue(form)}]:[],
    steps:steps.map((kind,index)=>({kind,title:formText(form,"step-"+index)||undefined,assigneeId:formText(form,"assignee-"+index)||undefined,days:Number(asciiDigits(formText(form,"days-"+index))||0)}))
  },t("automationPublished"))}><Input name="name" label={t("automationName")} required/><label className="field"><span>{t("object")}</span><select aria-label={t("object")} value={flowObject} onChange={e=>setFlowObject(e.target.value)}>{options.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label><label className="field"><span>{t("trigger")}</span><select aria-label={t("trigger")} value={trigger} onChange={e=>setTrigger(e.target.value)}><option value="stage">{t("entersAStage")}</option><option value="schedule">{t("onASchedule")}</option></select></label>{trigger==="stage"?<Select name="stage" label={t("stage")} items={data.pipelines.filter(p=>p.object_id===flowObject).flatMap(p=>p.stages.map(stage=>label(stage.id,bilingual(locale,stage))))} required empty={t("chooseAStage")}/>:<div className="form-pair"><Select name="frequency" label={t("frequency")} items={[label("daily",t("daily")),label("weekly",t("weekly"))]}/><Input name="time" label={t("localTime")} type="time" value="09:00"/><Input name="zone" label={t("ianaTimeZone")} dir="ltr" value={region.timeZone} required/></div>}<div className="form-pair"><Select name="condition" label={t("optionalCondition")} items={flowFields.filter(f=>f.kind!=="multi").map(f=>label(f.id,bilingual(locale,f)))} empty={t("alwaysRun")}/><Input name="equals" label={t("equals")}/></div>{steps.map((step,index)=><div key={index} className="step-group"><label className="field"><span>{t("actionIndex",{index:index+1})}</span><select value={step} onChange={e=>setSteps(steps.map((s,i)=>i===index?e.target.value:s))}><option value="task">{t("createATask")}</option><option value="assign">{t("assignTheRecord")}</option><option value="notify">{t("sendAnInAppNotification")}</option></select></label>{step!=="assign"&&<Input label={step==="task"?t("taskName"):t("notificationMessage")} name={"step-"+index} required/>}<Select name={"assignee-"+index} label={t("teammate")} items={mates} required={step!=="task"} empty={t("unassigned")}/>{step==="task"&&<Input label={t("daysUntilDue")} dir="ltr" value={number(1)} name={"days-"+index}/>}</div>)}{steps.length<8&&<Button type="button" onClick={()=>setSteps([...steps,"task"])}><Plus size={15}/> {t("addAction")}</Button>}</Form>);
  if(state.kind==="archive"&&state.record) return host(t("archiveRecord"),t("thisRemovesTheRecordFromActiveViewsAndRetainsItsHistory"),<Form cancel={close} action={t("archiveRecord")} onSave={()=>save("archiveRecord",{id:state.record?.id,version:state.record?.version},t("recordArchived"))}><p>{state.record.title}</p></Form>);
  return null;
}
export function RecordDrawer({detail,data,close,open,go,copilot,exec,refresh,canWrite}:{detail:Detail;data:Bootstrap;close:()=>void;open:(state:DialogState)=>void;go:(id:string)=>void;copilot:()=>void;exec:Execute;refresh:()=>void;canWrite:boolean}) {
  const t=useCopy();
  const {locale,date}=useFormatting();
  const [error,setError]=useState("");
  const r=detail.record,object=data.objects.find(o=>o.id===r.object_id);
  return <Modal drawer title={r.title} description={object?bilingual(locale,object):t("record")} close={close}><div className="record-tools"><Button onClick={copilot}><Sparkles size={16}/> {t("askCopilot")}</Button>{canWrite&&object&&<Button onClick={()=>open({kind:"record",object,fields:detail.fields,record:r})}>{t("edit")}</Button>}{canWrite&&<Button onClick={()=>open({kind:"task",record:r})}><Plus size={15}/> {t("task")}</Button>}</div>
    <section className="drawer-section"><h3>{t("details")}</h3><dl><div><dt>{t("owner")}</dt><dd>{data.people.find(p=>p.id===r.owner_id)?.name??t("unassigned")}</dd></div>{r.stage_id&&<div><dt>{t("stage")}</dt><dd>{data.pipelines.flatMap(p=>p.stages).find(s=>s.id===r.stage_id)?.[locale==="fa-IR"?"name_fa":"name"]??data.pipelines.flatMap(p=>p.stages).find(s=>s.id===r.stage_id)?.name??"—"}</dd></div>}{detail.fields.filter(f=>!object?.layout.some(section=>section.fieldIds.includes(f.id))).map(f=><div key={f.id}><dt dir="auto">{bilingual(locale,f)}</dt><dd><FieldDisplay value={r.fields[f.id]} kind={f.kind}/></dd></div>)}</dl></section>
    {object?.layout.map((section,index)=><section className="drawer-section" key={index}><h3>{section.name}</h3><dl>{section.fieldIds.map(fid=>detail.fields.find(f=>f.id===fid)).filter(f=>f!==undefined).map(f=><div key={f.id}><dt dir="auto">{bilingual(locale,f)}</dt><dd><FieldDisplay value={r.fields[f.id]} kind={f.kind}/></dd></div>)}</dl></section>)}
    <section className="drawer-section"><div className="section-head"><h3>{t("relationships")}</h3>{canWrite&&<Button variant="ghost" onClick={()=>open({kind:"link",detail})}><Link2 size={15}/> {t("linkRecord")}</Button>}</div>{detail.edges.length?detail.edges.map(edge=><div className="related" key={edge.id}><button className="quiet-link" onClick={()=>go(edge.record_id)}><bdi dir="auto">{edge.title}</bdi></button><span dir="auto">{locale==="fa-IR"?edge.label_fa??edge.label:edge.label}</span>{canWrite&&<Button variant="ghost" className="square" aria-label={t("unlinkNamed",{name:isolate(edge.title)})} onClick={()=>void exec("unlink",edge.id).then(refresh).catch(e=>setError(e.message))}><Trash2 size={15}/></Button>}</div>):<p className="muted">{t("noRecordsLinkedYet")}</p>}</section>
    <section className="drawer-section"><div className="section-head"><h3>{t("timeline")}</h3>{canWrite&&<Button variant="ghost" onClick={()=>open({kind:"activity",record:r})}><MessageSquare size={15}/> {t("logActivity")}</Button>}</div>{detail.activities.length?<ol className="timeline">{detail.activities.map(a=><li key={a.id}><Avatar name={a.actor??"Cairn"} size="sm"/><div><strong>{a.actor??"Cairn"}</strong><p dir="auto">{a.kind==="stage"?t("stageMoved",{stage:isolate((locale==="fa-IR"?a.stage_fa??a.stage_name:a.stage_name)??a.body.replace(/^Moved to /,""))}):a.body}</p><small>{t(a.kind==="note"?"note":a.kind==="call"?"call":a.kind==="meeting"?"meeting":"activityStage")} · {date(a.created_at)}</small></div></li>)}</ol>:<p className="muted">{t("noActivityLoggedYet")}</p>}</section>{error&&<ErrorNotice text={error}/>}
    {canWrite&&<Button variant="danger" onClick={()=>open({kind:"archive",record:r})}>{t("archiveRecord")}</Button>}
  </Modal>;
}
