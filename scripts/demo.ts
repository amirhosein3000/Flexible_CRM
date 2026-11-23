import next from "next";
import {createServer} from "node:http";
try {process.loadEnvFile?.(".env");} catch(error) {if((error as {code?:string}).code!=="ENOENT") throw error;}
process.env.CRM_DEMO="1";
process.env.CRM_EMBEDDED_DEMO="1";
process.env.NEXT_PUBLIC_CRM_DEMO="1";
const hostname="127.0.0.1",port=Number(process.env.CRM_DEMO_PORT??3000);
process.env.APP_ORIGIN="http://"+hostname+":"+port;
const app=next({dev:false,hostname,port});
const serve=app.getRequestHandler();
await app.prepare();
const {ready}=await import("../src/domain/db.ts");
await ready();
createServer((request,response)=>void serve(request,response)).listen(port,hostname,()=>console.log("Cairn demo ready at "+process.env.APP_ORIGIN));
