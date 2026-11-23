import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import {englishError} from "../i18n/errors.ts";
import type {Locale} from "../i18n/config.ts";
import type {Values} from "../i18n/messages.ts";
import pg, { type PoolClient, type QueryResultRow } from "pg";

export const pool = new pg.Pool({connectionString: process.env.DATABASE_URL, max: 10});
export const database = drizzle(pool);
export type Role = "owner" | "admin" | "member" | "viewer";
export type User = {id: string; name: string; email: string};
export type Tx = PoolClient;
export type Scope = {tx: Tx; workspace: string; actor: string; role: Role; locale?:Locale};
export class Problem extends Error {
  readonly status: number;
  readonly source: string;
  readonly values?: Values;
  constructor(status:number,source:string,values?:Values) {super(englishError(source,values));this.status=status;this.source=source;this.values=values;}
}
export const denied = () => new Problem(403,"You don’t have permission to do that.");
export const missing = () => new Problem(404,"This item could not be found.");
export const stale = () => new Problem(409,"This item changed. Refresh and try again.");
export async function transaction<T>(fn: (tx: Tx) => Promise<T>,worker=false): Promise<T> {
  if(process.env.CRM_DEMO==="1" && process.env.CRM_EMBEDDED_DEMO==="1") return (await import("./demo.ts")).demoTransaction(fn,worker);
  const tx = await pool.connect();
  try {
    await tx.query("BEGIN");
    await tx.query("SET LOCAL search_path TO crm,public; SET LOCAL statement_timeout TO '12s'");
    const result = await fn(tx);
    await tx.query("COMMIT");
    return result;
  } catch (error) {
    await tx.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {tx.release();}
}
export async function setContext(tx: Tx, workspace: string, actor: string) {
  await tx.query("SELECT set_config('crm.workspace',$1,true),set_config('crm.actor',$2,true)",[workspace,actor]);
}
export async function withScope<T>(user: User, workspace: string, action: (scope: Scope) => Promise<T>,locale?:Locale) {
  return transaction(async tx => {
    await setContext(tx,"",user.id);
    const row = await one<{role:Role}>(tx,"SELECT role FROM memberships WHERE workspace_id=$1 AND user_id=$2 AND active FOR SHARE",[workspace,user.id]);
    if (!row) throw missing();
    await setContext(tx,workspace,user.id);
    return action({tx,workspace,actor:user.id,role:row.role,locale});
  });
}
export async function rows<T extends QueryResultRow>(tx: Tx, query: string, args: unknown[] = []) {
  return (await tx.query<T>(query,args)).rows;
}
export async function one<T extends QueryResultRow>(tx: Tx, query: string, args: unknown[] = []) {
  return (await rows<T>(tx,query,args))[0];
}
export function requireRole(scope: Scope, roles: Role[]) {
  if (!roles.includes(scope.role)) throw denied();
}
export const canWrite: Role[] = ["owner","admin","member"];
export const canManage: Role[] = ["owner","admin"];
export async function audit(scope: Scope,event: string,target?: string) {
  await scope.tx.query("INSERT INTO audit(workspace_id,actor_id,event,target_id) VALUES($1,$2,$3,$4)",[scope.workspace,scope.actor,event,target ?? null]);
}
export async function ready() {
  if(process.env.CRM_DEMO==="1"&&process.env.CRM_EMBEDDED_DEMO==="1") {await (await import("./demo.ts")).embedded();return;}
  await database.execute(sql`SELECT 1`);
}
