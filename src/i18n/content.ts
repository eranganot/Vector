/**
 * Hebrew for data (Eran, 2026-10-05: "translate everything"): seeded names and texts, and text the system generates
 * (detector, monitors, waiting labels). The database keeps the English original — the audit trail and the frozen
 * evidence are never rewritten — and the reader's language is applied when a view is shown.
 *
 * Exact strings come from HE_CONTENT; generated sentences match a template in HE_TEMPLATES, whose captured values are
 * translated in turn (a unit name inside a sentence). Text people typed (a lesson, a note) has no entry and stays as
 * written.
 */
import { HE_CONTENT as HE_BASE, HE_TEMPLATES as HE_BASE_TEMPLATES } from "./messages/he-content";
import { HE_INBOX, HE_INBOX_TEMPLATES } from "./messages/he-inbox";

/** Data translations: the base set wins over the Inbox set on a shared key. */
const HE_CONTENT: Record<string, string> = { ...HE_INBOX, ...HE_BASE };
const HE_TEMPLATES: Record<string, string> = { ...HE_INBOX_TEMPLATES, ...HE_BASE_TEMPLATES };

type Compiled = { re: RegExp; names: string[]; he: string };

/** Placeholders that only ever hold numbers, money, dates or date windows. */
const NUMERIC = new Set(["n", "d", "h", "z", "pct", "pts", "max", "from", "to", "date", "w1", "w2", "o"]);
const SHAPES: Record<string, string> = { m: "(₪[\\d.,]+[kM]?)", band: "([PO]\\d)" };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function compile(en: string, he: string): Compiled {
  const names: string[] = [];
  const re = en
    .split(/(\{\w+\})/)
    .map((part) => {
      const m = /^\{(\w+)\}$/.exec(part);
      if (!m) return escape(part);
      names.push(m[1]);
      // Numbers, money, dates and windows never contain words: "{d} Oct" must not match "Friday Oct".
      return SHAPES[m[1]] ?? (NUMERIC.has(m[1]) ? "([^A-Za-z]+?)" : "(.+?)");
    })
    .join("");
  return { re: new RegExp(`^${re}$`, "s"), names, he };
}

let compiled: Compiled[] | null = null;
const templates = () => (compiled ??= Object.entries(HE_TEMPLATES).map(([en, he]) => compile(en, he)));

const misses = new Set<string>();
/** Untranslated data strings seen in Hebrew (development aid: `I18N_MISSES=1` logs them). */
export const contentMisses = () => [...misses];

/** One string in Hebrew, or undefined when there is no translation for it. */
export function heContent(s: string, depth = 0): string | undefined {
  const exact = HE_CONTENT[s];
  if (exact !== undefined) return exact;
  if (depth > 4 || s.length < 2) return undefined;
  for (const c of templates()) {
    const m = c.re.exec(s);
    if (!m) continue;
    const vals = Object.fromEntries(c.names.map((n, i) => [n, m[i + 1]]));
    return c.he.replace(/\{(\w+)\}/g, (_, k: string) => heValue(vals[k], depth + 1));
  }
  // Lists: "₪600k/week at stake · impact within 48 h · company-wide", "Plan A × Plan B".
  for (const sep of [" · ", " × ", " ↔ "]) {
    if (!s.includes(sep)) continue;
    const parts = s.split(sep).map((p) => heContent(p, depth + 1));
    if (parts.some((p) => p !== undefined)) return parts.map((p, i) => p ?? s.split(sep)[i]).join(sep);
  }
  return undefined;
}

/** A value inside a sentence: translated when known (a name, a phrase), else as is (a number, a typed text). */
function heValue(v: string, depth: number) {
  return heContent(v, depth) ?? v;
}

/** Field names that hold identifiers or codes, never text to translate. */
const SKIP =
  /(^id$|Id$|Ids$|^href$|^email$|^operation$|^entityType$|^key$|^code$|^sha256$|^hash$|^status$|[a-z]Status$|^kind$|^type$|^workstream$|^health$|^band$|^groupBand$|^position$|^unit$|^effect$|^verdict$|^role$|^executor$|^audience$|^direction$|^actorType$|^fromState$|^toState$|^generatedBy$|^model$|^resource$|^category$)/;

function note(s: string) {
  if (process.env.I18N_MISSES && /[A-Za-z]{2}/.test(s) && !/^[a-z0-9_.:-]+$/.test(s)) {
    if (!misses.has(s)) {
      misses.add(s);
      console.log(`[i18n-miss] ${JSON.stringify(s)}`);
    }
  }
}

/** A view with its data text in the reader's language (English: unchanged). Dates and other objects are kept. */
export function localize<V>(value: V, locale: string): V {
  if (locale !== "he") return value;
  const walk = (v: unknown, key = ""): unknown => {
    if (typeof v === "string") {
      if (SKIP.test(key)) return v;
      const he = heContent(v);
      if (he === undefined) note(v);
      return he ?? v;
    }
    if (Array.isArray(v)) return v.map((x) => walk(x, key));
    if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, k)]));
    }
    return v;
  };
  return walk(value) as V;
}
