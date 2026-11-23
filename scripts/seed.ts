import pg from "pg";
try {process.loadEnvFile?.(process.env.CRM_ENV_FILE||".env");} catch(error) {if((error as {code?:string}).code!=="ENOENT") throw error;}
if(process.env.CRM_DEMO!=="1") throw new Error("Set CRM_DEMO=1 to load synthetic data.");
const {seedDemo}=await import("../src/domain/seed-demo.ts");
const {pool}=await import("../src/domain/db.ts");
const admin=new pg.Pool({connectionString:process.env.MIGRATION_DATABASE_URL});
const tx=await admin.connect();
try {
  await tx.query("BEGIN");
  await tx.query("SET LOCAL search_path TO crm,public");
  const changed=await seedDemo(tx);
  await tx.query("COMMIT");
  console.log(changed?"Seeded two synthetic workspaces.":"Demo already exists.");
} catch(error) {await tx.query("ROLLBACK");throw error;}
finally {tx.release();await admin.end();await pool.end();}
