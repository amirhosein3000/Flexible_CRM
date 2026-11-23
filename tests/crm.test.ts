import assert from "node:assert/strict";
import {after,test} from "node:test";
import {createHash,randomBytes,randomUUID} from "node:crypto";
import {cookie,getToken,session,signIn,signOut,spaces} from "../src/domain/auth.ts";
import {embedded} from "../src/domain/demo.ts";
import {addField,addTask,archiveRecord,restoreRecord,setLayout,updatePipeline,list,objects,pipelines,record,saveRecord,tasks} from "../src/domain/crm.ts";
import {ask,resolveAction,setAi} from "../src/domain/ai.ts";
import {rows,transaction,withScope} from "../src/domain/db.ts";
import {addRelation,commitImport,createWorkspace,csvCell,decodeCsv,exportCsv,link,manageMember,previewImport,registerInvited,saveView,invite} from "../src/domain/workspace.ts";
import {retryWorkflowJob,runWorkspace,saveWorkflow,workflowHistory} from "../src/domain/workflows.ts";
import {nextOccurrence} from "../src/domain/schedule.ts";
import {regionalSettings,saveRegion} from "../src/domain/region.ts";
import {canonicalNumber,formatDate,formatNumber,parseDateInput,parseTimestampInput} from "../src/i18n/format.ts";
import {errorText} from "../src/i18n/errors.ts";
import {csvColumns} from "../src/i18n/csv-columns.ts";
import {dictionaries} from "../src/i18n/messages.ts";
import {normalize} from "../src/domain/validation.ts";

