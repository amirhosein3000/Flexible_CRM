import {cookies} from "next/headers";
import {calendarCookie,localeCookie,resolveCalendar,resolveLocale} from "./config.ts";
export async function preferences() {
  const jar=await cookies();
  return {locale:resolveLocale(jar.get(localeCookie)?.value),calendar:resolveCalendar(jar.get(calendarCookie)?.value)};
}
