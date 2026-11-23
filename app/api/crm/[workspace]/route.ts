import {z} from "zod";
import {session} from "../../../../src/domain/auth";
import {ask,resolveAction,setAi} from "../../../../src/domain/ai";
import {activity,addField,addObject,addPipeline,addTask,archiveField,archiveRecord,list,objects,people,pipelines,saveRecord,setLayout,restoreRecord,updatePipeline,tasks,taskStatus} from "../../../../src/domain/crm";
import {canManage,missing,Problem,rows,withScope,type Scope} from "../../../../src/domain/db";
import {id,parse,prefixSearch} from "../../../../src/domain/validation";
import {accept,addRelation,applyTemplate,commitImport,deleteView,detail,exportCsv,invite,link,manageMember,previewImport,saveView,unlink} from "../../../../src/domain/workspace";
import {retryWorkflowJob,saveWorkflow,setWorkflow,workflowHistory} from "../../../../src/domain/workflows";
import {requestLocale} from "../../../../src/i18n/config";
import {regionalSettings,saveRegion} from "../../../../src/domain/region";
import {body,guard,json,protect} from "../../../../src/server/http";
type Params={params:Promise<{workspace:string}>};
const command=z.object({action:z.string().max(40),data:z.unknown()});
const actions:Record<string,(scope:Scope,data:unknown)=>Promise<unknown>>={
  addObject,addField,archiveField,addPipeline,updatePipeline,saveRecord,archiveRecord,restoreRecord,setLayout,addTask,taskStatus,activity,addRelation,link,unlink,saveView,deleteView,applyTemplate,
  previewImport,commitImport,invite,manageMember,saveWorkflow,setWorkflow,retryWorkflowJob,setAi,ask,resolveAction,saveRegion
};
async function bootstrap(scope:Scope) {
  const w=[scope.workspace];
  const [defs,stages,members,actions,relations,workflows,audit,notifications,config,counts,region,failedJobs]=await Promise.all([
    objects(scope),pipelines(scope),people(scope),tasks(scope),
    rows<{id:string;source_object:string;target_object:string;label:string;inverse:string;cardinality:string}>(scope.tx,"SELECT id,source_object,target_object,label,inverse,label_fa,inverse_fa,cardinality FROM relations WHERE workspace_id=$1 ORDER BY label",w),
    canManage.includes(scope.role)?rows(scope.tx,"SELECT f.id,f.name,f.object_id,f.trigger,f.enabled,f.next_run,f.settings,(SELECT count(*)::int FROM workflow_runs r WHERE r.workspace_id=f.workspace_id AND r.workflow_id=f.id) runs FROM workflows f WHERE f.workspace_id=$1 ORDER BY f.name",w):[],
    canManage.includes(scope.role)?rows(scope.tx,"SELECT id,event,created_at FROM audit WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 30",w):[],
    rows(scope.tx,"SELECT id,message,seen FROM notifications WHERE workspace_id=$1 AND user_id=$2 ORDER BY id LIMIT 25",[scope.workspace,scope.actor]),
    rows<{ai_mode:string}>(scope.tx,"SELECT ai_mode FROM workspaces WHERE id=$1",w),
    rows<{object_id:string;pipeline_id:string|null;stage_id:string|null;count:number}>(scope.tx,"SELECT object_id,pipeline_id,stage_id,count(*)::int FROM records WHERE workspace_id=$1 AND archived_at IS NULL GROUP BY object_id,pipeline_id,stage_id",w),regionalSettings(scope),
    canManage.includes(scope.role)?rows(scope.tx,"SELECT id,attempts FROM outbox WHERE workspace_id=$1 AND outcome='failed' ORDER BY created_at DESC LIMIT 30",w):[]
  ]);
  return {objects:defs,pipelines:stages,people:members,tasks:actions,relations,workflows,failedJobs,audit,notifications,aiMode:config[0]?.ai_mode??"off",counts,region,role:scope.role};
}
export async function GET(request:Request,context:Params) {
  return guard(request,async()=>{
    const user=await session(request);
    if(!user) throw new Problem(401,"Sign in to continue.");
    const workspace=parse(id,(await context.params).workspace);
    const query=new URL(request.url).searchParams;
    const kind=query.get("kind");
    return withScope(user,workspace,async scope=>{
      if(kind==="detail") return json(await detail(scope,parse(id,query.get("id"))));
      if(kind==="workflow-history") return json(await workflowHistory(scope,query.get("id")));
      if(kind==="list"||kind==="export") {
        const objectId=parse(id,query.get("objectId"));
        const options=Object.fromEntries(query.entries()) as Record<string,unknown>;
        if(query.has("offset")) options.offset=Number(query.get("offset"));
        if(query.has("limit")) options.limit=Number(query.get("limit"));
        if(kind==="export") return new Response(await exportCsv(scope,objectId,options),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=cairn-records.csv","Cache-Control":"no-store"}});
        const result=await list(scope,objectId,options);
        const views=await rows(scope.tx,"SELECT id,name,query,shared,creator_id FROM views WHERE workspace_id=$1 AND object_id=$2 AND (shared OR creator_id=$3) ORDER BY name",[workspace,objectId,user.id]);
        return json({...result,views});
      }
      if(kind==="search") {
        const term=prefixSearch(parse(z.string().trim().min(1).max(200),query.get("q")));
        if(!term)return json([]);
        return json(await rows(scope.tx,"SELECT r.id,r.title,o.name object,o.name_fa object_fa FROM records r JOIN objects o ON o.workspace_id=r.workspace_id AND o.id=r.object_id WHERE r.workspace_id=$1 AND r.archived_at IS NULL AND r.localized_search_document @@ to_tsquery('simple',$2) ORDER BY r.updated_at DESC LIMIT 24",[workspace,term]));
      }
      return json(await bootstrap(scope));
    },requestLocale(request));
  });
}
export async function POST(request:Request,context:Params) {
  return guard(request,async()=>{
    protect(request);
    const user=await session(request);
    if(!user) throw new Problem(401,"Sign in to continue.");
    const workspace=parse(id,(await context.params).workspace);
    const input=parse(command,await body(request));
    if(input.action==="accept") return json(await accept(user,workspace,parse(z.string(),input.data)));
    if(!Object.hasOwn(actions,input.action)) throw missing();
    return withScope(user,workspace,async scope=>json(await actions[input.action](scope,input.data)),requestLocale(request));
  });
}
