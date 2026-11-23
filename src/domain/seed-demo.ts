import {randomUUID} from "node:crypto";
import {passwordHash} from "./auth.ts";
import type {Tx} from "./db.ts";
import {applyTemplate,addRelation,link} from "./workspace.ts";
import {activity,addField,addTask,pipelines,saveRecord,object,fields} from "./crm.ts";
export async function seedDemo(tx:Tx) {
  if((await tx.query("SELECT 1 FROM users WHERE email='demo@cairn.example'")).rowCount) return false;
  const [owner,alternate,viewer,team,other]=Array.from({length:5},()=>randomUUID());
  const hash=passwordHash("Cairn-demo-2026!");
  await tx.query("INSERT INTO users(id,email,name,password) VALUES($1,'demo@cairn.example','Avery Morgan',$4),($2,'sam@cairn.example','Sam Patel',$4),($3,'viewer@cairn.example','Jules Hart',$4)",[owner,alternate,viewer,hash]);
  await tx.query("INSERT INTO workspaces(id,name) VALUES($1,'Studio North'),($2,'Recruiting Lab')",[team,other]);
  await tx.query("INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$3,'owner'),($1,$4,'member'),($1,$5,'viewer'),($2,$3,'owner')",[team,other,owner,alternate,viewer]);
  const base={tx,actor:owner,role:"owner" as const};
  const scope={...base,workspace:team}, sandbox={...base,workspace:other};
  const consulting=await applyTemplate(scope,"consulting"), recruiting=await applyTemplate(sandbox,"recruitment");
  if(!consulting.objects||!recruiting.objects) throw new Error("Template not created");
  const [op,contact,company,lead]=consulting.objects;
  const market=await addField(scope,{objectId:company.id,name:"Industry",kind:"select",options:["Design","Software","Real estate","Financial services","Consulting"]});
  await tx.query("UPDATE fields SET name_fa=$3 WHERE workspace_id=$1 AND id=$2",[team,market.id,"حوزهٔ فعالیت"]);
  const [board]=await pipelines(scope);
  const revision=(id:string)=>object(scope,id).then(o=>o.revision);
  const companies=["Beacon Studio","Northstar Labs","Forma Design","Oxbow Partners","Common Ground","Horizon Works","Fieldwork Creative","Wavelength"];
  const names=["Sasha Cole","Amara Wynn","Daniel Mercer","Noor Rahman","Elliot Brooks","Lena Park"];
  const labels=["Brand strategy retainer","Platform redesign","Partner onboarding","Enterprise rollout","Research sprint","Content strategy","Advisory engagement","Client portal build","Q1 launch program","Customer journey audit","Growth partnership","Service design project","Annual strategy program","Website refresh"];
  const stages=[0,0,0,1,1,1,1,2,2,2,3,3,4,4], values=[19500,27000,12000,55000,8600,18000,34000,48000,32000,26000,25000,47000,92000,39000];
  const [website,email,budget]=await Promise.all([fields(scope,company.id).then(f=>f.find(x=>x.kind==="url")!.id),fields(scope,contact.id).then(f=>f[0].id),fields(scope,op.id).then(f=>f[0].id)]);
  const companyIds=[];
  for(const [i,name] of companies.entries()) companyIds.push((await saveRecord(scope,{objectId:company.id,revision:await revision(company.id),title:name,ownerId:i%2?alternate:owner,fields:{[website]:"https://example.com/"+name.toLowerCase().replaceAll(" ","-"),[market.id]:["Design","Software","Design","Consulting","Real estate","Software","Design","Financial services"][i]}})).id);
  for(const [i,name] of names.entries()) await saveRecord(scope,{objectId:contact.id,revision:await revision(contact.id),title:name,ownerId:i%2?alternate:owner,fields:{[email]:name.toLowerCase().replaceAll(" ",".")+"@example.com"}});
  const relation=await addRelation(scope,{source:op.id,target:company.id,label:"Client company",inverse:"Opportunities",cardinality:"many-many"});
  await tx.query("UPDATE relations SET label_fa=$3,inverse_fa=$4 WHERE workspace_id=$1 AND id=$2",[team,relation.id,"شرکت طرف قرارداد","فرصت‌ها"]);
  await saveRecord(scope,{objectId:company.id,revision:await revision(company.id),title:"شرکت كيان داده",ownerId:owner,fields:{[website]:"https://example.com/kian-data"}});
  const opportunities=[];
  for(const [i,label] of labels.entries()) {
    const row=await saveRecord(scope,{objectId:op.id,revision:await revision(op.id),title:label,ownerId:i%2?alternate:owner,pipelineId:board.id,stageId:board.stages[stages[i]].id,fields:{[budget]:String(values[i])}});
    opportunities.push(row.id);
    await link(scope,{relation:relation.id,source:row.id,target:companyIds[i%companyIds.length]});
    if(i<5) await activity(scope,{recordId:row.id,kind:i%2?"meeting":"note",body:["Shared the first brief and agreed on the scope for discovery.","Confirmed the stakeholder workshop for next week.","Sent an updated scope with two implementation options.","Budget review complete. Follow up on the proposed timeline.","Client requested a short walkthrough for the wider team."][i]});
  }
  for(const name of ["Paper Kite","Meridian Consulting","Earlybird Co."]) await saveRecord(scope,{objectId:lead.id,revision:await revision(lead.id),title:name,ownerId:owner});
  const work=[["Send revised proposal",0,-2],["Follow up with Northstar",1,0],["Prepare discovery questions",3,1],["Confirm kickoff availability",5,3],["Review statement of work",7,5]] as const;
  for(const [label,index,days] of work) {
    const date=new Date();date.setUTCDate(date.getUTCDate()+days);
    await addTask(scope,{recordId:opportunities[index],assigneeId:index%2?alternate:owner,title:label,dueDate:date.toISOString().slice(0,10)});
  }
  const check=recruiting.objects[1];
  await saveRecord(sandbox,{objectId:check.id,revision:(await object(sandbox,check.id)).revision,title:"Recruiting Lab test candidate",ownerId:owner});
  await tx.query("UPDATE workspaces SET currency='USD' WHERE id=$1",[team]);
  await tx.query("UPDATE outbox SET outcome='completed' WHERE workspace_id=$1",[team]);
  return true;
}
