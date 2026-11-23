import Workspace from "../../../../src/ui/workspace";
export default async function Invite({params}:{params:Promise<{workspace:string;token:string}>}) {
  return <Workspace invitation={await params}/>;
}
