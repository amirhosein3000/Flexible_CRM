import { z } from "zod";
import {asciiDigits,canonicalNumber,searchText} from "../i18n/format.ts";
import { Problem } from "./db.ts";
export const id = z.uuid();
export const title = z.string().trim().min(1,"Enter a name.").max(160);
export const dueDate = z.iso.date().nullable().optional();
export const value = z.union([z.string().max(8000),z.boolean(),z.number().finite(),z.array(z.string()).max(50),z.null()]);
export const fieldKinds = ["text","longtext","decimal","number","currency","date","timestamp","boolean","email","phone","url","select","multi"] as const;
export type FieldKind = typeof fieldKinds[number];
export type Field = {id:string;name:string;name_fa?:string|null;kind:FieldKind;required:boolean;options:string[];archived?:boolean;position:number};
export type FieldValue = z.infer<typeof value>;
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    if(issue.message==="Enter a name.")throw new Problem(422,"Enter a name.");
    if(issue.code==="invalid_format"&&issue.format==="email")throw new Problem(422,"Enter a valid email address.");
    if(issue.code==="invalid_format"&&(issue.format==="date"||issue.format==="datetime"))throw new Problem(422,"Enter a valid date.");
    if(issue.code==="too_small"&&issue.origin==="string")throw new Problem(422,"Enter at least {minimum, number} characters.",{minimum:Number(issue.minimum)});
    if(issue.code==="too_big"&&issue.origin==="string")throw new Problem(422,"Use at most {maximum, number} characters.",{maximum:Number(issue.maximum)});
    throw new Problem(422,"Enter a valid value.");
  }
  return result.data;
}
export function normalize(field: Field,raw: FieldValue): FieldValue {
  const error = new Problem(422,"Check the value for {field}.",{field:field.name});
  if (raw === null || raw === "" || (Array.isArray(raw) && !raw.length)) {
    if (field.required) throw new Problem(422,"{field} is required.",{field:field.name});
    return raw === "" ? null : raw;
  }
  if (field.kind === "boolean") {
    if (typeof raw !== "boolean") throw error;
    return raw;
  }
  if (field.kind === "multi") {
    if (!Array.isArray(raw) || raw.some(it=>!field.options.includes(it))) throw error;
    return [...new Set(raw)];
  }
  if (["decimal","number","currency"].includes(field.kind)) {
    if (typeof raw !== "string" && typeof raw !== "number") throw error;
    const decimal = canonicalNumber(String(raw));
    if (!/^-?\d{1,18}(\.\d{1,8})?$/.test(decimal)) throw error;
    return decimal;
  }
  if (typeof raw !== "string") throw error;
  const text = raw.trim();
  if (text.length > (field.kind === "longtext" ? 8000 : 500) || (!text && field.required)) throw error;
  if (field.kind === "date" && !z.iso.date().safeParse(text).success) throw error;
  if (field.kind === "timestamp") {
    if(!z.iso.datetime({offset:true,local:true}).safeParse(text).success)throw error;
    return new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(text)?text:text+"Z").toISOString();
  }
  if (field.kind === "email" && !z.email().safeParse(text).success) throw error;
  if (field.kind === "phone") {const phone=asciiDigits(text); if(!/^[+0-9][0-9 .()\-]{2,29}$/.test(phone))throw error;return phone;}
  if (field.kind === "url") {
    try { const url = new URL(text); if (!["http:","https:"].includes(url.protocol)||url.username||url.password) throw error; }
    catch {throw error;}
  }
  if (field.kind === "select" && !field.options.includes(text)) throw error;
  return text || null;
}
export function valuesFor(fields: Field[], patch: Record<string,FieldValue>, old: Record<string,FieldValue> = {}) {
  const active = fields.filter(field=>!field.archived);
  const result = {...old};
  for (const key of Object.keys(patch)) if (!active.some(field=>field.id===key)) throw new Problem(422,"A field was removed. Refresh and try again.");
  for (const field of active) {
    const current = normalize(field,field.id in patch ? patch[field.id] : old[field.id] ?? null);
    if (current === null) delete result[field.id];
    else result[field.id] = current;
  }
  return result;
}

export function prefixSearch(input:string) {
  return (searchText(asciiDigits(input)).match(/[\p{L}\p{N}]+/gu)??[]).slice(0,12).map(term=>term+":*").join(" & ");
}
