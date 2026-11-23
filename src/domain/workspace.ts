import {createHash,randomBytes} from "node:crypto";
import {z} from "zod";
import {audit,canManage,denied,missing,one,Problem,requireRole,rows,setContext,transaction,type Scope,type User} from "./db.ts";
import {csvColumns} from "../i18n/csv-columns.ts";
import {bilingual} from "../i18n/messages.ts";
import {errorText} from "../i18n/errors.ts";
import {booleanInput,searchText} from "../i18n/format.ts";
import {createSession,passwordHash} from "./auth.ts";
import {addField,addObject,addPipeline,fields,list,object,record,saveRecord} from "./crm.ts";
import {id,parse,title,type FieldValue} from "./validation.ts";
const digest=(token:string)=>createHash("sha256").update(token).digest("hex");
const role=z.enum(["admin","member","viewer"]);
export async function createWorkspace(user:User,input:unknown) {
  const data=parse(z.object({name:title,requestId:z.string().regex(/^[0-9a-f]{32}$/)}),input);
  const hash=digest("workspace:"+user.id+":"+data.requestId);
  const workspace=hash.slice(0,8)+"-"+hash.slice(8,12)+"-8"+hash.slice(13,16)+"-8"+hash.slice(17,20)+"-"+hash.slice(20,32);
  return transaction(async tx=>{
    await setContext(tx,workspace,user.id);
    const created=await tx.query("INSERT INTO workspaces(id,name) VALUES($1,$2) ON CONFLICT(id) DO NOTHING",[workspace,data.name]);
    if(!created.rowCount) {
      const existing=await one<{name:string}>(tx,"SELECT w.name FROM workspaces w JOIN memberships m ON m.workspace_id=w.id AND m.user_id=$2 AND m.active AND m.role='owner' WHERE w.id=$1",[workspace,user.id]);
      if(!existing||existing.name!==data.name)throw new Problem(409,"This item changed. Refresh and try again.");
      return {id:workspace};
    }
    await tx.query("INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,'owner')",[workspace,user.id]);
    await audit({tx,workspace,actor:user.id,role:"owner"},"workspace.created",workspace);
    return {id:workspace};
  });
}
export async function invite(scope:Scope,input:unknown) {
  requireRole(scope,canManage);
  const data=parse(z.object({email:z.email().max(254),role}),input);
  if(scope.role==="admin" && data.role==="admin") throw denied();
  const token=randomBytes(24).toString("hex");
  const row=await one<{id:string}>(scope.tx,"INSERT INTO invitations(workspace_id,email,role,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '3 days') RETURNING id",[scope.workspace,data.email.toLowerCase(),data.role,digest(token)]);
  await audit(scope,"member.invited",row.id);
  return {url:"/invite/"+scope.workspace+"/"+token};
}
export async function accept(user:User,workspace:string,token:string) {
  parse(id,workspace);
  if(!/^[a-f0-9]{48}$/.test(token)) throw missing();
  return transaction(async tx=>{
    await setContext(tx,workspace,user.id);
    const invitation=await one<{id:string;role:string}>(tx,"SELECT id,role FROM invitations WHERE workspace_id=$1 AND token_hash=$2 AND email=$3 AND expires_at>now() AND accepted_at IS NULL FOR UPDATE",[workspace,digest(token),user.email.toLowerCase()]);
    if(!invitation) throw missing();
    await tx.query("INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT(workspace_id,user_id) DO UPDATE SET active=true,role=excluded.role WHERE NOT memberships.active",[workspace,user.id,invitation.role]);
    await tx.query("UPDATE invitations SET accepted_at=now() WHERE workspace_id=$1 AND id=$2",[workspace,invitation.id]);
    return {id:workspace};
  });
}
export async function registerInvited(input:unknown) {
  const data=parse(z.object({workspace:id,token:z.string().regex(/^[a-f0-9]{48}$/),email:z.email().max(254),name:title,password:z.string().min(12).max(128)}),input);
  return transaction(async tx=>{
    await setContext(tx,data.workspace,"");
    const email=data.email.toLowerCase();
    const invitation=await one<{id:string;role:string}>(tx,"SELECT id,role FROM invitations WHERE workspace_id=$1 AND token_hash=$2 AND email=$3 AND expires_at>now() AND accepted_at IS NULL FOR UPDATE",[data.workspace,digest(data.token),email]);
    if(!invitation) throw missing();
    if(await one(tx,"SELECT 1 FROM users WHERE email=$1",[email])) throw new Problem(409,"Sign in to your existing account to accept the invitation.");
    const user=await one<{id:string}>(tx,"INSERT INTO users(email,name,password) VALUES($1,$2,$3) RETURNING id",[email,data.name,passwordHash(data.password)]);
    await tx.query("INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,$3)",[data.workspace,user.id,invitation.role]);
    await tx.query("UPDATE invitations SET accepted_at=now() WHERE workspace_id=$1 AND id=$2",[data.workspace,invitation.id]);
    await audit({tx,workspace:data.workspace,actor:user.id,role:invitation.role as Scope["role"]},"member.joined",invitation.id);
    return createSession(tx,user.id);
  });
}
export async function manageMember(scope:Scope,input:unknown) {
  requireRole(scope,canManage);
  const data=parse(z.object({userId:id,role:role.optional(),active:z.boolean()}),input);
  const old=await one<{role:string}>(scope.tx,"SELECT role FROM memberships WHERE workspace_id=$1 AND user_id=$2 FOR UPDATE",[scope.workspace,data.userId]);
  if(!old) throw missing();
  if(old.role==="owner" || (scope.role==="admin"&&(old.role==="admin"||data.role==="admin"))) throw denied();
  await scope.tx.query("UPDATE memberships SET role=coalesce($3,role),active=$4 WHERE workspace_id=$1 AND user_id=$2",[scope.workspace,data.userId,data.role??null,data.active]);
  await audit(scope,"member.updated",data.userId);
  return {id:data.userId};
}
export async function addRelation(scope:Scope,input:unknown) {
  requireRole(scope,canManage);
  const data=parse(z.object({source:id,target:id,label:title,inverse:title,cardinality:z.enum(["one-one","one-many","many-many"])}),input);
  await object(scope,data.source);
  await object(scope,data.target);
  const row=await one<{id:string}>(scope.tx,"INSERT INTO relations(workspace_id,source_object,target_object,label,inverse,cardinality) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",[scope.workspace,data.source,data.target,data.label,data.inverse,data.cardinality]);
  await audit(scope,"relation.created",row.id);
  return row;
}
export async function link(scope:Scope,input:unknown) {
  requireRole(scope,["owner","admin","member"]);
  const data=parse(z.object({relation:id,source:id,target:id}),input);
  const def=await one<{source_object:string;target_object:string;cardinality:string}>(scope.tx,"SELECT source_object,target_object,cardinality FROM relations WHERE workspace_id=$1 AND id=$2",[scope.workspace,data.relation]);
  if(!def) throw missing();
  const [first,second]=[data.source,data.target].sort();
  const byId={[first]:await record(scope,first,true),[second]:await record(scope,second,true)};
  if(def.source_object!==byId[data.source].object_id||def.target_object!==byId[data.target].object_id||first===second) throw new Problem(422,"These records do not match the relationship.");
  const row=await one<{id:string}>(scope.tx,"INSERT INTO edges(workspace_id,relation_id,source_object,target_object,source_id,target_id,cardinality) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",[scope.workspace,data.relation,def.source_object,def.target_object,data.source,data.target,def.cardinality]);
  await audit(scope,"record.linked",row.id);
  return row;
}
export async function unlink(scope:Scope,input:unknown) {
  requireRole(scope,["owner","admin","member"]);
  const edge=parse(id,input);
  if(!(await scope.tx.query("DELETE FROM edges WHERE workspace_id=$1 AND id=$2",[scope.workspace,edge])).rowCount) throw missing();
  await audit(scope,"record.unlinked",edge);
  return {id:edge};
}
export async function detail(scope:Scope,recordId:string) {
  const selected=await record(scope,recordId);
  const [model,activities,edges]=await Promise.all([
    fields(scope,selected.object_id),
    rows<{id:string;kind:string;body:string;created_at:string;actor:string;stage_name:string|null;stage_fa:string|null}>(scope.tx,"SELECT a.id,a.kind,a.body,a.created_at,u.name actor,s.name stage_name,s.name_fa stage_fa FROM activities a LEFT JOIN users u ON u.id=a.actor_id LEFT JOIN stages s ON s.workspace_id=a.workspace_id AND s.id=a.stage_id WHERE a.workspace_id=$1 AND a.record_id=$2 ORDER BY a.created_at DESC LIMIT 100",[scope.workspace,recordId]),
    rows<{id:string;record_id:string;title:string;label:string;label_fa:string|null}>(scope.tx,"SELECT e.id,r.id record_id,r.title,CASE WHEN e.source_id=$2 THEN d.label ELSE d.inverse END label,CASE WHEN e.source_id=$2 THEN d.label_fa ELSE d.inverse_fa END label_fa FROM edges e JOIN relations d ON d.workspace_id=e.workspace_id AND d.id=e.relation_id JOIN records r ON r.workspace_id=e.workspace_id AND r.id=CASE WHEN e.source_id=$2 THEN e.target_id ELSE e.source_id END WHERE e.workspace_id=$1 AND $2 IN (e.source_id,e.target_id) AND r.archived_at IS NULL",[scope.workspace,recordId])
  ]);
  return {record:selected,fields:model,activities,edges};
}
export async function saveView(scope:Scope,input:unknown) {
  const data=parse(z.object({name:title,objectId:id,query:z.object({archived:z.enum(["yes","no"]).optional(),q:z.string().max(200).optional(),stageId:id.optional(),pipelineId:id.optional(),ownerId:id.optional(),sort:z.string().max(40).optional(),dir:z.enum(["asc","desc"]).optional(),fieldId:id.optional(),fieldValue:z.string().max(500).optional(),columns:z.array(id).max(40).optional(),mode:z.enum(["table","board"]).optional()}),shared:z.boolean().default(false)}),input);
  if(data.shared) requireRole(scope,canManage);
  if(data.query.mode==="board") {
    const {pipelineId,stageId}=data.query;
    if(!pipelineId||!await one(scope.tx,`SELECT 1 FROM pipelines p WHERE p.workspace_id=$1 AND p.object_id=$2 AND p.id=$3
      AND ($4::uuid IS NULL OR EXISTS (SELECT 1 FROM stages s WHERE s.workspace_id=p.workspace_id AND s.pipeline_id=p.id AND s.id=$4))`,[scope.workspace,data.objectId,pipelineId,stageId??null])) throw missing();
    data.query.archived=undefined;
    data.query.columns=undefined;
  }
  await list(scope,data.objectId,{...data.query,limit:1});
  const row=await one<{id:string}>(scope.tx,"INSERT INTO views(workspace_id,object_id,creator_id,name,query,shared) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",[scope.workspace,data.objectId,scope.actor,data.name,JSON.stringify(data.query),data.shared]);
  await audit(scope,"view.created",row.id);
  return row;
}
export async function deleteView(scope:Scope,input:unknown) {
  const viewId=parse(id,input);
  if(!(await scope.tx.query("DELETE FROM views WHERE workspace_id=$1 AND id=$2 AND ((NOT shared AND creator_id=$3) OR (shared AND $4))",[scope.workspace,viewId,scope.actor,canManage.includes(scope.role)])).rowCount) throw missing();
  return {id:viewId};
}
const presets={
  consulting:[["Opportunity","Opportunities","target"],["Contact","Contacts","users"],["Company","Companies","building"],["Lead","Leads","briefcase"]],
  recruitment:[["Position","Positions","target"],["Candidate","Candidates","users"],["Employer","Employers","building"],["Interview","Interviews","briefcase"]]
};
export async function applyTemplate(scope:Scope,input:unknown) {
  requireRole(scope,canManage);
  const key=parse(z.enum(["consulting","recruitment"]),input);
  if(!(await scope.tx.query("INSERT INTO templates VALUES($1,$2,1) ON CONFLICT DO NOTHING",[scope.workspace,key])).rowCount) return {applied:false};
  const defs:{id:string}[]=[];
  const translation=key==="consulting"?{
    objects:[["فرصت","فرصت‌ها"],["مخاطب","مخاطبان"],["شرکت","شرکت‌ها"],["سرنخ","سرنخ‌ها"]],
    amount:"مبلغ",pipeline:"فرایند فروش",stages:["واجد شرایط","شناخت نیاز","پیشنهاد","مذاکره","برنده‌شده"]
  }:{
    objects:[["موقعیت شغلی","موقعیت‌های شغلی"],["متقاضی","متقاضیان"],["کارفرما","کارفرمایان"],["مصاحبه","مصاحبه‌ها"]],
    amount:"بودجه",pipeline:"فرایند استخدام",stages:["باز","غربالگری","مصاحبه","پیشنهاد همکاری","تکمیل‌شده"]
  };
  for(const [index,[name,plural,icon]] of presets[key].entries()) {
    const created=await addObject(scope,{name,plural,icon});
    await scope.tx.query("UPDATE objects SET name_fa=$3,plural_fa=$4 WHERE workspace_id=$1 AND id=$2",[scope.workspace,created.id,...translation.objects[index]]);
    defs.push(created);
  }
  const presetField=(name:string,kind:string,index:number)=>addField(scope,{objectId:defs[index].id,name,kind});
  const amount=await presetField(key==="consulting"?"Value":"Budget","currency",0);
  const email=await presetField("Email","email",1);
  const website=await presetField("Website","url",2);
  for(const [field,label] of [[amount,translation.amount],[email,"ایمیل"],[website,"وب‌سایت"]] as const) {
    await scope.tx.query("UPDATE fields SET name_fa=$3 WHERE workspace_id=$1 AND id=$2",[scope.workspace,field.id,label]);
  }
  const pipeline=await addPipeline(scope,{objectId:defs[0].id,name:key==="consulting"?"Sales pipeline":"Hiring pipeline",stages:key==="consulting"?["Qualified","Discovery","Proposal","Negotiation","Won"]:["Open","Screening","Interview","Offer","Filled"]});
  await scope.tx.query("UPDATE pipelines SET name_fa=$3 WHERE workspace_id=$1 AND id=$2",[scope.workspace,pipeline.id,translation.pipeline]);
  for(const [position,label] of translation.stages.entries()) await scope.tx.query("UPDATE stages SET name_fa=$4 WHERE workspace_id=$1 AND pipeline_id=$2 AND position=$3",[scope.workspace,pipeline.id,position,label]);
  const first=await addRelation(scope,{source:defs[2].id,target:defs[1].id,label:presets[key][1][1],inverse:presets[key][2][0],cardinality:"one-many"});
  const second=await addRelation(scope,{source:defs[0].id,target:defs[2].id,label:presets[key][2][0],inverse:presets[key][0][1],cardinality:"many-many"});
  await scope.tx.query("UPDATE relations SET label_fa=$3,inverse_fa=$4 WHERE workspace_id=$1 AND id=$2",[scope.workspace,first.id,translation.objects[1][1],translation.objects[2][0]]);
  await scope.tx.query("UPDATE relations SET label_fa=$3,inverse_fa=$4 WHERE workspace_id=$1 AND id=$2",[scope.workspace,second.id,translation.objects[2][0],translation.objects[0][1]]);
  return {applied:true,objects:defs,pipeline};
}
export function decodeCsv(text:string) {
  const table:string[][]=[];
  let row:string[]=[],cell="",quoted=false,closed=false;
  for(let i=0;i<text.length;i++) {
    const ch=text[i];
    if(quoted) {
      if(ch==='"' && text[i+1]==='"') {cell+='"';i++;}
      else if(ch==='"') {quoted=false;closed=true;}
      else cell+=ch;
    } else if(ch==='"' && !cell && !closed) quoted=true;
    else if(ch===","||ch==="\n"||ch==="\r") {
      row.push(cell); cell=""; closed=false;
      if(ch!==",") {
        if(ch==="\r"&&text[i+1]==="\n") i++;
        if(row.some(Boolean)) table.push(row);
        row=[];
      }
    } else if(ch==='"'||closed) throw new Problem(422,"A CSV field has invalid quoting.");
    else cell+=ch;
  }
  if(quoted) throw new Problem(422,"A CSV field has an unclosed quote.");
  if(cell||row.length) table.push([...row,cell]);
  if(table.length<2||table.length>5001||table.some(line=>line.length!==table[0].length)||table[0].length>60) throw new Problem(422,"Use a consistent header and 1–5,000 data rows.");
  return table;
}
export async function previewImport(scope:Scope,input:unknown) {
  requireRole(scope,canManage);
  const data=parse(z.object({objectId:id,csv:z.string().min(1).max(1_000_000),mapping:z.record(z.string(),z.string()).optional()}),input);
  const current=await object(scope,data.objectId);
  const model=await fields(scope,data.objectId);
  const table=decodeCsv(data.csv.replace(/^\uFEFF/,""));
  const headers=table.shift()!.map(h=>h.trim());
  if(new Set(headers).size!==headers.length) throw new Problem(422,"CSV column names must be unique.");
  const locale=scope.locale??"en";
  const columns=csvColumns(locale,model);
  const map=(key:string,legacy?:string)=>headers.findIndex(header=>data.mapping
    ? (data.mapping[key]??(legacy?data.mapping[legacy]:undefined))===header
    : columns.find(column=>column.id===key)?.aliases.some(name=>searchText(name)===searchText(header)));
  const titleIndex=map("title");
  if(titleIndex<0) return {headers,needsMapping:true};
  const valid:{title:string;fields:Record<string,FieldValue>}[]=[], errors:{row:number;message:string}[]=[];
  const {normalize,valuesFor}=await import("./validation.ts");
  for(const [index,entry] of table.entries()) {
    try {
      const values:Record<string,FieldValue>={};
      for(const field of model) {
        const col=map(field.id,field.name);
        if(col===-1 || !entry[col]) continue;
        const raw=entry[col];
        const boolean=booleanInput(raw);
        if(field.kind==="boolean"&&boolean===undefined) throw new Problem(422,"{field} requires true or false.",{field:bilingual(locale,field)});
        values[field.id]=normalize(field,field.kind==="boolean"?boolean!:field.kind==="multi"?raw.split("|").map(x=>x.trim()):raw);
      }
      valid.push({title:parse(title,entry[titleIndex]),fields:valuesFor(model,values)});
    } catch(error) {
      errors.push({row:index+2,message:error instanceof Problem?errorText(locale,error.source,error.values):errorText(locale,"Invalid row.")});
    }
  }
  const result=await one<{id:string}>(scope.tx,"INSERT INTO imports(workspace_id,object_id,actor_id,schema_revision,rows,errors) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",[scope.workspace,data.objectId,scope.actor,current.revision,JSON.stringify(valid),JSON.stringify(errors)]);
  return {id:result.id,headers,valid:valid.length,errors:errors.slice(0,20),invalid:errors.length,sample:valid.slice(0,5)};
}
export async function commitImport(scope:Scope,input:unknown) {
  requireRole(scope,canManage);
  const recordId=parse(id,input);
  const review=await one<{object_id:string;schema_revision:number;rows:{title:string;fields:Record<string,FieldValue>}[];committed_at:string|null}>(scope.tx,"SELECT * FROM imports WHERE workspace_id=$1 AND id=$2 AND actor_id=$3 FOR UPDATE",[scope.workspace,recordId,scope.actor]);
  if(!review) throw missing();
  if(review.committed_at) return {count:review.rows.length,replayed:true};
  if((await object(scope,review.object_id,true)).revision!==review.schema_revision) throw new Problem(409,"The object changed. Preview the import again.");
  for(const row of review.rows) await saveRecord(scope,{...row,objectId:review.object_id,revision:review.schema_revision});
  await scope.tx.query("UPDATE imports SET committed_at=now() WHERE workspace_id=$1 AND id=$2",[scope.workspace,recordId]);
  await audit(scope,"import.committed",recordId);
  return {count:review.rows.length,replayed:false};
}
export function csvCell(input:unknown) {
  const text=Array.isArray(input)?input.join("|"):String(input??"");
  const safe=/^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/.test(text)?"'"+text:text;
  return '"'+safe.replaceAll('"','""')+'"';
}
export async function exportCsv(scope:Scope,objectId:string,input:unknown) {
  requireRole(scope,canManage);
  const first=await list(scope,objectId,{...(input as object),limit:100,offset:0});
  if(first.total>5000) throw new Problem(422,"Filter this export to at most 5,000 records.");
  const combined=[...first.records];
  for(let offset=100;offset<first.total;offset+=100) combined.push(...(await list(scope,objectId,{...(input as object),limit:100,offset})).records);
  await audit(scope,"records.exported",objectId);
  const locale=scope.locale??"en";
  return (locale==="fa-IR"?"\uFEFF":"")+[csvColumns(locale,first.fields).map(column=>column.name),...combined.map(row=>[row.title,...first.fields.map(field=>row.fields[field.id])])].map(record=>record.map(csvCell).join(",")).join("\r\n");
}
