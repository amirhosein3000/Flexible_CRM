import type {Field} from "../domain/validation.ts";
import type {Locale} from "./config.ts";
import {searchText} from "./format.ts";
import {bilingual,message} from "./messages.ts";

export function csvColumns(locale:Locale,fields:Field[]) {
  const titleNames=["Title","Name",message("fa-IR","title"),message("fa-IR","name")];
  const names=fields.map(field=>bilingual(locale,field));
  const ambiguous=new Map<string,number>();
  for(const name of [...new Set(titleNames),...fields.flatMap(field=>[...new Set([field.name,field.name_fa].filter((value):value is string=>Boolean(value)))])]) {
    const key=searchText(name);
    ambiguous.set(key,(ambiguous.get(key)??0)+1);
  }
  return [
    {id:"title",name:message(locale,"title"),aliases:titleNames},
    ...fields.map((field,index)=>{
      const key=searchText(names[index]);
      const sourceNames=[...new Set([field.name,field.name_fa].filter((value):value is string=>Boolean(value)))];
      const stable=sourceNames.map(name=>name+" ["+field.id+"]");
      return {
        id:field.id,
        name:(ambiguous.get(key)??0)>1?names[index]+" ["+field.id+"]":names[index],
        aliases:[...stable,...sourceNames.filter(name=>ambiguous.get(searchText(name))===1)]
      };
    })
  ];
}
