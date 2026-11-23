import {z} from "zod";
import {audit,canManage,one,Problem,requireRole,type Scope} from "./db.ts";
import {validateZone} from "./schedule.ts";
import {parse} from "./validation.ts";
export async function regionalSettings(scope:Scope) {
  const row=await one<{currency:string|null;time_zone:string}>(scope.tx,"SELECT currency,time_zone FROM workspaces WHERE id=$1",[scope.workspace]);
  return {currency:row.currency,timeZone:row.time_zone};
}
export async function saveRegion(scope:Scope,input:unknown) {
  requireRole(scope,canManage);
  const data=parse(z.object({currency:z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).nullable(),timeZone:z.string().trim().min(1).max(80)}),input);
  validateZone(data.timeZone);
  if(data.currency&&!Intl.supportedValuesOf("currency").includes(data.currency)) throw new Problem(422,"Choose a supported ISO currency code.");
  await scope.tx.query("UPDATE workspaces SET currency=$2,time_zone=$3 WHERE id=$1",[scope.workspace,data.currency,data.timeZone]);
  await audit(scope,"workspace.regional_settings");
  return data;
}
