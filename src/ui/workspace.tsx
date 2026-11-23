"use client";
import {RegionalContext,changeCalendar,useCopy,useFormatting} from "../i18n/client";
import {bilingual,pluralName,isolate,message} from "../i18n/messages";
import {defaultRegion,resolveLocale,type Calendar} from "../i18n/config";

import {ArrowRight,ArrowUpRight,Bell,Building2,Check,ChevronRight,ChevronsUpDown,ClipboardList,Columns3,Command,Home,Layers3,LogOut,Menu,Plus,Search,Settings2,Sparkles,Workflow} from "lucide-react";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import {Dialogs,RecordDrawer} from "./forms";
import {Board,Overview,RecordTable,TasksPage} from "./pages";
import {Avatar,Button,Empty,ErrorNotice,Form,formText,Input,Modal,ObjectIcon} from "./primitives";
import {LanguageSwitch} from "./regional";
import {auditLabel} from "../i18n/audit";
import type {Bootstrap,Detail,DialogState,Execute,Filters,ListData,ObjectDef,Read,Space,User} from "./types";

async function api<T>(path:string,method="GET",data?:unknown):Promise<T> {
  const fallback=()=>message(resolveLocale(document.documentElement.lang),"requestFailed");
  const result=await fetch(path,{method,cache:"no-store",headers:data===undefined?undefined:{"Content-Type":"application/json"},body:data===undefined?undefined:JSON.stringify(data)}).catch(()=>{throw new Error(fallback());});
  const response=await result.json().catch(()=>{throw new Error(fallback());});
  if(!result.ok) throw new Error(response.error||fallback());
  return response as T;
}
const roleKey={owner:"workspaceOwner",admin:"admin",member:"member",viewer:"viewer"} as const;
const fieldKey={text:"shortText",longtext:"longText",decimal:"decimal",number:"number",currency:"currency",date:"date",timestamp:"dateAndTime",boolean:"checkbox",email:"email",phone:"phone",url:"url",select:"singleSelect",multi:"multiSelect"} as const;
const brand=<span className="brand-emblem" aria-hidden="true"><i/><i/><i/></span>;
function Loading(){
  const t=useCopy();return <div className="app-loading" role="status">{brand}<span>{t("openingCairn")}</span></div>;}
type Session={user:User|null;spaces:Space[]};
type SearchResult={id:string;title:string;object:string;object_fa?:string|null};
type CopilotResponse={threadId:string;text:string;refs:{ref:string;recordId:string;title:string}[];action?:{id:string;recordTitle:string;expires_at:string;payload:{title:string;dueDate:string|null;assigneeId:string}}};

