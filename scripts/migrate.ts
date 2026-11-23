import { readdir, readFile } from "node:fs/promises";
import pg from "pg";
try {process.loadEnvFile?.(process.env.CRM_ENV_FILE || ".env");} catch(error) {if((error as {code?:string}).code!=="ENOENT") throw error;}
const db = new pg.Client({connectionString: process.env.MIGRATION_DATABASE_URL});
await db.connect();
try {
  await db.query("CREATE TABLE IF NOT EXISTS public.crm_migrations(name text PRIMARY KEY, applied_at timestamptz DEFAULT now())");
  for (const file of (await readdir("migrations")).filter(name => name.endsWith(".sql")).sort()) {
    await db.query("BEGIN");
    try {
      await db.query("SELECT pg_advisory_xact_lock(48893)");
      if (!(await db.query("SELECT 1 FROM public.crm_migrations WHERE name=$1", [file])).rowCount) {
        await db.query(await readFile("migrations/" + file,"utf8"));
        await db.query("INSERT INTO public.crm_migrations VALUES($1)", [file]);
        console.log("Applied",file);
      }
      await db.query("COMMIT");
    } catch(error) {
      await db.query("ROLLBACK");
      throw error;
    }
  }
} finally { await db.end(); }
