import {setTimeout as delay} from "node:timers/promises";
try {process.loadEnvFile?.(process.env.CRM_ENV_FILE || ".env");} catch(error) {if((error as {code?:string}).code!=="ENOENT") throw error;}
if(process.env.WORKER_DATABASE_URL) process.env.DATABASE_URL=process.env.WORKER_DATABASE_URL;
const {pool,transaction,rows}=await import("../src/domain/db.ts");
const {runWorkspace}=await import("../src/domain/workflows.ts");
let stopped=false;
process.once("SIGINT",()=>{stopped=true;});
process.once("SIGTERM",()=>{stopped=true;});
console.log("Cairn workflow worker started");
while(!stopped) {
  try {
    const workspaces=await transaction(tx=>rows<{id:string}>(tx,"SELECT id FROM crm.worker_workspaces()"));
    for(const workspace of workspaces) for(let index=0;index<10 && await runWorkspace(workspace.id);index++) {/* drain bounded work */}
  } catch (error) {console.error("Worker iteration failed",(error as {code?:string}).code??"unknown");}
  await delay(1600);
}
await pool.end();
