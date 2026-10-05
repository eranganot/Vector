/**
 * The application facade as the screens use it: every result comes back with its data text in the reader's language
 * (src/i18n/content.ts). Server actions keep using the facade directly; only what is shown is translated.
 */
import { api as facade, seededPeople as facadePeople } from "@/application/facade";
import { localize } from "@/i18n/content";
import { getLocale } from "./locale";

type Fn = (...args: never[]) => Promise<unknown>;

export const api = new Proxy(facade, {
  get(target, prop, receiver) {
    const f = Reflect.get(target, prop, receiver) as unknown;
    if (typeof f !== "function") return f;
    return async (...args: unknown[]) => localize(await (f as Fn)(...(args as never[])), await getLocale());
  },
}) as typeof facade;

export async function seededPeople() {
  return localize(await facadePeople(), await getLocale());
}

/** Any other value read for display. */
export async function localized<V>(v: V): Promise<V> {
  return localize(v, await getLocale());
}