export default function Workspace({invitation}:{invitation?:{workspace:string;token:string}}) {
  const t=useCopy();
  const [session,setSession]=useState<Session>();
  const [authError,setAuthError]=useState("");
  const [spaceId,setSpaceId]=useState("");
  const [creating,setCreating]=useState(false);
  const [workspaceForm,setWorkspaceForm]=useState(false);
  const [invitationHandled,setInvitationHandled]=useState(false);
  const refreshSession=useCallback(async()=>{
    const result=await api<Session>("/api/auth");
    setSession(result);setAuthError("");
    setSpaceId(current=>{
      let remembered="";
      try {if(result.user) remembered=localStorage.getItem("cairn.workspace."+result.user.id)??"";} catch {/* storage disabled */}
      return [current,remembered].find(id=>result.spaces.some(space=>space.id===id))??(process.env.NEXT_PUBLIC_CRM_DEMO==="1"?result.spaces.find(s=>s.name==="Studio North")?.id:undefined)??result.spaces[0]?.id??"";
    });
  },[]);
  useEffect(()=>{void refreshSession().catch(error=>setAuthError(error.message));},[refreshSession]);
  useEffect(()=>{
    if(!session?.user||!spaceId)return;
    try {if(session.spaces.some(space=>space.id===spaceId))localStorage.setItem("cairn.workspace."+session.user.id,spaceId);} catch {/* storage disabled */}
  },[session,spaceId]);
  const inviteComplete=useCallback(async()=>{
    if(!invitation)return;
    await api("/api/crm/"+invitation.workspace,"POST",{action:"accept",data:invitation.token});
    await refreshSession();
    setInvitationHandled(true);
    setSpaceId(invitation.workspace);
    history.replaceState(null,"","/");
  },[invitation,refreshSession]);
  if(authError&&!session) return <div className="plain-center"><ErrorNotice text={authError} retry={()=>void refreshSession().catch(e=>setAuthError(e.message))}/></div>;
  if(!session)return <Loading/>;
  if(!session.user)return <div className="auth-shell">
    <section className="auth-form"><div className="auth-brand">{brand} {t("brandName")}</div><div className="auth-language"><LanguageSwitch/></div><div className="auth-fields"><h1>{creating?t("createYourAccount"):t("welcomeToCairn")}</h1><p>{invitation?t("signInWithTheEmailAddressOnYourInvitation"):t("signInToYourRelationshipWorkspace")}</p><Form key={String(creating)} action={creating?t("createAccount"):t("signIn")} onSave={async f=>{await api("/api/auth","POST",{email:formText(f,"email"),password:String(f.get("password")??""),...(creating&&invitation?{...invitation,name:formText(f,"name")}:{})});await refreshSession();if(creating&&invitation){setInvitationHandled(true);setSpaceId(invitation.workspace);history.replaceState(null,"","/");}}}>{creating&&<Input label={t("yourName")} name="name" required/>}<Input label={t("emailAddress")} name="email" type="email" required/><Input label={t("password")} name="password" type="password" required/></Form>{invitation&&<Button variant="ghost" onClick={()=>setCreating(!creating)}>{creating?t("signInToAnExistingAccount"):t("useInvitationToCreateAnAccount")}</Button>}</div></section>
    <section className="auth-art" aria-label={t("brandName")}><span className="auth-topline">{t("cairnCrm")}</span><div className="auth-orbit"><i/><i/><i/><div>{brand}</div></div><div className="auth-statement"><h2>{t("everyRelationship")}<br/>{t("everyNextStep")}</h2><p>{t("recordsFollowUpsAndPipelinesInOneWorkspace")}</p></div></section>
  </div>;
  const user=session.user;
  const current=session.spaces.find(s=>s.id===spaceId);
  const signOut=()=>void api("/api/auth","DELETE").then(refreshSession).catch(error=>setAuthError(error.message));
  const newWorkspace=()=>setWorkspaceForm(true);
  const workspaceModal=workspaceForm&&<WorkspaceForm close={()=>setWorkspaceForm(false)} created={async id=>{
    await refreshSession();
    history.replaceState(null,"","/");
    setSpaceId(id);
    setWorkspaceForm(false);
  }}/>;
  if(!current) return <div className="plain-center"><div>{brand}<LanguageSwitch/><h1>{t("noWorkspaceYet")}</h1><p>{t("acceptAnInvitationToJoinAWorkspace")}</p>{invitation&&<Form action={t("acceptInvitation")} onSave={inviteComplete}><p>{t("signedInAs",{email:isolate(user.email)})}</p></Form>}<div className="row-actions"><Button variant="primary" onClick={newWorkspace}>{t("newWorkspace")}</Button><Button onClick={signOut}>{t("signOut")}</Button></div>{authError&&<ErrorNotice text={authError}/>}</div>{workspaceModal}</div>;
  return <><Shell key={current.id} user={user} workspace={current} spaces={session.spaces} pick={setSpaceId} newWorkspace={newWorkspace} signOut={signOut} authError={authError} acceptInvite={invitation&&!invitationHandled?inviteComplete:undefined}/>{workspaceModal}</>;
}
function WorkspaceForm({close,created}:{close:()=>void;created:(id:string)=>Promise<void>}) {
  const t=useCopy();
  const [requestId]=useState(()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,"0")).join(""));
  return <Modal title={t("newWorkspace")} description={t("workspaceCreateHelp")} close={close}>
    <Form action={t("createWorkspace")} cancel={close} onSave={async form=>{
      const result=await api<{id:string}>("/api/workspaces","POST",{name:formText(form,"name"),requestId});
      await created(result.id);
    }}><Input name="name" label={t("workspaceName")} required/></Form>
  </Modal>;
}
function Shell({user,workspace,spaces,pick,newWorkspace,signOut,authError,acceptInvite}:{user:User;workspace:Space;spaces:Space[];pick:(id:string)=>void;newWorkspace:()=>void;signOut:()=>void;authError:string;acceptInvite?:()=>Promise<void>}) {
  const t=useCopy();
  const {locale}=useFormatting();
  const [data,setData]=useState<Bootstrap>();
  const [page,setPage]=useState("overview");
  const [filters,setFilters]=useState<Filters>({});
  const [loaded,setLoaded]=useState<{surface:string;value:ListData}>();
  const [loadingList,setLoadingList]=useState(false);
  const [dialog,setDialog]=useState<DialogState>();
  const [detailId,setDetailId]=useState("");
  const [detail,setDetail]=useState<Detail>();
  const [showSearch,setShowSearch]=useState(false);
  const [copilot,setCopilot]=useState(false);
  const [showNotifications,setShowNotifications]=useState(false);
  const [showAccept,setShowAccept]=useState(Boolean(acceptInvite));
  const [mobileNav,setMobileNav]=useState(false);
  const [error,setError]=useState("");
  const [toast,setToast]=useState("");
  const [generation,setGeneration]=useState(0);
  const endpoint="/api/crm/"+workspace.id;
  const read=useCallback<Read>((params)=>api(endpoint+"?"+new URLSearchParams(params)),[endpoint]);
  const exec=useCallback<Execute>((action,data)=>api(endpoint,"POST",{action,data}),[endpoint]);
  const refresh=()=>setGeneration(g=>g+1);
  const go=useCallback((next:string)=>{
    setPage(next);setFilters({});setMobileNav(false);setError("");
    window.history.replaceState(null,"",next==="overview"?location.pathname:"#"+next);
  },[]);
  useEffect(()=>{
    const hash=window.location.hash.slice(1);
    if(/^(overview|tasks|settings|workflow|pipeline(?:\/[a-f0-9-]+){0,2}|object\/[a-f0-9-]+)$/.test(hash)) setPage(hash);
  },[]);
  useEffect(()=>{
    let live=true;
    read<Bootstrap>({kind:"bootstrap"}).then(value=>{if(live)setData(value);}).catch(e=>{if(live)setError(e.message);});
    return ()=>{live=false;};
  },[read,generation]);
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k") {e.preventDefault();setShowSearch(s=>!s);}
    };
    window.addEventListener("keydown",key);
    return ()=>window.removeEventListener("keydown",key);
  },[]);
  const [section,sub,stage]=page.split("/");
  const selectedObject=data?.objects.find(o=>o.id===sub);
  const pipeline=section==="pipeline"?(data?.pipelines.find(p=>p.id===sub)??data?.pipelines[0]):undefined;
  const listObject=section==="object"?selectedObject?.id:pipeline?.object_id;
  const surface=[section,listObject,pipeline?.id,stage].join("|");
  useEffect(()=>{
    if(!listObject)return;
    let live=true;
    setLoadingList(true);
    const timer=setTimeout(()=>{
      const params:Record<string,string>={kind:"list",objectId:listObject};
      if(pipeline) {params.limit="100";params.pipelineId=pipeline.id;}
      if(stage) params.stageId=stage;
      for(const [key,value] of Object.entries(filters)) if((typeof value==="string"&&value)||typeof value==="number") params[key]=String(value);
      read<ListData>(params).then(value=>{if(live){setLoaded({surface,value});setError("");}}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoadingList(false);});
    },130);
    return ()=>{live=false;clearTimeout(timer);};
  },[read,generation,listObject,pipeline,stage,filters,surface]);
  useEffect(()=>{
    if(!detailId)return;
    let live=true;
    read<Detail>({kind:"detail",id:detailId}).then(value=>{if(live)setDetail(value);}).catch(e=>{if(live){setError(e.message);setDetailId("");}});
    return ()=>{live=false;};
  },[read,detailId,generation]);
  useEffect(()=>{
    if(!toast)return;
    const timer=setTimeout(()=>setToast(""),3500);
    return ()=>clearTimeout(timer);
  },[toast]);
  const showRecord=(id:string)=>{setShowSearch(false);setCopilot(false);setDetailId(id);};
  const closeRecord=()=>{setDetailId("");setDetail(undefined);};
  const done=(message:string)=>{if(dialog?.kind==="archive")closeRecord();setDialog(undefined);setToast(message);refresh();};
  const fail=(e:unknown)=>setError(e instanceof Error?e.message:t("somethingWentWrong"));
  const perform=(action:string,input:unknown,message:string)=>exec(action,input).then(()=>{setToast(message);refresh();}).catch(fail);
  const write=data?.role!=="viewer";
  const manage=data?.role==="owner"||data?.role==="admin";
  const currentList=loaded?.surface===surface?loaded.value:undefined;
  const currentTitle=selectedObject?pluralName(locale,selectedObject):({overview:t("overview"),tasks:t("tasks"),pipeline:t("pipeline"),workflow:t("automations"),settings:t("settings")}[section]??t("overview"));
  const nav=[{id:"overview",name:t("overview"),icon:Home},{id:"pipeline",name:t("pipeline"),icon:Columns3},{id:"tasks",name:t("tasks"),icon:ClipboardList}];
  const props=data?{data,open:setDialog,go,detail:showRecord,canWrite:write}:undefined;
  return <RegionalContext.Provider value={data?.region??defaultRegion}><div className={"shell "+(mobileNav?"nav-open":"")}>
    <a className="skip" href="#main-content">{t("skipToContent")}</a>
    <aside className="sidebar">
      <button className="brand" onClick={()=>go("overview")}>{brand}<span>{t("brandName")}</span></button>
      <div className="space-switch"><span className="space-icon"><Building2 size={16}/></span><label><span className="sr-only">{t("workspace")}</span><select aria-label={t("workspace")} value={workspace.id} onChange={e=>{window.history.replaceState(null,"",location.pathname);pick(e.target.value);}}>{spaces.map(s=><option dir="auto" value={s.id} key={s.id}>{s.name}</option>)}</select><small>{t("workspace")}</small></label><ChevronsUpDown size={14} aria-hidden="true"/></div>
      <Button variant="ghost" className="rail-search workspace-new" onClick={newWorkspace}><Plus size={17}/><span>{t("newWorkspace")}</span></Button>
      <Button variant="ghost" className="rail-search" onClick={()=>setShowSearch(true)}><Search size={17}/><span>{t("searchWorkspace")}</span><kbd dir="ltr" aria-hidden="true">Ctrl K</kbd></Button>
      <nav aria-label={t("workspaceNavigation")}>
        <div className="nav-group"><div className="nav-label">{t("workspace")}</div>{nav.map(({id,name,icon:Icon})=><button key={id} aria-current={section===id?"page":undefined} className={"nav-item "+(section===id?"selected":"")} onClick={()=>go(id)}><Icon size={18}/><span>{name}</span></button>)}</div>
        <div className="nav-group"><div className="nav-label">{t("records")}{manage&&<Button variant="ghost" className="square nav-add" aria-label={t("newObject")} title={t("newObject")} onClick={()=>setDialog({kind:"object"})}><Plus size={15}/></Button>}</div>{data?.objects.map(o=><button key={o.id} aria-current={selectedObject?.id===o.id?"page":undefined} className={"nav-item "+(selectedObject?.id===o.id?"selected":"")} onClick={()=>go("object/"+o.id)}><ObjectIcon name={o.icon}/><span dir="auto">{pluralName(locale,o)}</span></button>)}</div>
        <div className="nav-group"><div className="nav-label">{t("tools")}</div>{manage&&<button className={"nav-item "+(section==="workflow"?"selected":"")} aria-current={section==="workflow"?"page":undefined} onClick={()=>go("workflow")}><Workflow size={17}/><span>{t("automations")}</span></button>}<button className={"nav-item "+(section==="settings"?"selected":"")} aria-current={section==="settings"?"page":undefined} onClick={()=>go("settings")}><Settings2 size={17}/><span>{t("settings")}</span></button></div>
      </nav>
      <div className="sidebar-bottom"><div className="account"><Avatar name={user.name}/><span><strong><bdi dir="auto">{user.name}</bdi></strong><small>{t(roleKey[workspace.role])}</small></span><Button variant="ghost" aria-label={t("signOut")} className="square" onClick={signOut}><LogOut size={16}/></Button></div></div>
    </aside>
    <div className="work-area">
      <header className="topbar"><div className="crumbs"><Button variant="ghost" className="square mobile-menu" aria-label={t("toggleNavigation")} aria-expanded={mobileNav} onClick={()=>setMobileNav(!mobileNav)}><Menu size={21}/></Button><button onClick={()=>go("overview")} className="crumb-home"><bdi dir="auto">{workspace.name}</bdi></button><ChevronRight size={15}/><strong>{currentTitle}</strong></div><div className="top-actions"><LanguageSwitch/><Button variant="ghost" className="square" aria-label={t("notifications")} onClick={()=>setShowNotifications(true)}><Bell size={18}/>{data?.notifications.length? <span className="bell-dot"/>:null}</Button><Button className="copilot-launch" aria-label={t("copilot")} onClick={()=>setCopilot(true)}><Sparkles size={16}/> <span className="copilot-label">{t("copilot")}</span></Button></div></header>
      <main id="main-content" tabIndex={-1}>
        {(error||authError)&&<div className="page-error"><ErrorNotice text={error||authError} retry={()=>{setError("");refresh();}}/></div>}
        {!props||!data?<Loading/>:section==="overview"?<Overview {...props} userName={user.name}/>
        :section==="tasks"?<TasksPage {...props} taskChange={task=>void perform("taskStatus",{id:task.id,status:task.status==="open"?"done":"open"},t("taskUpdated"))}/>
        :section==="pipeline"?<Board {...props} pipeline={pipeline} result={currentList} selectedStage={stage} canManage={manage} move={(row,pipeline,stageId)=>{
          if(!currentList)return Promise.resolve();
          return perform("saveRecord",{id:row.id,version:row.version,revision:currentList.object.revision,objectId:row.object_id,title:row.title,ownerId:row.owner_id,pipelineId:pipeline.id,stageId},t("stageUpdated"));
        }}/>
        :section==="object"&&selectedObject?(currentList?<RecordTable key={selectedObject.id} {...props} result={currentList} object={selectedObject} filters={filters} setFilters={setFilters} canManage={manage} workspace={workspace.id} loading={loadingList} restore={r=>void perform("restoreRecord",{id:r.id,version:r.version},t("recordRestored"))} changeMode={()=>go("pipeline/"+data.pipelines.find(p=>p.object_id===selectedObject.id)?.id)}/>:<Loading/>)
        :section==="settings"?<Settings data={data} read={read} manage={manage} perform={perform} open={setDialog} refreshKey={generation}/>
        :section==="workflow"&&manage?<Automations data={data} open={setDialog} retry={id=>void perform("retryWorkflowJob",id,t("jobQueued"))} toggle={(id,enabled)=>void perform("setWorkflow",{id,enabled},enabled?t("automationEnabled"):t("automationPaused"))}/>
        :<div className="page"><Empty title={t("thisPageIsnTAvailable")}>{t("chooseAWorkspaceAreaFromTheNavigation")}</Empty></div>}
      </main>
    </div>
    {toast&&<div className="toast" role="status"><Check size={17}/>{toast}</div>}
    {showSearch&&<SearchDialog read={read} close={()=>setShowSearch(false)} select={showRecord}/>}
    {showNotifications&&<Modal title={t("notifications")} description={t("updatesAssignedToYouInThisWorkspace")} close={()=>setShowNotifications(false)}>{data?.notifications.length?<ul className="notification-list">{data.notifications.map(n=><li key={n.id}><Bell size={16}/><bdi dir="auto">{n.message}</bdi></li>)}</ul>:<Empty title={t("youReAllCaughtUp")} icon={<Bell size={23}/>}>{t("newWorkspaceNotificationsAppearHere")}</Empty>}</Modal>}
    {detail&&detail.record.id===detailId&&data&&!dialog&&!copilot&&<RecordDrawer detail={detail} data={data} close={closeRecord} open={setDialog} go={showRecord} copilot={()=>setCopilot(true)} exec={exec} refresh={refresh} canWrite={write}/>}
    {dialog&&data&&<Dialogs key={dialog.kind+"-"+(dialog.record?.id??"")} state={dialog} data={data} exec={exec} read={read} close={()=>setDialog(undefined)} done={done} refresh={refresh}/>}
    {copilot&&data&&<Copilot mode={data.aiMode} people={data.people} record={detail} exec={exec} close={()=>setCopilot(false)} go={showRecord} enable={()=>{setCopilot(false);go("settings");}} refresh={refresh}/>}
    {showAccept&&acceptInvite&&<Modal title={t("joinAWorkspace")} description={t("acceptAs",{email:isolate(user.email)})} close={()=>setShowAccept(false)}><Form action={t("acceptInvitation")} onSave={async()=>{await acceptInvite();setShowAccept(false);}}><p>{t("youLlBeSwitchedToTheInvitedWorkspace")}</p></Form></Modal>}
  </div></RegionalContext.Provider>;
}
function SearchDialog({read,close,select}:{read:Read;close:()=>void;select:(id:string)=>void}) {
  const t=useCopy();
  const {locale}=useFormatting();
  const [q,setQ]=useState(""),[hits,setHits]=useState<SearchResult[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  useEffect(()=>{
    if(!q.trim()){setHits([]);return;}
    let live=true;setBusy(true);
    const timer=setTimeout(()=>{read<SearchResult[]>({kind:"search",q}).then(result=>{if(live)setHits(result);}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setBusy(false);});},180);
    return ()=>{live=false;clearTimeout(timer);};
  },[q,read]);
  return <Modal title={t("searchWorkspace")} description={t("findRecordsByName")} close={close}><label className="search-field search-modal"><Search size={18}/><input dir="auto" autoFocus aria-label={t("searchAllRecords")} value={q} onChange={e=>{setQ(e.target.value);setError("");}} placeholder={t("searchForARecord")}/></label>{error&&<ErrorNotice text={error}/>}<div className="search-results">{q.trim()?(busy?<p role="status">{t("searching")}</p>:hits.length?hits.map(hit=><button key={hit.id} onClick={()=>select(hit.id)}><Layers3 size={17}/><span><bdi dir="auto">{hit.title}</bdi><small>{locale==="fa-IR"?hit.object_fa??hit.object:hit.object}</small></span><ArrowUpRight size={15}/></button>):<p>{t("noMatchingRecordsText")}</p>):<p><Command size={16}/> {t("searchAcrossAllObjectsInThisWorkspace")}</p>}</div></Modal>;
}
function Settings({data,read,manage,perform,open,refreshKey}:{data:Bootstrap;read:Read;manage:boolean;perform:(action:string,arg:unknown,message:string)=>Promise<void>;open:(state:DialogState)=>void;refreshKey:number}) {
  const t=useCopy();
  const {locale,number,date,calendar}=useFormatting();
  const [tab,setTab]=useState(t("objects")),[selected,setSelected]=useState<ObjectDef>(),[model,setModel]=useState<ListData>(),[error,setError]=useState("");
  useEffect(()=>{
    if(!selected)return;
    let active=true;
    read<ListData>({kind:"list",objectId:selected.id,limit:"1"}).then(r=>{if(active)setModel(r);}).catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;};
  },[selected,read,refreshKey]);
  const tabs=[t("objects"),t("pipelines"),t("relationships"),t("members"),t("copilot"),t("regionalSettings"),...(manage?[t("audit")]:[])];
  const action=tab===t("objects")?{kind:selected?"field":"object",name:selected?t("addField"):t("newObject"),object:selected}:tab===t("relationships")?{kind:"relation",name:t("newRelationship")}:tab===t("members")?{kind:"invite",name:t("inviteMember")}:tab===t("pipelines")?{kind:"pipeline",name:t("newPipeline")}:undefined;
  return <div className="page settings-page"><div className="page-head"><div><h1>{t("workspaceSettings")}</h1><p>{t("shapeHowYourTeamWorksInCairn")}</p></div>{manage&&action&&<Button variant="primary" onClick={()=>open(action)}><Plus size={16}/> {action.name}</Button>}</div>
    <div className="view-tabs">{tabs.map(t=><Button key={t} variant="ghost" className={t===tab?"active":""} onClick={()=>{setTab(t);setError("");setSelected(undefined);}}>{t}</Button>)}</div>
    {error&&<ErrorNotice text={error}/>}
    {tab===t("objects")&&<section className="surface settings-panel"><div className="panel-head"><div><h2>{selected?pluralName(locale,selected):t("dataModel")}</h2><p>{selected?t("fieldsAvailableOnThisObject"):t("objectsDefineTheRecordsYourTeamTracks")}</p></div>{selected&&<div className="row-actions">{manage&&model?.object.id===selected.id&&<Button onClick={()=>open({kind:"layout",object:model.object,fields:model.fields})}>{t("editLayout")}</Button>}<Button onClick={()=>{setSelected(undefined);setModel(undefined);}}>{t("allObjects")}</Button></div>}</div>
      {selected?(model?.object.id===selected.id?(model.fields.length?model.fields.map(f=><div className="setting-row" key={f.id}><Layers3 size={17}/><div><strong dir="auto">{bilingual(locale,f)}</strong><small>{t(fieldKey[f.kind])}{f.required?" · "+t("required"):""}</small></div>{manage&&<Button onClick={()=>void perform("archiveField",{objectId:selected.id,fieldId:f.id},t("fieldArchived"))}>{t("archive")}</Button>}</div>):<Empty title={t("noCustomFields")}>{t("everyRecordHasANameAndCanHaveAnOwner")}</Empty>):<p className="settings-note" role="status">{t("loadingFields")}</p>):<>{data.objects.map(o=><button className="setting-row setting-button" key={o.id} onClick={()=>{setModel(undefined);setSelected(o);}}><span className="metric-icon blue"><ObjectIcon name={o.icon}/></span><span><strong dir="auto">{pluralName(locale,o)}</strong><small>{t("schemaRevision")} {number(o.revision)}</small></span><ChevronRight size={17}/></button>)}{manage&&<div className="template-row"><h3>{t("starterTemplates")}</h3><p>{t("installObjectsAndStagesForABusinessProcess")}</p><Button onClick={()=>void perform("applyTemplate","consulting",t("consultingTemplateReady"))}>{t("consulting")}</Button> <Button onClick={()=>void perform("applyTemplate","recruitment",t("recruitmentTemplateReady"))}>{t("recruitment")}</Button></div>}</>}
    </section>}
    {tab===t("pipelines")&&<section className="surface settings-panel"><div className="panel-head"><div><h2>{t("pipelines")}</h2><p>{t("orderedStagesForAWorkspaceObject")}</p></div></div>{data.pipelines.length?data.pipelines.map(p=><div className="setting-row" key={p.id}><Columns3 size={18}/><div><strong dir="auto">{bilingual(locale,p)}</strong><small>{p.stages.map(s=>isolate(bilingual(locale,s))).join(locale==="fa-IR"?" ← ":" → ")}</small></div>{manage&&<Button onClick={()=>open({kind:"pipeline",pipeline:p})}>{t("editPipeline")}</Button>}</div>):<Empty title={t("noPipelinesConfigured")}>{t("addAPipelineToTrackProgress")}</Empty>}</section>}
    {tab===t("relationships")&&<section className="surface settings-panel"><div className="panel-head"><div><h2>{t("relationships")}</h2><p>{t("connectionsAvailableBetweenRecords")}</p></div></div>{data.relations.length?data.relations.map(r=><div className="setting-row" key={r.id}><Layers3 size={18}/><div><strong dir="auto">{locale==="fa-IR"?r.label_fa??r.label:r.label}</strong><small>{t(r.cardinality==="one-one"?"oneToOne":r.cardinality==="one-many"?"oneToMany":"manyToMany")}</small></div></div>):<Empty title={t("noRelationshipsConfigured")}>{t("createARelationshipInSettingsFirst")}</Empty>}</section>}
    {tab===t("members")&&<section className="surface settings-panel"><div className="panel-head"><div><h2>{t("members")}</h2><p>{t("rolesAndAccessForThisWorkspace")}</p></div></div>{data.people.map((p,index)=><div className="setting-row" key={p.id}><Avatar name={p.name} index={index}/><div><strong dir="auto">{p.name}</strong><small><bdi dir="ltr">{p.email}</bdi></small></div>{manage&&p.role!=="owner"&&(data.role==="owner"||p.role!=="admin")?<><select className="compact" aria-label={t("roleFor",{name:isolate(p.name)})} value={p.role} onChange={e=>void perform("manageMember",{userId:p.id,active:true,role:e.target.value},t("roleUpdated"))}><option value="viewer">{t("viewer")}</option><option value="member">{t("member")}</option>{data.role==="owner"&&<option value="admin">{t("admin")}</option>}</select><Button onClick={()=>void perform("manageMember",{userId:p.id,active:false},t("accessRevoked"))}>{t("revokeAccess")}</Button></>:<span className="pill">{t(roleKey[p.role])}</span>}</div>)}</section>}
    {tab===t("copilot")&&<section className="surface settings-panel"><div className="panel-head"><div><h2>{t("copilot")}</h2><p>{t("aiIsOffUntilAWorkspaceOwnerEnablesAnAdapter")}</p></div><span className="metric-icon blue"><Sparkles size={18}/></span></div><div className="settings-note"><p>{t("currentMode")} <strong>{data.aiMode==="fixture"?t("syntheticDemo"):data.aiMode==="openai"?t("approvedProvider"):t("off")}</strong></p>{data.role==="owner"&&<div className="row-actions"><Button disabled={data.aiMode==="off"} onClick={()=>void perform("setAi","off",t("copilotDisabled"))}>{t("turnOff")}</Button>{process.env.NEXT_PUBLIC_CRM_DEMO==="1"&&<Button onClick={()=>void perform("setAi","fixture",t("demoCopilotEnabled"))}>{t("useSyntheticDemo")}</Button>}<Button onClick={()=>void perform("setAi","openai",t("copilotEnabled"))}>{t("enableApprovedProvider")}</Button></div>}</div></section>}
    {tab===t("regionalSettings")&&<section className="surface settings-panel">
      <div className="panel-head"><div><h2>{t("regionalSettings")}</h2><p>{t("regionalIntro")}</p></div></div>
      <div className="settings-note regional-settings">
      <div><label className="field"><span>{t("calendar")}</span><select value={calendar} onChange={event=>changeCalendar(event.target.value as Calendar)}><option value="persian">{t("jalaliCalendar")}</option><option value="gregory">{t("gregorianCalendar")}</option></select></label></div>
      {manage?<Form onSave={async form=>perform("saveRegion",{currency:formText(form,"currency")||null,timeZone:formText(form,"zone")},t("regionalSaved"))}>
        <Input name="currency" label={t("workspaceCurrency")} dir="ltr" value={data.region.currency??""} placeholder={t("currencyPlaceholder")}/>
        <Input name="zone" label={t("workspaceZone")} dir="ltr" value={data.region.timeZone} required/>
      </Form>:<p><bdi dir="ltr">{data.region.currency??t("noCurrency")}</bdi> · <bdi dir="ltr">{data.region.timeZone}</bdi></p>}
      </div>
    </section>}
    {tab===t("audit")&&<section className="surface settings-panel"><div className="panel-head"><div><h2>{t("auditActivity")}</h2><p>{t("recentPermissionsAndConfigurationChanges")}</p></div></div>{data.audit.map(a=><div key={a.id} className="setting-row"><ClipboardList size={17}/><strong>{auditLabel(locale,a.event)}</strong><small>{date(a.created_at)}</small></div>)}</section>}
  </div>;
}
function Automations({data,open,toggle,retry}:{data:Bootstrap;open:(state:DialogState)=>void;toggle:(id:string,on:boolean)=>void;retry:(id:string)=>void}) {
  const t=useCopy();
  return <div className="page"><div className="page-head"><div><h1>{t("automations")}</h1><p>{t("turnRoutineChangesIntoConsistentNextSteps")}</p></div><Button variant="primary" onClick={()=>open({kind:"workflow"})}><Plus size={16}/> {t("newAutomation")}</Button></div><section className="surface settings-panel"><div className="panel-head"><div><h2>{t("workspaceRules")}</h2><p>{t("stageAndScheduleTriggers")}</p></div></div>{data.workflows.length?data.workflows.map(flow=><div className="setting-row" key={flow.id}><span className="metric-icon purple"><Workflow size={18}/></span><div><strong dir="auto">{flow.name}</strong><small>{flow.trigger==="stage"?t("stageChange"):t("schedule")} · {t("runCount",{count:flow.runs})}</small></div><span className="pill">{flow.enabled?t("active"):t("paused")}</span><Button onClick={()=>toggle(flow.id,!flow.enabled)}>{flow.enabled?t("pause"):t("enable")}</Button></div>):<Empty title={t("noAutomationsYet")} icon={<Workflow size={24}/>}>{t("createARuleToAssignRecordsAddTasksOrSendInAppNotifications")}</Empty>}</section>
    {data.failedJobs.length>0&&<section className="surface settings-panel"><div className="panel-head"><h2>{t("jobsNeedingAttention")}</h2></div>{data.failedJobs.map(job=><div className="setting-row" key={job.id}><span className="metric-icon purple"><Workflow size={18}/></span><div><strong>{t("failedJob")}</strong><small>{t("jobAttempts",{count:job.attempts})} · <bdi dir="ltr">{job.id.slice(0,8)}</bdi></small></div><Button onClick={()=>retry(job.id)}>{t("retryJob")}</Button></div>)}</section>}</div>;
}
function Copilot({mode,people,record,exec,close,go,enable,refresh}:{mode:string;people:Bootstrap["people"];record?:Detail;exec:Execute;close:()=>void;go:(id:string)=>void;enable:()=>void;refresh:()=>void}) {
  const t=useCopy();
  const {date}=useFormatting();
  const [messages,setMessages]=useState<{question:string;answer:CopilotResponse}[]>([]),[draft,setDraft]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[status,setStatus]=useState<Record<string,string>>({});
  async function ask(question:string) {
    if(!question.trim()||busy)return;
    setBusy(true);setError("");
    try{
      const answer=await exec<CopilotResponse>("ask",{question,recordId:record?.record.id,threadId:messages.at(-1)?.answer.threadId});
      setMessages([...messages,{question,answer}]);setDraft("");
    }catch(e){setError(e instanceof Error?e.message:t("copilotIsUnavailable"));}
    finally{setBusy(false);}
  }
  async function respond(id:string,approve:boolean) {
    setError("");
    try{await exec("resolveAction",{id,approve});setStatus({...status,[id]:approve?t("taskCreated"):t("dismissed")});refresh();}
    catch(e){setError(e instanceof Error?e.message:t("theActionCouldNotBeUpdated"));}
  }
  function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();void ask(draft);}
  return <Modal drawer title={t("copilot")} description={record?record.record.title:mode==="fixture"?t("syntheticDemoWorkspace"):t("askAboutThisWorkspace")} close={close}>
    {mode==="off"?<><Empty title={t("copilotIsOff")} icon={<Sparkles size={24}/>}>{t("aWorkspaceOwnerCanEnableAnApprovedAiProviderInSettings")}</Empty><Button onClick={enable}>{t("openSettings")} <ArrowRight size={15}/></Button></>:<>
    {!messages.length&&<div className="copilot-empty"><span className="metric-icon blue"><Sparkles size={20}/></span><h3>{record?t("exploreThisRecord"):t("whatSHappeningAcrossYourWorkspace")}</h3><p>{t("answersLinkToTheRecordsTheyUse")}</p>{(record?[t("summarizeThisRecord"),t("prepareAFollowUpTask")]:[t("whichRecordsHavenTHadContactIn14Days"),t("summarizeRecentOpportunities")]).map(text=><Button key={text} onClick={()=>void ask(text)} disabled={busy}>{text}<ArrowUpRight size={14}/></Button>)}</div>}
    <div className="conversation" aria-live="polite">{messages.map(({question,answer},index)=><div key={index}><p className="chat-user" dir="auto">{question}</p><div className="chat-answer"><Sparkles size={17}/><div><p dir="auto">{answer.text}</p>{answer.refs.length>0&&<div className="citations">{answer.refs.map(ref=><button key={ref.ref} onClick={()=>go(ref.recordId)}><bdi dir="auto">{ref.title}</bdi><ArrowUpRight size={12}/></button>)}</div>}</div></div>
    {answer.action&&<div className="approval"><h4>{t("proposedTask")}</h4><dl><div><dt>{t("title")}</dt><dd><bdi dir="auto">{answer.action.payload.title}</bdi></dd></div><div><dt>{t("record")}</dt><dd><bdi dir="auto">{answer.action.recordTitle}</bdi></dd></div><div><dt>{t("assignee")}</dt><dd><bdi dir="auto">{people.find(p=>p.id===answer.action?.payload.assigneeId)?.name??t("unassigned")}</bdi></dd></div><div><dt>{t("due")}</dt><dd>{date(answer.action.payload.dueDate)}</dd></div><div><dt>{t("expires")}</dt><dd>{date(answer.action.expires_at,{hour:"numeric",minute:"2-digit"})}</dd></div></dl>{status[answer.action.id]?<strong>{status[answer.action.id]}</strong>:<div className="row-actions"><Button onClick={()=>void respond(answer.action!.id,false)}>{t("dismiss")}</Button><Button variant="primary" onClick={()=>void respond(answer.action!.id,true)}>{t("approveAndAddTask")}</Button></div>}</div>}
    </div>)}</div>{error&&<ErrorNotice text={error}/>}<form className="copilot-form" onSubmit={submit}><label className="field"><span className="sr-only">{t("askCopilot")}</span><textarea dir="auto" placeholder={t("askAboutThisWorkspaceText")} value={draft} onChange={e=>setDraft(e.target.value)} maxLength={1000} required/></label><Button variant="primary" disabled={busy||!draft.trim()}>{busy?t("lookingUpRecords"):t("send")} <ArrowRight size={16}/></Button></form>
    </>}
  </Modal>;
}
