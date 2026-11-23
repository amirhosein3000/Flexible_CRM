import {Problem} from "../domain/db";
import {requestLocale} from "../i18n/config";
import {errorText} from "../i18n/errors";
export function json(body:unknown,status=200,headers:HeadersInit={}) {
  return Response.json(body,{status,headers:{"Cache-Control":"no-store",...headers}});
}
export async function guard(request:Request,fn:()=>Promise<Response>) {
  try {return await fn();}
  catch(error) {
    const locale=requestLocale(request);
    if(error instanceof Problem) return json({error:errorText(locale,error.source,error.values)},error.status);
    if(error instanceof SyntaxError) return json({error:errorText(locale,"The request could not be read.")},400);
    const code=(error as {code?:string}).code;
    if(code==="23505") return json({error:errorText(locale,"A matching item already exists or this link exceeds its allowed cardinality.")},409);
    if(code==="23503") return json({error:errorText(locale,"The related item could not be found.")},404);
    console.error("CRM request failed",code??(error instanceof Error?error.name:"Unknown"));
    return json({error:errorText(locale,"Cairn couldn’t complete this request. Try again.")},500);
  }
}
export function protect(request:Request) {
  const expected=process.env.APP_ORIGIN || "http://127.0.0.1:3000";
  if(request.headers.get("origin")!==expected) throw new Problem(403,"This request must originate from Cairn.");
}
export async function body(request:Request):Promise<unknown> {
  const reader=request.body?.getReader();
  if(!reader) return {};
  let bytes=0, result="";
  const decoder=new TextDecoder();
  for(;;) {
    const {done,value}=await reader.read();
    if(done) break;
    bytes+=value.byteLength;
    if(bytes>1_100_000) {await reader.cancel();throw new Problem(413,"The request is too large.");}
    result+=decoder.decode(value,{stream:true});
  }
  return JSON.parse(result+decoder.decode());
}
