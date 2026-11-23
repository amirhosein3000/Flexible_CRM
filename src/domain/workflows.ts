import {z} from "zod";
import {randomUUID} from "node:crypto";
import {audit,canManage,missing,one,Problem,requireRole,rows,setContext,transaction,type Role,type Scope} from "./db.ts";
import {addTask,fields,member,object,record} from "./crm.ts";
import {nextOccurrence,validateZone} from "./schedule.ts";
import {id,normalize,parse,title,value} from "./validation.ts";
const stepSchema=z.object({kind:z.enum(["task","assign","notify"]),title:title.optional(),assigneeId:id.optional(),days:z.number().int().min(0).max(365).optional()});
const workflowSchema=z.object({name:title,objectId:id,trigger:z.enum(["stage","schedule"]),stageId:id.optional(),frequency:z.enum(["daily","weekly"]).default("daily"),time:z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/).default("09:00"),zone:z.string().min(1).max(80).default("UTC"),conditions:z.array(z.object({fieldId:id,equals:value})).max(8).default([]),steps:z.array(stepSchema).min(1).max(8)});
export type Rule=z.infer<typeof workflowSchema>;
export type Workflow={id:string;name:string;object_id:string;trigger:string;settings:Rule;actor_id:string;enabled:boolean;next_run:string|null};
export async function saveWorkflow(scope:Scope,input:unknown) {
  requireRole(scope,canManage);
  const rule=parse(workflowSchema,input);
  await object(scope,rule.objectId);
  validateZone(rule.zone);
  if(rule.trigger==="stage" && (!rule.stageId || !(await one(scope.tx,"SELECT 1 FROM stages s JOIN pipelines p ON p.workspace_id=s.workspace_id AND p.id=s.pipeline_id WHERE s.workspace_id=$1 AND s.id=$2 AND p.object_id=$3 FOR KEY SHARE OF s",[scope.workspace,rule.stageId,rule.objectId])))) throw new Problem(422,"Choose a stage on this object.");
  const model=await fields(scope,rule.objectId);
  for(const condition of rule.conditions) {
    const field=model.find(item=>item.id===condition.fieldId);
    if(!field) throw missing();
    condition.equals=normalize({...field,required:false},condition.equals);
  }
  for(const step of rule.steps) {
    if(step.kind!=="assign"&&!step.title) throw new Problem(422,"Enter text for each task or notification.");
    if(step.kind!=="task"&&!step.assigneeId) throw new Problem(422,"Select a teammate for assignments and notifications.");
    if(step.assigneeId) await member(scope,step.assigneeId);
  }
  const row=await one<{id:string}>(scope.tx,"INSERT INTO workflows(workspace_id,object_id,name,trigger,settings,actor_id,next_run) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",[scope.workspace,rule.objectId,rule.name,rule.trigger,JSON.stringify(rule),scope.actor,rule.trigger==="schedule"?nextOccurrence(rule.time,rule.frequency,rule.zone):null]);
  await audit(scope,"workflow.published",row.id);
  return row;
}
export async function setWorkflow(scope:Scope,input:unknown) {
  requireRole(scope,canManage);
  const data=parse(z.object({id,enabled:z.boolean()}),input);
  const row=await one<{id:string;settings:Rule}>(scope.tx,"SELECT id,settings FROM workflows WHERE workspace_id=$1 AND id=$2 FOR UPDATE",[scope.workspace,data.id]);
  if(!row) throw missing();
  await scope.tx.query("UPDATE workflows SET enabled=$3,actor_id=$4,next_run=$5 WHERE workspace_id=$1 AND id=$2",[scope.workspace,data.id,data.enabled,scope.actor,row.settings.trigger==="schedule"?nextOccurrence(row.settings.time,row.settings.frequency,row.settings.zone??"UTC"):null]);
  await audit(scope,data.enabled?"workflow.enabled":"workflow.disabled",data.id);
  return {id:data.id};
}
export async function retryWorkflowJob(scope:Scope,input:unknown) {
  requireRole(scope,canManage);
  const job=parse(id,input);
  const row=await one<{id:string}>(scope.tx,"UPDATE outbox SET outcome=NULL,attempts=0,available_at=now() WHERE workspace_id=$1 AND id=$2 AND outcome='failed' RETURNING id",[scope.workspace,job]);
  if(!row) throw missing();
  await audit(scope,"workflow.retry",job);
  return row;
}
export async function workflowHistory(scope:Scope,input:unknown) {
  requireRole(scope,canManage);
  const workflowId=parse(id,input);
  const flow=await one<{name:string;settings:Rule}>(scope.tx,"SELECT name,settings FROM workflows WHERE workspace_id=$1 AND id=$2",[scope.workspace,workflowId]);
  if(!flow) throw missing();
  const runs=await rows<{id:string;created_at:string;status:"completed"|"failed";record_title:string|null;step_index:number|null;retryable:boolean}>(scope.tx,`
    SELECT h.*,r.title AS record_title FROM (
      SELECT id,created_at,status,record_id,NULL::integer AS step_index,false AS retryable
        FROM workflow_runs WHERE workspace_id=$1 AND workflow_id=$2
      UNION ALL
      SELECT id,created_at,'failed',record_id,step_index,retryable
        FROM workflow_failures WHERE workspace_id=$1 AND workflow_id=$2
    ) h LEFT JOIN records r ON r.workspace_id=$1 AND r.id=h.record_id AND r.archived_at IS NULL
    ORDER BY h.created_at DESC,h.id DESC LIMIT 20`,[scope.workspace,workflowId]);
  return {name:flow.name,steps:flow.settings.steps.map(step=>step.kind),runs};
}
export async function runWorkspace(workspace:string) {
  return transaction(async tx=>{
    await setContext(tx,workspace,"");
    if(!(await one(tx,"SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS locked",[workspace]) as {locked:boolean}).locked) return 0;
    const due=await rows<Workflow>(tx,"SELECT * FROM workflows WHERE workspace_id=$1 AND enabled AND trigger='schedule' AND next_run<=now() FOR UPDATE",[workspace]);
    for(const flow of due) {
      await tx.query("INSERT INTO outbox(workspace_id,kind,payload) VALUES($1,'schedule',$2)",[workspace,JSON.stringify({workflowId:flow.id})]);
      await tx.query("UPDATE workflows SET next_run=$3 WHERE workspace_id=$1 AND id=$2",[workspace,flow.id,nextOccurrence(flow.settings.time,flow.settings.frequency,flow.settings.zone??"UTC",new Date(),flow.next_run?new Date(flow.next_run):undefined)]);
    }
    const event=await one<{id:string;kind:string;attempts:number;payload:{recordId?:string;workflowId?:string;objectId?:string;stageId?:string}}>(tx,"SELECT id,kind,payload,attempts FROM outbox WHERE workspace_id=$1 AND outcome IS NULL AND available_at<=now() ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED",[workspace]);
    if(!event) return 0;
    const flows=event.kind==="stage"?await rows<Workflow>(tx,"SELECT * FROM workflows WHERE workspace_id=$1 AND object_id=$2 AND enabled AND trigger='stage' AND settings->>'stageId'=$3",[workspace,event.payload.objectId,event.payload.stageId]):await rows<Workflow>(tx,"SELECT * FROM workflows WHERE workspace_id=$1 AND id=$2 AND enabled",[workspace,event.payload.workflowId]);
    let failed=false;
    let retryable=false;
    for(const flow of flows) {
      const authorization=await one<{role:Role}>(tx,"SELECT role FROM memberships WHERE workspace_id=$1 AND user_id=$2 AND active FOR SHARE",[workspace,flow.actor_id]);
      if(!authorization||!canManage.includes(authorization.role)) continue;
      await tx.query("SAVEPOINT execute_workflow");
      let failingRecord:string|null=null;
      let failingStep:number|null=null;
      try {
        const scope={tx,workspace,actor:flow.actor_id,role:authorization.role};
        const ids=event.payload.recordId?[event.payload.recordId]:(await rows<{id:string}>(tx,"SELECT id FROM records WHERE workspace_id=$1 AND object_id=$2 AND archived_at IS NULL ORDER BY id LIMIT 101",[workspace,flow.object_id])).map(r=>r.id);
        if(ids.length>100) throw new Problem(422,"A scheduled run is limited to 100 records.");
        for(const recordId of ids) {
          failingRecord=null;
          failingStep=null;
          let current;
          try {current=await record(scope,recordId,true);} catch(error) {if(error instanceof Problem&&error.status===404) continue; throw error;}
          failingRecord=recordId;
          if(!flow.settings.conditions.every(c=>JSON.stringify(current.fields[c.fieldId]??null)===JSON.stringify(c.equals))) continue;
          const runId=randomUUID();
          if(!(await tx.query("INSERT INTO workflow_runs(workspace_id,id,workflow_id,event_id,record_id,status) VALUES($1,$2,$3,$4,$5,'completed') ON CONFLICT DO NOTHING",[workspace,runId,flow.id,event.id,recordId])).rowCount) continue;
          for(const [index,step] of flow.settings.steps.entries()) {
            failingStep=index;
            if(step.assigneeId) await member(scope,step.assigneeId);
            if(step.kind==="task") {
              const date = new Date();
              date.setUTCDate(date.getUTCDate()+(step.days??0));
              await addTask(scope,{recordId,assigneeId:step.assigneeId,title:step.title,dueDate:date.toISOString().slice(0,10)});
            } else if(step.kind==="assign") {
              await tx.query("UPDATE records SET owner_id=$3,version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2",[workspace,recordId,step.assigneeId]);
            } else {
              await tx.query("INSERT INTO notifications(workspace_id,user_id,message) VALUES($1,$2,$3)",[workspace,step.assigneeId,step.title]);
            }
          }
          failingStep=null;
          await audit(scope,"workflow.completed",runId);
        }
      } catch(error) {
        await tx.query("ROLLBACK TO SAVEPOINT execute_workflow");
        failed=true;
        const mayRetry=!(error instanceof Problem) || error.status>=500;
        retryable ||= mayRetry;
        await tx.query("INSERT INTO workflow_failures(workspace_id,workflow_id,event_id,record_id,step_index,retryable) VALUES($1,$2,$3,$4,$5,$6)",[workspace,flow.id,event.id,failingRecord,failingStep,mayRetry]);
      }
      await tx.query("RELEASE SAVEPOINT execute_workflow");
    }
    if(failed) {
      await tx.query("UPDATE outbox SET attempts=attempts+1,available_at=now()+make_interval(secs=>power(2,least(attempts+1,8))::int),outcome=CASE WHEN attempts>=4 OR $3 THEN 'failed' END WHERE workspace_id=$1 AND id=$2",[workspace,event.id,!retryable]);
    } else {
      await tx.query("UPDATE outbox SET outcome='completed' WHERE workspace_id=$1 AND id=$2",[workspace,event.id]);
    }
    return 1;
  },true);
}
