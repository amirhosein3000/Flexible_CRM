import {booleanInput,searchText} from "../i18n/format.ts";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { audit, canManage, canWrite, missing, one, Problem, requireRole, rows, stale, type Scope } from "./db.ts";
import { dueDate, fieldKinds, id, normalize, parse, prefixSearch, title, value, valuesFor, type Field, type FieldValue } from "./validation.ts";
export type LayoutSection = {name:string;fieldIds:string[]};
export type ObjectDef = {id:string;name:string;name_fa?:string|null;plural:string;plural_fa?:string|null;key:string;icon:string;revision:number;layout:LayoutSection[]};
export type RecordRow = {id:string;object_id:string;title:string;owner_id:string|null;pipeline_id:string|null;stage_id:string|null;version:number;schema_revision:number;fields:Record<string,FieldValue>;updated_at:string;archived_at?:string|null;owner?:string|null;stage?:string|null};
export type Stage = {id:string;name:string;name_fa?:string|null;color:string;pipeline_id:string;position:number;count?:number;records?:RecordRow[]};
export type Pipeline = {id:string;name:string;name_fa?:string|null;object_id:string;stages:Stage[]};
const ws = (scope:Scope) => [scope.workspace];
export async function objects(scope:Scope) {
  return rows<ObjectDef>(scope.tx,"SELECT id,name,name_fa,plural,plural_fa,key,icon,revision,layout FROM objects WHERE workspace_id=$1 ORDER BY key",ws(scope));
}
export async function object(scope:Scope,objectId:string,lock=false) {
  const row=await one<ObjectDef>(scope.tx,"SELECT * FROM objects WHERE workspace_id=$1 AND id=$2"+(lock?" FOR UPDATE":""),[scope.workspace,objectId]);
  if(!row) throw missing();
  return row;
}
export async function fields(scope:Scope,objectId:string,includeArchived=false) {
  return rows<Field>(scope.tx,"SELECT id,name,name_fa,kind,required,options,archived,position FROM fields WHERE workspace_id=$1 AND object_id=$2 AND ($3 OR NOT archived) ORDER BY position,id",[scope.workspace,objectId,includeArchived]);
}
async function snapshot(scope:Scope, objectId:string,revision:number) {
  const model=await fields(scope,objectId,true);
  await scope.tx.query("INSERT INTO object_revisions(workspace_id,object_id,revision,snapshot) VALUES($1,$2,$3,$4)",[scope.workspace,objectId,revision,JSON.stringify({fields:model,layout:(await object(scope,objectId)).layout})]);
}
export async function addObject(scope:Scope,input:unknown) {
  requireRole(scope,canManage);
  const {name,plural,icon}=parse(z.object({name:title,plural:title,icon:z.enum(["layers","users","building","target","briefcase"]).optional()}),input);
  const key=searchText(name).replace(/[^\p{L}\p{N}]+/gu,"-").replace(/^-|-$/g,"") || "object";
  const objectId=randomUUID();
  await scope.tx.query("INSERT INTO objects(workspace_id,id,name,plural,key,icon) VALUES($1,$2,$3,$4,$5,$6)",[scope.workspace,objectId,name,plural,key,icon ?? "layers"]);
  await snapshot(scope,objectId,1);
  await audit(scope,"object.created",objectId);
  return {id:objectId};
}
export async function addField(scope:Scope,input:unknown) {
  requireRole(scope,canManage);
  const data=parse(z.object({objectId:id,name:title,kind:z.enum(fieldKinds),required:z.boolean().default(false),options:z.array(title).max(40).default([])}),input);
  const current=await object(scope,data.objectId,true);
  if (["select","multi"].includes(data.kind) && !data.options.length) throw new Problem(422,"Add at least one option.");
  if (data.required && (await one(scope.tx,"SELECT 1 FROM records WHERE workspace_id=$1 AND object_id=$2 LIMIT 1",[scope.workspace,data.objectId]))) throw new Problem(409,"Add this as optional because the object already has records.");
  const row=await one<{id:string}>(scope.tx,"INSERT INTO fields(workspace_id,object_id,name,kind,required,options,position) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",[scope.workspace,data.objectId,data.name,data.kind,data.required,JSON.stringify([...new Set(data.options)]),current.revision]);
  await scope.tx.query("UPDATE objects SET revision=revision+1 WHERE workspace_id=$1 AND id=$2",[scope.workspace,data.objectId]);
  await snapshot(scope,data.objectId,current.revision+1);
  await audit(scope,"field.added",row.id);
  return row;
}
export async function archiveField(scope:Scope,input:unknown) {
  requireRole(scope,canManage);
  const {objectId,fieldId}=parse(z.object({objectId:id,fieldId:id}),input);
  const current=await object(scope,objectId,true);
  const result=await scope.tx.query("UPDATE fields SET archived=true WHERE workspace_id=$1 AND object_id=$2 AND id=$3 AND NOT archived",[scope.workspace,objectId,fieldId]);
  if (!result.rowCount) throw missing();
  await scope.tx.query("UPDATE objects SET revision=revision+1 WHERE workspace_id=$1 AND id=$2",[scope.workspace,objectId]);
  await snapshot(scope,objectId,current.revision+1);
  await audit(scope,"field.archived",fieldId);
  return {id:fieldId};
}
export async function setLayout(scope:Scope,input:unknown) {
  requireRole(scope,canManage);
  const data=parse(z.object({objectId:id,revision:z.number().int(),sections:z.array(z.object({name:title,fieldIds:z.array(id).max(40)})).max(12)}),input);
  const current=await object(scope,data.objectId,true);
  if(current.revision!==data.revision)throw stale();
  const known=new Set((await fields(scope,data.objectId)).map(field=>field.id));
  const keys=data.sections.flatMap(section=>section.fieldIds);
  if(keys.some(key=>!known.has(key))||new Set(keys).size!==keys.length)throw new Problem(422,"Place each active field in at most one section.");
  await scope.tx.query("UPDATE objects SET layout=$3,revision=revision+1 WHERE workspace_id=$1 AND id=$2",[scope.workspace,data.objectId,JSON.stringify(data.sections)]);
  await snapshot(scope,data.objectId,current.revision+1);
  await audit(scope,"layout.updated",data.objectId);
  return {id:data.objectId};
}
export async function record(scope:Scope,recordId:string,lock=false) {
  const row=await one<RecordRow>(scope.tx,"SELECT * FROM records WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL"+(lock?" FOR UPDATE":""),[scope.workspace,recordId]);
  if(!row) throw missing();
  return row;
}
export async function member(scope:Scope,userId:string) {
  if(!(await one(scope.tx,"SELECT 1 FROM memberships WHERE workspace_id=$1 AND user_id=$2 AND active",[scope.workspace,userId]))) throw missing();
}
export async function people(scope:Scope) {
  return rows<{id:string;name:string;email:string;role:string}>(scope.tx,"SELECT u.id,u.name,u.email,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=$1 AND m.active ORDER BY u.name",ws(scope));
}
export const recordInput=z.object({id:id.optional(),objectId:id,revision:z.number().int().positive(),version:z.number().int().positive().optional(),title,ownerId:id.nullish(),pipelineId:id.nullish(),stageId:id.nullish(),fields:z.record(id,value).default({})});
export async function saveRecord(scope:Scope,input:unknown) {
  requireRole(scope,canWrite);
  const data=parse(recordInput,input);
  const current=await object(scope,data.objectId,true);
  if(data.revision!==current.revision) throw stale();
  const old=data.id ? await record(scope,data.id,true) : undefined;
  if(old && (old.version!==data.version || old.object_id!==data.objectId)) throw stale();
  if(data.ownerId) await member(scope,data.ownerId);
  if(Boolean(data.stageId)!==Boolean(data.pipelineId)) throw new Problem(422,"Choose a pipeline and stage together.");
  if(data.stageId && !(await one(scope.tx,"SELECT 1 FROM stages s JOIN pipelines p ON p.workspace_id=s.workspace_id AND p.id=s.pipeline_id WHERE s.workspace_id=$1 AND s.id=$2 AND p.id=$3 AND p.object_id=$4",[scope.workspace,data.stageId,data.pipelineId,data.objectId]))) throw missing();
  const all=valuesFor(await fields(scope,data.objectId),data.fields,old?.fields);
  const rid=old?.id ?? randomUUID();
  const args=[scope.workspace,rid,data.objectId,data.title,data.ownerId??null,data.pipelineId??null,data.stageId??null,JSON.stringify(all),current.revision];
  await scope.tx.query(old?"UPDATE records SET title=$4,owner_id=$5,pipeline_id=$6,stage_id=$7,fields=$8,schema_revision=$9,version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2 AND object_id=$3":"INSERT INTO records(workspace_id,id,object_id,title,owner_id,pipeline_id,stage_id,fields,schema_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",args);
  await audit(scope,old?"record.updated":"record.created",rid);
  if(old?.stage_id!==data.stageId && data.stageId) {
    const stage=await one<{name:string}>(scope.tx,"SELECT name FROM stages WHERE workspace_id=$1 AND id=$2",[scope.workspace,data.stageId]);
    await activity(scope,{recordId:rid,kind:"stage",stageId:data.stageId,body:"Moved to "+stage.name},true);
    await scope.tx.query("INSERT INTO outbox(workspace_id,kind,payload) VALUES($1,'stage',$2)",[scope.workspace,JSON.stringify({recordId:rid,objectId:data.objectId,stageId:data.stageId})]);
  }
  return {id:rid};
}
export async function archiveRecord(scope:Scope,input:unknown) {
  requireRole(scope,canWrite);
  const {id:recordId,version}=parse(z.object({id,version:z.number().int().positive()}),input);
  if((await record(scope,recordId,true)).version!==version) throw stale();
  await scope.tx.query("UPDATE records SET archived_at=now(),version=version+1 WHERE workspace_id=$1 AND id=$2",[scope.workspace,recordId]);
  await audit(scope,"record.archived",recordId);
  return {id:recordId};
}
export async function restoreRecord(scope:Scope,input:unknown) {
  requireRole(scope,canWrite);
  const data=parse(z.object({id,version:z.number().int().positive()}),input);
  const snapshot=await one<RecordRow>(scope.tx,"SELECT * FROM records WHERE workspace_id=$1 AND id=$2 AND archived_at IS NOT NULL",[scope.workspace,data.id]);
  if(!snapshot)throw missing();
  const current=await object(scope,snapshot.object_id,true);
  const old=await one<RecordRow>(scope.tx,"SELECT * FROM records WHERE workspace_id=$1 AND id=$2 AND archived_at IS NOT NULL FOR UPDATE",[scope.workspace,data.id]);
  if(!old||old.version!==data.version)throw stale();
  valuesFor(await fields(scope,old.object_id),{},old.fields);
  await scope.tx.query("UPDATE records SET archived_at=NULL,version=version+1,schema_revision=$3,updated_at=now() WHERE workspace_id=$1 AND id=$2",[scope.workspace,data.id,current.revision]);
  await audit(scope,"record.restored",data.id);
  return {id:data.id};
}
export const listOptions=z.object({archived:z.enum(["yes","no"]).default("no"),q:z.string().max(200).default(""),stageId:id.optional(),pipelineId:id.optional(),ownerId:id.optional(),fieldId:id.optional(),fieldValue:z.string().max(500).optional(),sort:z.string().max(40).default("updated"),dir:z.enum(["asc","desc"]).default("desc"),offset:z.number().int().min(0).max(100000).default(0),limit:z.number().int().min(1).max(100).default(50)});
export async function list(scope:Scope,objectId:string,input:unknown) {
  const data=parse(listOptions,input);
  const current=await object(scope,objectId);
  const model=await fields(scope,objectId);
  const args:unknown[]=[scope.workspace,objectId];
  const clauses=["r.workspace_id=$1","r.object_id=$2",data.archived==="yes"?"r.archived_at IS NOT NULL":"r.archived_at IS NULL"];
  const add=(value:unknown)=>{args.push(value);return "$"+args.length;};
  if(data.q) {
    const query=prefixSearch(data.q);
    clauses.push(query?"r.localized_search_document @@ to_tsquery('simple',"+add(query)+")":"false");
  }
  if(data.pipelineId) clauses.push("r.pipeline_id="+add(data.pipelineId));
  if(data.stageId) clauses.push("r.stage_id="+add(data.stageId));
  if(data.ownerId) clauses.push("r.owner_id="+add(data.ownerId));
  if(data.fieldId) {
    const field=model.find(item=>item.id===data.fieldId);
    if(!field) throw new Problem(422,"Choose an active filter field.");
    const raw=data.fieldValue ?? "";
    if(!raw) clauses.push("NOT (r.fields ? "+add(field.id)+")");
    else if(field.kind==="multi") clauses.push("(r.fields -> "+add(field.id)+"::text) ? "+add(normalize({...field,required:false},[raw]) instanceof Array ? raw : ""));
    else {
      const filterValue=field.kind==="boolean"?booleanInput(raw):raw;
      if(filterValue===undefined)throw new Problem(422,"{field} requires true or false.",{field:field.name});
      clauses.push("(r.fields -> "+add(field.id)+"::text)="+add(JSON.stringify(normalize({...field,required:false},filterValue)))+"::jsonb");
    }
  }
  const standard:Record<string,string>={title:"lower(r.title)",updated:"r.updated_at",created:"r.created_at"};
  let sort=Object.hasOwn(standard,data.sort)?standard[data.sort]:undefined;
  if(!sort) {
    const field=model.find(item=>item.id===data.sort && !["multi","longtext"].includes(item.kind));
    if(!field) throw new Problem(422,"Choose a sortable field.");
    const cell="(r.fields ->> "+add(field.id)+"::text)";
    sort=["number","decimal","currency"].includes(field.kind)?cell+"::numeric":field.kind==="date"?cell+"::date":field.kind==="timestamp"?cell+"::timestamptz":"lower("+cell+")";
  }
  const source=" FROM records r LEFT JOIN users u ON u.id=r.owner_id LEFT JOIN stages s ON s.workspace_id=r.workspace_id AND s.id=r.stage_id WHERE "+clauses.join(" AND ");
  const page=await rows<RecordRow & {total:string}>(scope.tx,"SELECT r.id,r.object_id,r.title,r.owner_id,r.pipeline_id,r.stage_id,r.fields,r.version,r.schema_revision,r.created_at,r.updated_at,r.archived_at,u.name owner,s.name stage,count(*) OVER() total"+source+" ORDER BY "+sort+" "+data.dir+" NULLS LAST,r.id LIMIT "+add(data.limit)+" OFFSET "+add(data.offset),args);
  return {object:current,fields:model,records:page,total:Number(page[0]?.total ?? 0)};
}
export async function pipelines(scope:Scope) {
  const [p,s]=await Promise.all([rows<Omit<Pipeline,"stages">>(scope.tx,"SELECT id,name,name_fa,object_id FROM pipelines WHERE workspace_id=$1 ORDER BY name",ws(scope)),rows<Stage>(scope.tx,"SELECT id,name,name_fa,color,pipeline_id,position FROM stages WHERE workspace_id=$1 ORDER BY position",ws(scope))]);
  return p.map(item=>({...item,stages:s.filter(stage=>stage.pipeline_id===item.id)}));
}
export async function addPipeline(scope:Scope,input:unknown) {
  requireRole(scope,canManage);
  const data=parse(z.object({objectId:id,name:title,stages:z.array(title).min(1).max(16)}),input);
  await object(scope,data.objectId);
  const pipelineId=randomUUID();
  await scope.tx.query("INSERT INTO pipelines(workspace_id,id,object_id,name) VALUES($1,$2,$3,$4)",[scope.workspace,pipelineId,data.objectId,data.name]);
  for (const [position,name] of data.stages.entries()) await scope.tx.query("INSERT INTO stages(workspace_id,pipeline_id,name,color,position) VALUES($1,$2,$3,$4,$5)",[scope.workspace,pipelineId,name,["blue","purple","indigo","amber","green"][position%5],position]);
  await audit(scope,"pipeline.created",pipelineId);
  return {id:pipelineId};
}
export async function updatePipeline(scope:Scope,input:unknown) {
  requireRole(scope,canManage);
  const data=parse(z.object({id,name:title,expected:z.array(z.object({id,name:title})).max(16),stages:z.array(z.object({id:id.optional(),name:title})).min(1).max(16)}),input);
  const p=await one<{id:string}>(scope.tx,"SELECT id FROM pipelines WHERE workspace_id=$1 AND id=$2 FOR UPDATE",[scope.workspace,data.id]);
  if(!p)throw missing();
  const current=await rows<{id:string;name:string}>(scope.tx,"SELECT id,name FROM stages WHERE workspace_id=$1 AND pipeline_id=$2 ORDER BY position FOR UPDATE",[scope.workspace,p.id]);
  if(JSON.stringify(current)!==JSON.stringify(data.expected))throw stale();
  const entries=data.stages.flatMap(stage=>stage.id?[stage.id]:[]);
  if(new Set(entries).size!==entries.length||entries.some(stageId=>!current.some(s=>s.id===stageId))) throw new Problem(422,"Choose stages from this pipeline.");
  for(const stage of current.filter(stage=>!entries.includes(stage.id))) {
    if(await one(scope.tx,"SELECT 1 FROM records WHERE workspace_id=$1 AND stage_id=$2 UNION ALL SELECT 1 FROM workflows WHERE workspace_id=$1 AND settings->>'stageId'=$2::text LIMIT 1",[scope.workspace,stage.id])) throw new Problem(409,"Move all records and remove automation references before removing {stage}.",{stage:stage.name});
    await scope.tx.query("DELETE FROM stages WHERE workspace_id=$1 AND pipeline_id=$2 AND id=$3",[scope.workspace,p.id,stage.id]);
  }
  await scope.tx.query("UPDATE pipelines SET name_fa=CASE WHEN name=$3 THEN name_fa END,name=$3 WHERE workspace_id=$1 AND id=$2",[scope.workspace,p.id,data.name]);
  for(const [position,stage] of data.stages.entries()) {
    if(stage.id)await scope.tx.query("UPDATE stages SET name_fa=CASE WHEN name=$4 THEN name_fa END,name=$4,position=$5 WHERE workspace_id=$1 AND pipeline_id=$2 AND id=$3",[scope.workspace,p.id,stage.id,stage.name,position]);
    else await scope.tx.query("INSERT INTO stages(workspace_id,pipeline_id,name,color,position) VALUES($1,$2,$3,$4,$5)",[scope.workspace,p.id,stage.name,["blue","purple","indigo","amber","green"][position%5],position]);
  }
  await audit(scope,"pipeline.updated",p.id);
  return p;
}
export async function activity(scope:Scope,input:unknown,system=false) {
  requireRole(scope,canWrite);
  const data=parse(z.object({recordId:id,kind:z.enum(system?["stage","note","call","meeting"]:["note","call","meeting"]),body:z.string().trim().min(1).max(8000),stageId:(system?id:z.never()).optional()}),input);
  await record(scope,data.recordId);
  const row=await one<{id:string}>(scope.tx,"INSERT INTO activities(workspace_id,record_id,actor_id,kind,body,stage_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",[scope.workspace,data.recordId,scope.actor,data.kind,data.body,data.stageId??null]);
  await audit(scope,"activity."+data.kind,row.id);
  return row;
}
export const taskSchema=z.object({recordId:id.nullish(),assigneeId:id.nullish(),title,dueDate});
export async function addTask(scope:Scope,input:unknown) {
  requireRole(scope,canWrite);
  const data=parse(taskSchema,input);
  if(data.recordId) await record(scope,data.recordId);
  if(data.assigneeId) await member(scope,data.assigneeId);
  const row=await one<{id:string}>(scope.tx,"INSERT INTO tasks(workspace_id,record_id,assignee_id,title,due_at) VALUES($1,$2,$3,$4,$5) RETURNING id",[scope.workspace,data.recordId??null,data.assigneeId??null,data.title,data.dueDate??null]);
  await audit(scope,"task.created",row.id);
  return row;
}
export async function taskStatus(scope:Scope,input:unknown) {
  requireRole(scope,canWrite);
  const data=parse(z.object({id,status:z.enum(["open","done"])}),input);
  const row=await one<{id:string}>(scope.tx,"UPDATE tasks SET status=$3 WHERE workspace_id=$1 AND id=$2 RETURNING id",[scope.workspace,data.id,data.status]);
  if(!row) throw missing();
  await audit(scope,"task."+data.status,data.id);
  return row;
}
export type Task={id:string;title:string;due_at:string|null;status:"open"|"done";assignee_id:string|null;assignee:string|null;record_id:string|null;record_title:string|null};
export async function tasks(scope:Scope) {
  return rows<Task>(scope.tx,"SELECT t.id,t.title,t.due_at::text,t.status,t.assignee_id,u.name assignee,r.id record_id,r.title record_title FROM tasks t LEFT JOIN records r ON r.workspace_id=t.workspace_id AND r.id=t.record_id AND r.archived_at IS NULL LEFT JOIN users u ON u.id=t.assignee_id WHERE t.workspace_id=$1 ORDER BY t.status DESC,t.due_at NULLS LAST,t.created_at DESC LIMIT 250",ws(scope));
}
