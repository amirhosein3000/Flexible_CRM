import {Problem} from "./db.ts";

const DAY=86400000, MINUTE=60000;
const cache=new Map<string,Intl.DateTimeFormat>();
function formatter(zone:string) {
  const existing=cache.get(zone);
  if(existing)return existing;
  try {
    const result=new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
    if(cache.size>=128)cache.clear();
    cache.set(zone,result);
    return result;
  } catch {throw new Problem(422,"Choose a valid IANA time zone.");}
}
export function validateZone(zone:string) {formatter(zone);}
function localMinute(timestamp:number,zone:string) {
  const parts=Object.fromEntries(formatter(zone).formatToParts(timestamp).map(part=>[part.type,part.value]));
  return Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute));
}
function resolveMinute(local:number,zone:string) {
  const offsets=new Set([local-DAY,local,local+DAY].map(sample=>localMinute(sample,zone)-sample));
  const candidates=[...offsets].map(offset=>local-offset);
  const exact=candidates.filter(candidate=>localMinute(candidate,zone)===local);
  if(exact.length)return Math.min(...exact);
  // A skipped wall-clock time runs at the first valid time on that local date.
  const left=Math.min(...candidates),right=Math.max(...candidates);
  let closest:number|undefined;
  for(let t=left;t<=right;t+=MINUTE){
    const wall=localMinute(t,zone);
    if(wall>=local && (closest===undefined||wall<localMinute(closest,zone)))closest=t;
  }
  return closest??right;
}
export function nextOccurrence(time:string,frequency:"daily"|"weekly",zone:string,now=new Date(),previous?:Date) {
  const current=now.getTime();
  const [hour,minute]=time.split(":").map(Number);
  const start=Math.floor(localMinute((previous??now).getTime(),zone)/DAY)*DAY;
  const interval=frequency==="weekly"?7:1;
  let wall=start+(hour*60+minute)*MINUTE+(previous?interval*DAY:0);
  const observed=Math.floor(localMinute(current,zone)/DAY)*DAY;
  if(wall+interval*DAY<observed)wall+=Math.floor((observed-wall)/(interval*DAY))*interval*DAY;
  let utc=resolveMinute(wall,zone);
  if(utc<=current)utc=resolveMinute(wall+interval*DAY,zone);
  return new Date(utc).toISOString();
}
