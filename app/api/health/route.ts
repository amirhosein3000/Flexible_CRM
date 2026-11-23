import {ready} from "../../../src/domain/db";
export async function GET() {
  try {await ready();return Response.json({status:"ready"});}
  catch {return Response.json({status:"unavailable"},{status:503});}
}
