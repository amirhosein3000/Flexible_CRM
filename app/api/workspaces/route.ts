import {session} from "../../../src/domain/auth";
import {Problem} from "../../../src/domain/db";
import {createWorkspace} from "../../../src/domain/workspace";
import {body,guard,json,protect} from "../../../src/server/http";

export async function POST(request:Request) {
  return guard(request,async()=>{
    protect(request);
    const user=await session(request);
    if(!user)throw new Problem(401,"Sign in to continue.");
    return json(await createWorkspace(user,await body(request)),201);
  });
}
