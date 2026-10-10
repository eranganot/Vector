/**
 * Market data fetcher (plan v2, E6; market-intelligence.md §1–§3). Pulls real, public data and writes a compact
 * snapshot to data/market/ that the seed loads, so the demo never depends on the network:
 *  - CBS price indices (api.cbs.gov.il): the CPI, food, and the food sub-groups, 24 months.
 *  - The chains' price-transparency files (published by law): Shufersal (its own site) and Rami Levy, Osher Ad,
 *    Yohananof and Tiv Taam (the shared portal's public accounts). Today's full price file for up to 2 stores per
 *    chain and region, a 150-item basket of barcodes sold by every chain, and each chain's median price per item and
 *    region. Every file is recorded with its URL, time and SHA-256, so a figure can be traced to its file.
 * Fetches politely: one request at a time, a pause between files. Usage: pnpm market:fetch
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

type Region = "NORTH" | "COAST" | "CENTER" | "JERUSALEM" | "SOUTH";
const PAUSE_MS = 400;
const STORES_PER_REGION = 2;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
/** The chains' XML is UTF-8 or UTF-16 (with a byte-order mark): decode by the mark. */
const decode = (b: Buffer) =>
  b[0] === 0xff && b[1] === 0xfe
    ? b.subarray(2).toString("utf16le")
    : b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf
      ? b.subarray(3).toString("utf8")
      : b.toString("utf8");

