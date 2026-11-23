import { z } from "zod";
import { cookie, session, signIn, signOut, spaces } from "../../../src/domain/auth";
import { body, guard, json, protect } from "../../../src/server/http";
import { transaction,rows } from "../../../src/domain/db";
import { runWorkspace } from "../../../src/domain/workflows";
import { registerInvited } from "../../../src/domain/workspace";
import { parse } from "../../../src/domain/validation";
export const runtime="nodejs";
export async function GET(request:Request) {
  return guard(request,async()=>{
    if(process.env.CRM_DEMO==="1"&&process.env.CRM_EMBEDDED_DEMO==="1") {
      const {startEmbeddedWorker}=await import("../../../src/domain/demo");
      startEmbeddedWorker(async()=>{const spaces=await transaction(tx=>rows<{id:string}>(tx,"SELECT id FROM crm.worker_workspaces()"),true);for(const space of spaces)await runWorkspace(space.id);});
    }
    const user=await session(request);
    return json(user?{user,spaces:await spaces(user)}:{user:null,spaces:[]});
  });
}
export async function POST(request:Request) {
  return guard(request,async()=>{
    protect(request);
    const incoming=await body(request);
    const input=parse(z.object({email:z.email().max(254),password:z.string().min(8).max(128),workspace:z.string().optional()}),incoming);
    const token=input.workspace ? await registerInvited(incoming) : await signIn(input.email,input.password);
    return json({ok:true},200,{"Set-Cookie":cookie(token)});
  });
}
export async function DELETE(request:Request) {
  return guard(request,async()=>{
    protect(request);
    await signOut(request);
    return json({ok:true},200,{"Set-Cookie":cookie("")});
  });
}
