import { createHash, randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { one, rows, setContext, transaction, type User, type Tx, Problem } from "./db.ts";
const cookieName = "cairn_session";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export function passwordHash(password: string, salt = randomBytes(16).toString("hex")) {
  return salt + ":" + scryptSync(password,salt,64).toString("hex");
}
const deriveKey=promisify(scrypt);
async function matches(password: string, reference: string) {
  const [salt] = reference.split(":");
  const key=await deriveKey(password,salt,64) as Buffer;
  return timingSafeEqual(Buffer.from(salt+":"+key.toString("hex")),Buffer.from(reference));
}
export function cookie(token: string) {
  const uri = process.env.APP_ORIGIN || "http://127.0.0.1:3000";
  return cookieName+"="+token+"; Path=/; HttpOnly; SameSite=Lax; Max-Age="+(token ? 604800 : 0)+(uri.startsWith("https:") ? "; Secure" : "");
}
export function getToken(request: Request) {
  return request.headers.get("cookie")?.split(/;\s*/).find(entry=>entry.startsWith(cookieName+"="))?.slice(cookieName.length+1);
}
export async function session(request: Request) {
  const token = getToken(request);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return undefined;
  return transaction(tx => one<User>(tx,"SELECT u.id,u.name,u.email FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()",[hash(token)]));
}
export async function signIn(email: string,password: string) {
  const normalized=email.trim().toLowerCase();
  const result=await transaction(async tx => {
    const account = await one<User & {password:string}>(tx,"SELECT id,name,email,password FROM users WHERE email=$1",[normalized]);
    // Bound storage for unknown accounts while limiting each registered account independently.
    const key=account ? hash(normalized) : "unknown:"+hash(normalized).slice(0,3);
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,1))",[key]);
    const current=await one<{hits:number}>(tx,"SELECT hits FROM sign_in_failures WHERE key=$1 AND expires_at>now()",[key]);
    if((current?.hits??0)>=8) return {status:429} as const;
    const valid = await matches(password,account?.password ?? fallback);
    if (!account || !valid) {
      await tx.query("INSERT INTO sign_in_failures (key,hits,expires_at) VALUES ($1,1,now()+interval '10 minutes') ON CONFLICT (key) DO UPDATE SET hits=$2,expires_at=CASE WHEN sign_in_failures.expires_at>now() THEN sign_in_failures.expires_at ELSE excluded.expires_at END",[key,(current?.hits??0)+1]);
      return {status:401} as const;
    }
    if(current) await tx.query("DELETE FROM sign_in_failures WHERE key=$1",[key]);
    return {token:await createSession(tx,account.id)};
  });
  if(result.status===429) throw new Problem(429,"Try signing in again in 10 minutes.");
  if(result.status===401) throw new Problem(401,"The email or password is incorrect.");
  return result.token;
}
export async function createSession(tx:Tx,userId:string) {
  const token=randomBytes(32).toString("hex");
  await tx.query("INSERT INTO sessions VALUES($1,$2,now()+interval '7 days')",[hash(token),userId]);
  return token;
}
const fallback = passwordHash("invalid-account-padding","77ed97369d3251469c264b94e1bb50bb4");
export async function signOut(request: Request) {
  const token = getToken(request);
  if (token) await transaction(tx=>tx.query("DELETE FROM sessions WHERE token_hash=$1",[hash(token)]));
}
export async function spaces(user: User) {
  return transaction(async tx => {
    await setContext(tx,"",user.id);
    return rows<{id:string;name:string;role:string}>(tx,"SELECT w.id,w.name,m.role FROM workspaces w JOIN memberships m ON m.workspace_id=w.id WHERE m.user_id=$1 AND m.active ORDER BY w.name",[user.id]);
  });
}