/** CBS locality codes of the cities our regions cover (and their neighbours), by our region (synthetic-data.md). */
const CITY_REGION: Record<string, Region> = {
  // North
  "4000": "NORTH",
  "7300": "NORTH",
  "6800": "NORTH",
  "1139": "NORTH",
  "7600": "NORTH",
  "9100": "NORTH",
  "6700": "NORTH",
  "7700": "NORTH",
  "2800": "NORTH",
  "240": "NORTH",
  "8000": "NORTH",
  "9500": "NORTH",
  "8200": "NORTH",
  "2500": "NORTH",
  "2100": "NORTH",
  "874": "NORTH",
  "9200": "NORTH",
  "1263": "NORTH",
  // Coast
  "7400": "COAST",
  "6500": "COAST",
  "6400": "COAST",
  "9700": "COAST",
  "6900": "COAST",
  "168": "COAST",
  "1020": "COAST",
  "7800": "COAST",
  "8700": "COAST",
  "9300": "COAST",
  "9800": "COAST",
  "2650": "COAST",
  // Center
  "5000": "CENTER",
  "8600": "CENTER",
  "6300": "CENTER",
  "6100": "CENTER",
  "7900": "CENTER",
  "6600": "CENTER",
  "6200": "CENTER",
  "8300": "CENTER",
  "8400": "CENTER",
  "1200": "CENTER",
  "2640": "CENTER",
  "2620": "CENTER",
  "2400": "CENTER",
  "7200": "CENTER",
  "2660": "CENTER",
  "7000": "CENTER",
  "8500": "CENTER",
  "2530": "CENTER",
  "1304": "CENTER",
  // Jerusalem
  "3000": "JERUSALEM",
  "2610": "JERUSALEM",
  "3616": "JERUSALEM",
  "1015": "JERUSALEM",
  "3730": "JERUSALEM",
  "472": "JERUSALEM",
  // South
  "9000": "SOUTH",
  "70": "SOUTH",
  "7100": "SOUTH",
  "2630": "SOUTH",
  "246": "SOUTH",
  "31": "SOUTH",
  "1031": "SOUTH",
  "2200": "SOUTH",
  "2560": "SOUTH",
  "831": "SOUTH",
  "2600": "SOUTH",
};
/** City names as the chains write them, for files that give a name instead of a code. */
const NAME_REGION: [RegExp, Region][] = [
  [
    /חיפה|נצרת|קרית אתא|קריית אתא|כרמיאל|עכו|נהרי|טבריה|עפולה|קרית שמונה|קריית שמונה|יקנעם|צפת|קרית ביאליק|קריית ביאליק|קרית מוצקין|קריית מוצקין|נשר|טירת כרמל|מגדל העמק|בית שאן/,
    "NORTH",
  ],
  [/נתניה|חדרה|הרצליה|הוד השרון|כפר סבא|כפר יונה|אור עקיבא|פרדס חנה|רעננה|זכרון|בנימינה|רמת השרון/, "COAST"],
  [
    /תל אביב|ת"א|רמת גן|גבעתיים|בני ברק|פתח תקו|חולון|בת ים|ראשון לציון|ראשל"צ|רחובות|מודיעין|ראש העין|קרית אונו|קריית אונו|אור יהודה|נס ציונה|יבנה|לוד|רמלה/,
    "CENTER",
  ],
  [/ירושלים|בית שמש|מעלה אדומים|מבשרת|גבעת זאב|אבו גוש/, "JERUSALEM"],
  [/באר שבע|ב"ש|אשדוד|אשקלון|קרית גת|קריית גת|נתיבות|אופקים|שדרות|דימונה|ערד|ירוחם|אילת/, "SOUTH"],
];
const regionOf = (city: string, name: string): Region | null =>
  CITY_REGION[city.trim()] ?? NAME_REGION.find(([re]) => re.test(`${city} ${name}`))?.[1] ?? null;

/** Stores per chain in its published stores file (an estimate of store count, labelled as such). */
const storeCounts: Record<string, { total: number; byRegion: Record<string, number>; file: string }> = {};
const countStores = (chain: string, xml: string, file: string) => {
  const all = [...xml.matchAll(/<Store>([\s\S]*?)<\/Store>/gi)];
  const mapped = parseStores(xml, chain);
  const byRegion: Record<string, number> = {};
  for (const s of mapped) byRegion[s.region] = (byRegion[s.region] ?? 0) + 1;
  storeCounts[chain] = { total: all.length, byRegion, file };
};
type StoreRef = { chain: string; storeId: string; name: string; city: string; region: Region };
type PriceFile = {
  chain: string;
  store: StoreRef;
  url: string;
  fetchedAt: string;
  sha256: string;
  items: Map<string, Item>;
};
type Item = { code: string; name: string; maker: string; price: number; unitPrice: number | null; weighted: boolean };

async function get(url: string, init?: RequestInit): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) });
    // A redirect is an answer (the portal signs in with a 302), not a failure to retry.
    if (r.status < 500 || attempt === 3) return r;
    await sleep(2_000 * attempt);
  }
}
const tag = (xml: string, t: string) => xml.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`, "i"))?.[1]?.trim() ?? "";
function parseItems(xml: string): Map<string, Item> {
  const out = new Map<string, Item>();
  for (const m of xml.matchAll(/<Item>([\s\S]*?)<\/Item>/gi)) {
    const x = m[1];
    const code = tag(x, "ItemCode");
    const price = Number(tag(x, "ItemPrice"));
    if (!code || !(price > 0)) continue;
    out.set(code, {
      code,
      name: tag(x, "ItemName"),
      maker: tag(x, "ManufacturerName") || tag(x, "ManufactureName"),
      price,
      unitPrice: Number(tag(x, "UnitOfMeasurePrice")) || null,
      weighted: tag(x, "bIsWeighted") === "1",
    });
  }
  return out;
}
function parseStores(xml: string, chain: string): StoreRef[] {
  const out: StoreRef[] = [];
  for (const m of xml.matchAll(/<Store>([\s\S]*?)<\/Store>/gi)) {
    const s = m[1];
    const storeId = tag(s, "StoreID") || tag(s, "StoreId");
    const name = tag(s, "StoreName");
    const city = tag(s, "City");
    const region = regionOf(city, name);
    if (storeId && region) out.push({ chain, storeId: storeId.replace(/^0+/, ""), name, city, region });
  }
  return out;
}
/**
 * Up to 2 stores per region. A chain's main format comes first, so its index is not skewed by a premium urban format
 * (Shufersal: "דיל" Deal stores before "שלי" Sheli and Express).
 */
const MAIN_FORMAT: Record<string, RegExp> = { shufersal: /דיל/ };
const pick = (stores: StoreRef[]) =>
  (["NORTH", "COAST", "CENTER", "JERUSALEM", "SOUTH"] as Region[]).flatMap((r) => {
    const main = MAIN_FORMAT[stores[0]?.chain ?? ""];
    const inRegion = stores.filter((s) => s.region === r);
    const ranked = main
      ? [...inRegion.filter((s) => main.test(s.name)), ...inRegion.filter((s) => !main.test(s.name))]
      : inRegion;
    return ranked.slice(0, STORES_PER_REGION);
  });

// ── Shufersal: its own site lists today's files with time-limited blob links ──
async function shufersal(): Promise<PriceFile[]> {
  const page = async (cat: number, storeId = 0, p = 1) =>
    (
      await (
        await get(`https://prices.shufersal.co.il/FileObject/UpdateCategory?catID=${cat}&storeId=${storeId}&page=${p}`)
      ).text()
    ).replace(/&amp;/g, "&");
  const storesHtml = await page(5);
  const storesUrl = storesHtml.match(/href="(https:\/\/pricesprodpublic[^"]+)"/)?.[1];
  if (!storesUrl) throw new Error("Shufersal: no stores file");
  const storesXml = decode(gunzipSync(Buffer.from(await (await get(storesUrl)).arrayBuffer())));
  countStores("shufersal", storesXml, storesUrl.split("?")[0]);
  const chosen = pick(parseStores(storesXml, "shufersal"));
  const files: PriceFile[] = [];
  for (const store of chosen) {
    await sleep(PAUSE_MS);
    const html = await page(2, Number(store.storeId));
    const url = html.match(/href="(https:\/\/pricesprodpublic[^"]+pricefull[^"]+)"/i)?.[1];
    if (!url) continue;
    const buf = Buffer.from(await (await get(url)).arrayBuffer());
    files.push({
      chain: "shufersal",
      store,
      url: url.split("?")[0],
      fetchedAt: new Date().toISOString(),
      sha256: sha(buf),
      items: parseItems(decode(gunzipSync(buf))),
    });
    console.log(`shufersal ${store.storeId} ${store.region} ${files.at(-1)!.items.size} items`);
  }
  return files;
}

