import {readdir,readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
import {seedDemo} from "./seed-demo.ts";
import type {Tx} from "./db.ts";

type Engine=PGlite;
const globalDemo=globalThis as typeof globalThis & {cairnDemo?:Promise<Engine>;cairnDemoTick?:NodeJS.Timeout};
export function isEmbedded() {
  return process.env.CRM_DEMO==="1" && process.env.CRM_EMBEDDED_DEMO==="1";
}
export function embedded() {
  return globalDemo.cairnDemo ??= start();
}
function connection(tx:{query:Engine["query"];exec:Engine["exec"]}) {
  return {
    async query(sql:string,args?:unknown[]) {
      if(!args?.length && sql.includes(";")) {
        const results=await tx.exec(sql);
        const last=results.at(-1);
        return {rows:last?.rows??[],rowCount:last?.affectedRows??0};
      }
      const result=await tx.query(sql,args);
      return {rows:result.rows,rowCount:result.affectedRows??result.rows.length};
    }
  } as Tx;
}
async function start() {
  const db=new PGlite();
  await db.waitReady;
  await db.exec("CREATE ROLE crm_app NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE crm_worker NOLOGIN NOSUPERUSER NOBYPASSRLS;");
  for(const name of (await readdir("migrations")).filter(name=>name.endsWith(".sql")).sort()) {
    await db.exec(await readFile("migrations/"+name,"utf8"));
  }
  await db.transaction(async tx=>{await tx.exec("SET LOCAL search_path TO crm,public");await seedDemo(connection(tx));});
  return db;
}
export async function demoTransaction<T>(fn:(tx:Tx)=>Promise<T>,worker=false) {
  const db=await embedded();
  return db.transaction(async tx=>{
    await tx.exec("SET LOCAL ROLE "+(worker?"crm_worker":"crm_app")+"; SET LOCAL search_path TO crm,public; SET LOCAL statement_timeout TO '12s'");
    return fn(connection(tx));
  });
}
export function startEmbeddedWorker(tick:()=>Promise<void>) {
  if(globalDemo.cairnDemoTick || process.env.CRM_EMBEDDED_WORKER==="0")return;
  let busy=false;
  globalDemo.cairnDemoTick=setInterval(()=>{
    if(busy)return;
    busy=true;
    void tick().catch(error=>console.error("Embedded worker failed",(error as {code?:string}).code??"unknown")).finally(()=>{busy=false;});
  },1400);
  globalDemo.cairnDemoTick.unref();
}