process.env.CRM_DEMO="1";
process.env.CRM_EMBEDDED_DEMO="1";
process.env.CRM_EMBEDDED_WORKER="0";
after(async()=>{await (await embedded()).close();});
const password="Cairn-demo-2026!";
async function login(email="demo@cairn.example") {
  const token=await signIn(email,password);
  const request=new Request("http://local.invalid",{headers:{cookie:cookie(token).split(";")[0]}});
  const user=await session(request);assert.ok(user);
  return {user,request};
}
async function fixture() {
  const {user}=await login();
  const memberships=await spaces(user);
  const a=memberships.find(w=>w.name==="Studio North")!.id;
  const b=memberships.find(w=>w.name==="Recruiting Lab")!.id;
  const sys=await withScope(user,a,objects);
  const company=sys.find(o=>o.key==="company")!;
  const opportunity=sys.find(o=>o.key==="opportunity")!;
  const far=await withScope(user,b,async scope=>(await list(scope,(await objects(scope)).find(o=>o.key==="candidate")!.id,{})).records[0]);
  return {user,a,b,company,opportunity,far};
}
const status=(expected:number)=>(e:unknown)=>(e as {status?:number}).status===expected;
test("strict codecs, bounded exact decimals and spreadsheet output",()=>{
  const def={id:randomUUID(),name:"Price",kind:"decimal" as const,required:true,options:[],position:0};
  assert.equal(normalize(def,"0.125"),"0.125");
  assert.throws(()=>normalize(def,"5e2"),status(422));
  assert.deepEqual(decodeCsv('Title,Note\r\n"Hello, world","said ""yes"""'),[["Title","Note"],["Hello, world",'said "yes"']]);
  assert.equal(csvCell("=1+1"),"\"'=1+1\"");
});
test("session lifecycle and role-backed workspace membership",async()=>{
  const {user,request}=await login("viewer@cairn.example");
  assert.deepEqual((await spaces(user)).map(w=>w.role),["viewer"]);
  await signOut(request);
  assert.equal(await session(request),undefined);
});
test("expired sessions cannot establish a user or workspace context",async()=>{
  const {request}=await login();
  const key=createHash("sha256").update(getToken(request)!).digest("hex");
  const db=await embedded();
  await db.query("UPDATE crm.sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[key]);
  assert.equal(await session(request),undefined);
});
test("sign-in failures persist across transactions and expire",async()=>{
  const email=randomUUID()+"@cairn.example";
  for(let attempt=0;attempt<8;attempt++) await assert.rejects(signIn(email,"invalid-password"),status(401));
  await assert.rejects(signIn(email,"invalid-password"),status(429));
  const db=await embedded();
  await db.exec("UPDATE crm.sign_in_failures SET expires_at=now() WHERE key LIKE 'unknown:%'");
  await assert.rejects(signIn(email,"invalid-password"),status(401));
});
test("workspace onboarding gives only the creator ownership and replays safely",async()=>{
  const {user}=await login();
  const viewer=(await login("viewer@cairn.example")).user;
  const input={requestId:randomBytes(16).toString("hex"),name:"QA private workspace"};
  const [first,duplicate]=await Promise.all([createWorkspace(user,input),createWorkspace(user,input)]);
  assert.deepEqual(first,duplicate);
  assert.equal((await spaces(user)).find(w=>w.id===first.id)?.role,"owner");
  await assert.rejects(withScope(viewer,first.id,objects),status(404));
  await assert.rejects(createWorkspace(user,{...input,name:"Changed"}),status(409));
  assert.equal((await withScope(user,first.id,s=>rows(s.tx,"SELECT id FROM audit WHERE event='workspace.created'"))).length,1);
});
test("workflow retry preserves completed rules and requires workspace management",async()=>{
  const f=await fixture();
  const member=(await login("sam@cairn.example")).user;
  const viewer=(await login("viewer@cairn.example")).user;
  const pipe=(await withScope(f.user,f.a,pipelines))[0];
  const stage=pipe.stages.at(-1)!;
  const record=await withScope(f.user,f.a,s=>saveRecord(s,{objectId:f.opportunity.id,revision:f.opportunity.revision,title:"Workflow failure fixture"}));
  const rule={objectId:f.opportunity.id,trigger:"stage",stageId:stage.id};
  const unstable=await withScope(f.user,f.a,s=>saveWorkflow(s,{...rule,name:"QA assigned rule",steps:[{kind:"task",title:"Roll back until retry"},{kind:"task",title:"Retry only this rule",assigneeId:member.id}]}));
  await withScope(f.user,f.a,s=>saveWorkflow(s,{...rule,name:"QA healthy rule",steps:[{kind:"task",title:"Successful on first attempt"}]}));
  await withScope(f.user,f.a,s=>manageMember(s,{userId:member.id,active:false}));
  try {
    const before=await withScope(f.user,f.a,s=>list(s,f.opportunity.id,{q:"Workflow failure fixture"}));
    const version=before.records.find(item=>item.id===record.id)?.version;
    assert.ok(version);
    await withScope(f.user,f.a,s=>saveRecord(s,{id:record.id,version,objectId:f.opportunity.id,revision:f.opportunity.revision,title:"Workflow failure fixture",pipelineId:pipe.id,stageId:stage.id}));
    while(await runWorkspace(f.a)) { /* drain the fixture queue */ }
    const jobs=await withScope(f.user,f.a,s=>rows<{id:string;attempts:number}>(s.tx,"SELECT id,attempts FROM outbox WHERE workspace_id=$1 AND outcome='failed' AND payload->>'recordId'=$2",[f.a,record.id]));
    assert.equal(jobs.length,1);
    assert.equal(jobs[0].attempts,1);
    const failedHistory=await withScope(f.user,f.a,s=>workflowHistory(s,unstable.id));
    assert.deepEqual(failedHistory.steps,["task","task"]);
    assert.deepEqual(failedHistory.runs.map(run=>[run.status,run.step_index]),[["failed",1]]);
    assert.equal((await withScope(f.user,f.a,tasks)).filter(t=>t.title==="Roll back until retry").length,0);
    await assert.rejects(withScope(viewer,f.a,s=>workflowHistory(s,unstable.id)),status(403));
    await assert.rejects(withScope(f.user,f.b,s=>workflowHistory(s,unstable.id)),status(404));
    assert.equal((await withScope(f.user,f.a,tasks)).filter(t=>t.title==="Successful on first attempt").length,1);
    await assert.rejects(withScope(viewer,f.a,s=>retryWorkflowJob(s,jobs[0].id)),status(403));
    await assert.rejects(withScope(f.user,f.b,s=>retryWorkflowJob(s,jobs[0].id)),status(404));
    await withScope(f.user,f.a,s=>manageMember(s,{userId:member.id,active:true}));
    await withScope(f.user,f.a,s=>retryWorkflowJob(s,jobs[0].id));
    await assert.rejects(withScope(f.user,f.a,s=>retryWorkflowJob(s,jobs[0].id)),status(404));
    assert.equal(await runWorkspace(f.a),1);
    const finished=await withScope(f.user,f.a,tasks);
    assert.equal(finished.filter(t=>t.title==="Successful on first attempt").length,1);
    assert.equal(finished.filter(t=>t.title==="Retry only this rule").length,1);
    assert.equal(finished.filter(t=>t.title==="Roll back until retry").length,1);
    const recovered=await withScope(f.user,f.a,s=>workflowHistory(s,unstable.id));
    assert.deepEqual(recovered.runs.map(run=>[run.status,run.step_index]),[["completed",null],["failed",1]]);
  } finally {
    await withScope(f.user,f.a,s=>manageMember(s,{userId:member.id,active:true}));
  }
});
test("saved boards retain pipeline and filters and require a matching workspace pipeline",async()=>{
  const f=await fixture();
  const [pipe]=await withScope(f.user,f.a,pipelines);
  const [foreign]=await withScope(f.user,f.b,pipelines);
  const viewer=(await login("viewer@cairn.example")).user;
  const query={mode:"board",pipelineId:pipe.id,stageId:pipe.stages[0].id,q:"Platform"};
  const input={objectId:pipe.object_id,name:"Platform board",query};
  const board=await withScope(viewer,f.a,s=>saveView(s,input));
  const [stored]=await withScope(viewer,f.a,s=>rows<{query:typeof query}>(s.tx,"SELECT query FROM views WHERE workspace_id=$1 AND id=$2",[f.a,board.id]));
  assert.deepEqual(stored.query,query);
  await assert.rejects(withScope(viewer,f.a,s=>saveView(s,{...input,shared:true})),status(403));
  await assert.rejects(withScope(f.user,f.a,s=>saveView(s,{...input,query:{...query,pipelineId:foreign.id}})),status(404));
  await assert.rejects(withScope(f.user,f.a,s=>saveView(s,{...input,query:{...query,stageId:foreign.stages[0].id}})),status(404));
});
test("records, relationship endpoints, imports, workflow references, and AI are tenant constrained",async()=>{
  const f=await fixture();
  const viewer=(await login("viewer@cairn.example")).user;
  await assert.rejects(withScope(viewer,f.b,objects),status(404));
  await assert.rejects(withScope(viewer,f.a,s=>addTask(s,{title:"Forbidden"})),status(403));
  await assert.rejects(withScope(f.user,f.a,s=>record(s,f.far.id)),status(404));
  const relationship=await withScope(f.user,f.a,s=>addRelation(s,{source:f.company.id,target:f.company.id,label:"Partner",inverse:"Partner of",cardinality:"one-one"}));
  const front=await withScope(f.user,f.a,s=>list(s,f.company.id,{})).then(r=>r.records[0]);
  await assert.rejects(withScope(f.user,f.a,s=>link(s,{relation:relationship.id,source:front.id,target:f.far.id})),status(404));
  const rawScope=await transaction(tx=>rows(tx,"SELECT id FROM crm.records"));assert.equal(rawScope.length,0);
  await assert.rejects(withScope(f.user,f.a,s=>s.tx.query("INSERT INTO crm.edges(workspace_id,relation_id,source_object,target_object,source_id,target_id,cardinality) VALUES($1,$2,$3,$3,$4,$5,'one-one')",[f.a,relationship.id,f.company.id,front.id,f.far.id])),(e:unknown)=>(e as {code:string}).code==="23503");
  const localImport=await withScope(f.user,f.a,s=>previewImport(s,{objectId:f.company.id,csv:"Title\nNew customer"}));
  assert.ok(localImport.id);
  await assert.rejects(withScope(f.user,f.b,s=>commitImport(s,localImport.id)),status(404));
  assert.equal((await withScope(f.user,f.a,s=>commitImport(s,localImport.id))).count,1);
  assert.equal((await withScope(f.user,f.a,s=>commitImport(s,localImport.id))).replayed,true);
  const foreignStage=(await withScope(f.user,f.b,pipelines))[0].stages[0].id;
  await assert.rejects(withScope(f.user,f.a,s=>saveWorkflow(s,{name:"Foreign stage",objectId:f.opportunity.id,trigger:"stage",stageId:foreignStage,steps:[{kind:"task",title:"Never"}]})),status(422));
  await assert.rejects(withScope(f.user,f.a,s=>ask(s,{question:"Show data"})),status(403));
  await withScope(f.user,f.a,s=>setAi(s,"fixture"));
  await assert.rejects(withScope(f.user,f.a,s=>ask(s,{question:"Summarize this",recordId:f.far.id})),status(404));
  const answer=await withScope(f.user,f.a,s=>ask(s,{question:"Find Recruiting Lab test candidate"}));
  assert.ok(answer.refs.every(r=>r.recordId!==f.far.id));
  await assert.rejects(withScope(f.user,f.b,s=>ask(s,{question:"Continue",threadId:answer.threadId})),status(403));
  await withScope(f.user,f.b,s=>setAi(s,"fixture"));
  await assert.rejects(withScope(f.user,f.b,s=>ask(s,{question:"Continue",threadId:answer.threadId})),status(404));
});
test("metadata revision validation, typed list and saved view",async()=>{
  const f=await fixture();
  const before=await withScope(f.user,f.a,s=>list(s,f.company.id,{}));
  const field=await withScope(f.user,f.a,s=>addField(s,{objectId:f.company.id,name:"Contract value",kind:"decimal"}));
  await assert.rejects(withScope(f.user,f.a,s=>saveRecord(s,{objectId:f.company.id,revision:before.object.revision,title:"Old revision"})),status(409));
  const after=await withScope(f.user,f.a,s=>list(s,f.company.id,{}));
  await withScope(f.user,f.a,s=>saveRecord(s,{objectId:f.company.id,revision:after.object.revision,title:"Measured relationship",fields:{[field.id]:"19.50"}}));
  const result=await withScope(f.user,f.a,s=>list(s,f.company.id,{fieldId:field.id,fieldValue:"19.50",sort:field.id,dir:"asc"}));
  assert.equal(result.records[0].title,"Measured relationship");
  assert.match(await withScope(f.user,f.a,s=>exportCsv(s,f.company.id,{fieldId:field.id,fieldValue:"19.50"})),/Measured relationship/);
  assert.ok((await withScope(f.user,f.a,s=>saveView(s,{name:"High contract value",objectId:f.company.id,query:{fieldId:field.id,fieldValue:"19.50"}}))).id);
});
test("workflow worker applies ordered actions once and records scope",async()=>{
  const f=await fixture();
  const pipe=(await withScope(f.user,f.a,pipelines))[0];
  const next=pipe.stages[1];
  await withScope(f.user,f.a,s=>saveWorkflow(s,{name:"Follow-up test",objectId:f.opportunity.id,trigger:"stage",stageId:next.id,steps:[{kind:"task",title:"Confirm discovery"},{kind:"notify",title:"Discovery ready",assigneeId:f.user.id}]}));
  const source=(await withScope(f.user,f.a,s=>list(s,f.opportunity.id,{stageId:pipe.stages[0].id}))).records[0];
  await withScope(f.user,f.a,s=>saveRecord(s,{id:source.id,version:source.version,objectId:source.object_id,revision:f.opportunity.revision,title:source.title,ownerId:source.owner_id,pipelineId:pipe.id,stageId:next.id}));
  assert.equal(await runWorkspace(f.a),1);
  assert.equal(await runWorkspace(f.a),0);
  assert.equal((await withScope(f.user,f.a,tasks)).filter(t=>t.title==="Confirm discovery").length,1);
  assert.equal((await withScope(f.user,f.b,tasks)).filter(t=>t.title==="Confirm discovery").length,0);
});
test("AI proposal has immutable approval, replay control and membership authorization",async()=>{
  const f=await fixture();
  await withScope(f.user,f.a,s=>setAi(s,"fixture"));
  const target=(await withScope(f.user,f.a,s=>list(s,f.opportunity.id,{}))).records[0];
  const answer=await withScope(f.user,f.a,s=>ask(s,{question:"Prepare a follow-up task",recordId:target.id}));
  assert.ok(answer.action);
  const pending=answer.action.id;
  const viewer=(await login("viewer@cairn.example")).user;
  await assert.rejects(withScope(viewer,f.a,s=>resolveAction(s,{id:pending,approve:true})),status(403));
  const first=await withScope(f.user,f.a,s=>resolveAction(s,{id:pending,approve:true}));
  const second=await withScope(f.user,f.a,s=>resolveAction(s,{id:pending,approve:true}));
  assert.equal(first.id,second.id);
  assert.equal(second.replayed,true);
  const newer=await withScope(f.user,f.a,s=>ask(s,{question:"Prepare a follow-up task",recordId:target.id}));
  assert.ok(newer.action);
  await withScope(f.user,f.a,s=>s.tx.query("UPDATE ai_actions SET expires_at=now()-interval '1 minute' WHERE workspace_id=$1 AND id=$2",[f.a,newer.action!.id]));
  await assert.rejects(withScope(f.user,f.a,s=>resolveAction(s,{id:newer.action!.id,approve:true})),status(409));
});

test("single-use invitation creates a scoped account and session",async()=>{
  const f=await fixture();
  const email="invited"+randomUUID()+"@example.com";
  const result=await withScope(f.user,f.a,s=>invite(s,{email,role:"member"}));
  const token=result.url.split("/").at(-1);
  const input={workspace:f.a,token,email,name:"Invited Teammate",password:"synthetic-password-2026"};
  await assert.rejects(registerInvited({...input,workspace:f.b}),status(404));
  const sessionToken=await registerInvited(input);
  const user=await session(new Request("http://local.invalid",{headers:{cookie:cookie(sessionToken).split(";")[0]}}));
  assert.ok(user);
  assert.deepEqual((await spaces(user)).map(w=>[w.id,w.role]),[[f.a,"member"]]);
  await assert.rejects(registerInvited(input),status(404));
});

test("scheduled workflows resolve repeated and skipped local minutes",()=>{
  assert.equal(nextOccurrence("02:30","daily","America/New_York",new Date("2027-03-14T05:00:00Z")),"2027-03-14T07:00:00.000Z");
  assert.equal(nextOccurrence("01:30","daily","America/New_York",new Date("2027-11-07T04:00:00Z")),"2027-11-07T05:30:00.000Z");
  assert.equal(nextOccurrence("01:30","daily","America/New_York",new Date("2027-11-07T07:00:00Z"),new Date("2027-11-07T05:30:00Z")),"2027-11-08T06:30:00.000Z");
});

test("record layouts and archive restore preserve metadata and values",async()=>{
  const f=await fixture();
  const page=await withScope(f.user,f.a,s=>list(s,f.company.id,{}));
  const selected=page.records[0],field=page.fields[0];
  await withScope(f.user,f.a,s=>setLayout(s,{objectId:f.company.id,revision:page.object.revision,sections:[{name:"Company profile",fieldIds:[field.id]}]}));
  await withScope(f.user,f.a,s=>archiveRecord(s,{id:selected.id,version:selected.version}));
  await assert.rejects(withScope(f.user,f.a,s=>record(s,selected.id)),status(404));
  const [saved]=(await withScope(f.user,f.a,s=>list(s,f.company.id,{archived:"yes"}))).records;
  await withScope(f.user,f.a,s=>restoreRecord(s,{id:saved.id,version:saved.version}));
  const restored=await withScope(f.user,f.a,s=>record(s,selected.id));
  assert.deepEqual(restored.fields,selected.fields);
  assert.equal((await withScope(f.user,f.a,s=>list(s,f.company.id,{}))).object.layout[0].name,"Company profile");
});

test("pipeline editing preserves stage identities and restricts removal",async()=>{
  const f=await fixture();
  const [pipe]=await withScope(f.user,f.a,pipelines);
  const expected=pipe.stages.map(({id,name})=>({id,name}));
  await assert.rejects(withScope(f.user,f.a,s=>updatePipeline(s,{id:pipe.id,name:pipe.name,expected,stages:expected.slice(1)})),status(409));
  await withScope(f.user,f.a,s=>updatePipeline(s,{id:pipe.id,name:pipe.name,expected,stages:[...expected,{name:"Renewal"}]}));
  const [updated]=await withScope(f.user,f.a,pipelines);
  assert.deepEqual(updated.stages.slice(0,expected.length).map(({id,name})=>({id,name})),expected);
  assert.equal(updated.stages.at(-1)?.name,"Renewal");
});

test("locale catalogs, Jalali round-trip and canonical numeric values",()=>{
  assert.deepEqual(Object.keys(dictionaries.en).sort(),Object.keys(dictionaries["fa-IR"]).sort());
  assert.equal(parseDateInput("۱۴۰۵/۰۱/۰۱","persian"),"2026-03-21");
  assert.equal(parseDateInput("۱۴۰۵/۱۲/۳۰","persian"),null);
  assert.equal(parseDateInput("2027-02-29","gregory"),null);
  assert.equal(parseTimestampInput("۱۴۰۵/۰۱/۰۱ ۱۲:۰۰","persian","Asia/Tehran"),"2026-03-21T08:30:00.000Z");
  assert.equal(canonicalNumber("۱٬۲۵۰٫۵"),"1250.5");
  assert.equal(canonicalNumber("12,3"),"12,3");
  assert.match(formatDate("2026-03-21","fa-IR"),/۱۴۰۵/);
  assert.match(formatDate("2026-03-21","en"),/2026/);
  assert.match(formatNumber("1250.5","fa-IR",{style:"currency",currency:"EUR"}),/[۰-۹]/);
  assert.match(errorText("fa-IR","{field} is required.",{field:"نام"}),/نام.*الزامی/);
});
test("Persian search and CSV keep original words and canonical data",async()=>{
  const f=await fixture();
  const found=await withScope(f.user,f.a,s=>list(s,f.company.id,{q:"شرکت کیان داده"}),"fa-IR");
  assert.equal(found.records[0].title,"شرکت كيان داده");
  assert.equal(found.object.plural_fa,"شرکت‌ها");
  const review=await withScope(f.user,f.a,s=>previewImport(s,{objectId:f.company.id,csv:"\uFEFFعنوان,وب‌سایت\nتیم فارسی,https://example.com/fa\nخراب,\"not a url\""}),"fa-IR");
  assert.equal(review.valid,1);
  assert.match(review.errors?.[0].message??"",/[آ-ی]/);
  await withScope(f.user,f.a,s=>commitImport(s,review.id),"fa-IR");
  const csv=await withScope(f.user,f.a,s=>exportCsv(s,f.company.id,{q:"تیم فارسی"}),"fa-IR");
  assert.ok(csv.startsWith('\uFEFF"عنوان","وب‌سایت"'));
  assert.match(csv,/تیم فارسی","https:\/\/example.com\/fa/);
});
test("region settings are permission checked and scoped independent of language",async()=>{
  const f=await fixture();
  const viewer=(await login("viewer@cairn.example")).user;
  await assert.rejects(withScope(viewer,f.a,s=>saveRegion(s,{currency:"EUR",timeZone:"Asia/Tehran"}),"fa-IR"),status(403));
  await withScope(f.user,f.a,s=>saveRegion(s,{currency:"EUR",timeZone:"Asia/Tehran"}),"fa-IR");
  assert.deepEqual(await withScope(f.user,f.a,regionalSettings,"en"),{currency:"EUR",timeZone:"Asia/Tehran"});
  assert.deepEqual(await withScope(f.user,f.b,regionalSettings,"fa-IR"),{currency:null,timeZone:"UTC"});
});
test("Copilot answers mixed-language questions in the request locale with the same approval shape",async()=>{
  const f=await fixture();
  await withScope(f.user,f.a,s=>setAi(s,"fixture"));
  const en=await withScope(f.user,f.a,s=>ask(s,{question:"Prepare a follow-up task for شرکت کیان داده"}),"en");
  const fa=await withScope(f.user,f.a,s=>ask(s,{question:"برای شرکت کیان داده یک follow-up task آماده کن"}),"fa-IR");
  assert.ok(en.action&&fa.action);
  assert.equal(en.action.payload.recordId,fa.action.payload.recordId);
  assert.match(fa.action.payload.title,/پیگیری.*شرکت كيان داده/);
  assert.match(en.text,/I prepared/);
  assert.match(fa.text,/وظیفهٔ پیگیری/);
  assert.deepEqual(Object.keys(en.action.payload).sort(),Object.keys(fa.action.payload).sort());
});

test("localized CSV headers disambiguate fields by stable ID",()=>{
  const repeated={name:"Reference",name_fa:"ارجاع",kind:"text" as const,required:false,options:[],position:0};
  const fields=[{...repeated,id:randomUUID()},{...repeated,id:randomUUID()}];
  const persian=csvColumns("fa-IR",fields),english=csvColumns("en",fields);
  assert.notEqual(persian[1].name,persian[2].name);
  assert.ok(persian[1].name.includes(fields[0].id));
  assert.ok(english[1].aliases.includes(persian[1].name));
  assert.ok(!persian[1].aliases.includes("ارجاع"));
});