// ── The shared portal (url.publishedprices.co.il): public accounts, no password ──
async function portal(chain: string, user: string): Promise<PriceFile[]> {
  const base = "https://url.publishedprices.co.il";
  // A cookie jar by name: the portal rotates its session cookie on sign-in, and the new value must replace the old.
  const jar = new Map<string, string>();
  const req = async (path: string, init: RequestInit = {}) => {
    const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const r = await get(base + path, { ...init, redirect: "manual", headers: { ...(init.headers ?? {}), cookie } });
    for (const c of r.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return r;
  };
  const csrf = (h: string) => h.match(/name="csrftoken" content="([^"]+)"/)?.[1] ?? "";
  const t1 = csrf(await (await req("/login")).text());
  await req("/login/user", {
    method: "POST",
    body: new URLSearchParams({ username: user, password: "", csrftoken: t1 }),
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
  const t2 = csrf(await (await req("/file")).text());
  const list = async (search: string) =>
    (await (
      await req("/file/json/dir", {
        method: "POST",
        body: new URLSearchParams({ csrftoken: t2, sSearch: search, iDisplayLength: "1000", sEcho: "1", cd: "/" }),
        headers: { "content-type": "application/x-www-form-urlencoded" },
      })
    ).json()) as { aaData: { fname: string; time: string }[] };
  const download = async (fname: string) => Buffer.from(await (await req(`/file/d/${fname}`)).arrayBuffer());
  const unzip = (b: Buffer) => decode(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b);

  const storesFile = (await list("Stores")).aaData.sort((a, b) => b.time.localeCompare(a.time))[0];
  if (!storesFile) throw new Error(`${chain}: no stores file`);
  const storesXml = unzip(await download(storesFile.fname));
  countStores(chain, storesXml, `${base}/file/d/${storesFile.fname}`);
  const chosen = pick(parseStores(storesXml, chain));
  const prices = (await list("PriceFull")).aaData.sort((a, b) => b.time.localeCompare(a.time));
  const files: PriceFile[] = [];
  for (const store of chosen) {
    // PriceFull<chain>-<subchain>-<store, 3 digits>-<date>…: today's latest file of that store.
    const f = prices.find((p) => new RegExp(`^PriceFull\\d+-\\d+-0*${store.storeId}-\\d{8}`).test(p.fname));
    if (!f) continue;
    await sleep(PAUSE_MS);
    const buf = await download(f.fname);
    files.push({
      chain,
      store,
      url: `${base}/file/d/${f.fname}`,
      fetchedAt: new Date().toISOString(),
      sha256: sha(buf),
      items: parseItems(unzip(buf)),
    });
    console.log(`${chain} ${store.storeId} ${store.region} ${files.at(-1)!.items.size} items`);
  }
  return files;
}

// ── Basket (market-intelligence.md §3) ──
const CATEGORIES: [string, RegExp][] = [
  ["dairy", /חלב|גבינ|יוגורט|קוטג|שמנת|חמאה|לבן|מעדן|יופלה|דנונה/],
  // Bread, cereals and dough products, as CBS groups them (index 120060).
  ["bakery", /לחם|פיתה|פיתות|חלה|לחמני|קמח|פתיתים|פסטה|ספגטי|אטריות|דגני/],
  ["meat_fish", /^(?!.*(מרק|רוטב|נודלס|בטעם|אבקה)).*(עוף|בשר|נקניק|טונה|סלמון|שניצל|פרגית|קבב|המבורגר|סרדינים)/],
  ["drinks", /משקה|מיץ|קולה|מים מינרל|סודה|בירה|נקטר|תה קר|ספרייט|פאנטה/],
  ["pantry", /אורז|סוכר|שמן|קפה|תה |שימור|רוטב|דבש|טחינה|קטשופ|מיונז|עדשים|חומוס|תבלין|מלח|ריבה/],
  ["snacks", /שוקולד|במבה|ביסלי|חטיף|עוגיות|ופל|סוכריות|צ'יפס|דובונים|קרקר/],
  ["household", /נייר טואלט|מגבות נייר|אבקת כביסה|מרכך|סבון|נוזל כלים|שמפו|אקונומיקה|מטליות|שקיות אשפה|טישו/],
];
const PER_CATEGORY = 22;

function buildBasket(files: PriceFile[], chains: string[]) {
  const presence = new Map<string, Set<string>>();
  const names = new Map<string, string>();
  for (const f of files)
    for (const it of f.items.values()) {
      if (it.weighted || it.code.length < 12) continue; // weighted produce and chain-internal codes are not comparable
      const s = presence.get(it.code) ?? new Set<string>();
      s.add(f.chain);
      presence.set(it.code, s);
      if (!names.has(it.code)) names.set(it.code, it.name);
    }
  const common = [...presence.entries()].filter(([, s]) => chains.every((c) => s.has(c))).map(([code]) => code);
  const storesWith = (code: string) => files.filter((f) => f.items.has(code)).length;
  const basket: { code: string; name: string; category: string }[] = [];
  for (const [cat, re] of CATEGORIES) {
    const items = common
      .filter((c) => re.test(names.get(c)!) && !basket.some((b) => b.code === c))
      .sort((a, b) => storesWith(b) - storesWith(a) || a.localeCompare(b))
      .slice(0, PER_CATEGORY);
    basket.push(...items.map((code) => ({ code, name: names.get(code)!, category: cat })));
  }
  return basket;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};

// ── CBS ──
const CBS_CODES: Record<string, string> = {
  "120010": "cpi",
  "110050": "food",
  "120230": "dairy",
  "120060": "bakery",
  "120130": "meat_fish",
  "120340": "drinks",
  "120200": "oils",
  "120370": "snacks",
  "120040": "produce",
};
async function cbs() {
  const out: {
    code: string;
    key: string;
    name: string;
    points: { period: string; index: number; mom: number; yoy: number }[];
    url: string;
  }[] = [];
  for (const [code, key] of Object.entries(CBS_CODES)) {
    await sleep(PAUSE_MS);
    const url = `https://api.cbs.gov.il/index/data/price?id=${code}&format=json&download=false&last=24&lang=en`;
    const d = (await (await get(url)).json()) as {
      month: {
        name: string;
        date: { year: number; month: number; percent: number; percentYear: number; currBase: { value: number } }[];
      }[];
    };
    const m = d.month[0];
    out.push({
      code,
      key,
      name: m.name,
      url,
      points: m.date
        .map((p) => ({
          period: `${p.year}-${String(p.month).padStart(2, "0")}`,
          index: p.currBase.value,
          mom: p.percent,
          yoy: p.percentYear,
        }))
        .sort((a, b) => a.period.localeCompare(b.period)),
    });
    console.log(`cbs ${code} ${key} ${out.at(-1)!.points.length} months`);
  }
  return out;
}

async function main() {
  const day = new Date().toISOString().slice(0, 10);
  const chains: [string, () => Promise<PriceFile[]>][] = [
    ["shufersal", shufersal],
    ["rami_levy", () => portal("rami_levy", "RamiLevi")],
    ["osher_ad", () => portal("osher_ad", "osherad")],
    ["yohananof", () => portal("yohananof", "yohananof")],
    ["tiv_taam", () => portal("tiv_taam", "TivTaam")],
  ];
  const files: PriceFile[] = [];
  for (const [name, run] of chains) {
    try {
      files.push(...(await run()));
    } catch (e) {
      console.log(`${name}: skipped (${e instanceof Error ? e.message : e})`);
    }
  }
  const present = [...new Set(files.map((f) => f.chain))];
  const basket = buildBasket(files, present);
  // Per chain, region and item: the median shelf price across the chain's stores in that region.
  const prices: Record<string, Record<string, Record<string, number>>> = {};
  for (const chain of present)
    for (const region of ["NORTH", "COAST", "CENTER", "JERUSALEM", "SOUTH"]) {
      const fs = files.filter((f) => f.chain === chain && f.store.region === region);
      if (!fs.length) continue;
      const byItem: Record<string, number> = {};
      for (const b of basket) {
        const m = median(fs.map((f) => f.items.get(b.code)?.price).filter((x): x is number => !!x));
        if (m) byItem[b.code] = Math.round(m * 100) / 100;
      }
      (prices[chain] ??= {})[region] = byItem;
    }
  const snapshot = {
    model: "market-snapshot-v1",
    day,
    fetchedAt: new Date().toISOString(),
    cbs: await cbs(),
    chains: present,
    storeCounts,
    stores: files.map((f) => ({
      chain: f.chain,
      storeId: f.store.storeId,
      name: f.store.name,
      city: f.store.city,
      region: f.store.region,
      url: f.url,
      fetchedAt: f.fetchedAt,
      sha256: f.sha256,
      items: f.items.size,
    })),
    basket,
    prices,
  };
  mkdirSync("data/market", { recursive: true });
  writeFileSync(`data/market/snapshot-${day}.json`, JSON.stringify(snapshot, null, 1));
  console.log(
    `wrote data/market/snapshot-${day}.json: ${files.length} files, ${basket.length} basket items, chains ${present.join(", ")}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
