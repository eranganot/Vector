/**
 * Synthetic organization (docs/specs/synthetic-data.md): 5 regions × 12 branches, 8 departments,
 * 18 personas, 6 branch KPIs and 10 department KPIs. All names of people and the company are invented;
 * cities and coordinates are real (live weather arrives in Phase 6).
 */
export const SEED_VERSION = "p5-v1";
export const ORG_NAME = "VECTOR Retail Group";
/** The demo story's "today": data exists up to the day before. */
export const STORY_DAY = "2026-10-22";
/** 52 weeks of daily history (plan v2, E1c): year-on-year, run-rates and the Q3 close. */
export const HISTORY_DAYS = 365;

export type UnitSeed = {
  code: string;
  type: "group" | "region" | "branch" | "department";
  name: string;
  parent?: string;
  city?: string;
  lat?: number;
  lon?: number;
  sizeClass?: "L" | "M";
};

type B = [code: string, name: string, city: string, lat: number, lon: number, size: "L" | "M"];

const REGION_BRANCHES: Record<string, B[]> = {
  NORTH: [
    ["HFA-GC", "Haifa Grand Canyon", "Haifa", 32.7897, 35.0076, "L"],
    ["HFA-DT", "Haifa Downtown", "Haifa", 32.8156, 34.9984, "M"],
    ["NAZ", "Nazareth", "Nazareth", 32.6996, 35.3035, "M"],
    ["KAT", "Kiryat Ata", "Kiryat Ata", 32.8114, 35.1064, "L"],
    ["KRM", "Karmiel", "Karmiel", 32.9171, 35.2948, "M"],
    ["AKO", "Akko", "Akko", 32.9281, 35.0818, "M"],
    ["NHR", "Nahariya", "Nahariya", 33.0058, 35.0941, "M"],
    ["TIB", "Tiberias", "Tiberias", 32.7922, 35.5312, "M"],
    ["AFL", "Afula", "Afula", 32.6078, 35.2897, "M"],
    ["KSH", "Kiryat Shmona", "Kiryat Shmona", 33.2075, 35.5697, "M"],
    ["YKN", "Yokneam", "Yokneam", 32.6593, 35.1095, "M"],
    ["SAF", "Safed", "Safed", 32.9646, 35.496, "M"],
  ],
  COAST: [
    ["NET-P", "Netanya Poleg", "Netanya", 32.2779, 34.8586, "L"],
    ["NET-C", "Netanya Center", "Netanya", 32.3215, 34.8532, "M"],
    ["HRZ", "Herzliya", "Herzliya", 32.1624, 34.8447, "L"],
    ["HAD", "Hadera", "Hadera", 32.434, 34.9196, "M"],
    ["KS", "Kfar Saba", "Kfar Saba", 32.175, 34.9069, "M"],
    ["RAN", "Ra'anana", "Ra'anana", 32.1848, 34.8713, "M"],
    ["HOD", "Hod HaSharon", "Hod HaSharon", 32.1593, 34.8932, "M"],
    ["ZIK", "Zikhron Ya'akov", "Zikhron Ya'akov", 32.5707, 34.9524, "M"],
    ["ORA", "Or Akiva", "Or Akiva", 32.5079, 34.9196, "M"],
    ["PH", "Pardes Hanna", "Pardes Hanna-Karkur", 32.4715, 34.9701, "M"],
    ["BIN", "Binyamina", "Binyamina", 32.5205, 34.9506, "M"],
    ["KY", "Kfar Yona", "Kfar Yona", 32.3168, 34.9351, "M"],
  ],
  CENTER: [
    ["TLV-DZ", "Tel Aviv Dizengoff", "Tel Aviv", 32.0753, 34.7749, "L"],
    ["RG-AY", "Ramat Gan Ayalon", "Ramat Gan", 32.1, 34.8268, "L"],
    ["PT", "Petah Tikva", "Petah Tikva", 32.0873, 34.8878, "M"],
    ["TLV-RA", "Tel Aviv Ramat Aviv", "Tel Aviv", 32.1133, 34.7967, "L"],
    ["TLV-FL", "Tel Aviv Florentin", "Tel Aviv", 32.0565, 34.7697, "M"],
    ["GIV", "Givatayim", "Givatayim", 32.0723, 34.8125, "M"],
    ["BB", "Bnei Brak", "Bnei Brak", 32.0807, 34.8338, "M"],
    ["HOL", "Holon", "Holon", 32.0158, 34.7874, "L"],
    ["BY", "Bat Yam", "Bat Yam", 32.0171, 34.7454, "M"],
    ["RLZ", "Rishon LeZion", "Rishon LeZion", 31.9642, 34.8044, "L"],
    ["RHV", "Rehovot", "Rehovot", 31.8928, 34.8113, "M"],
    ["MOD", "Modi'in", "Modi'in", 31.8969, 35.0103, "L"],
  ],
  JERUSALEM: [
    ["JLM-MAL", "Jerusalem Malha", "Jerusalem", 31.7516, 35.1876, "L"],
    ["JLM-TAL", "Jerusalem Talpiot", "Jerusalem", 31.7539, 35.2167, "L"],
    ["JLM-CC", "Jerusalem City Center", "Jerusalem", 31.7807, 35.2163, "M"],
    ["JLM-GIL", "Jerusalem Gilo", "Jerusalem", 31.7317, 35.1854, "M"],
    ["JLM-RAM", "Jerusalem Ramot", "Jerusalem", 31.8152, 35.1946, "M"],
    ["JLM-PZ", "Jerusalem Pisgat Ze'ev", "Jerusalem", 31.8264, 35.2405, "M"],
    ["JLM-BAK", "Jerusalem Baka", "Jerusalem", 31.7586, 35.2187, "M"],
    ["BSM", "Beit Shemesh", "Beit Shemesh", 31.7468, 34.9887, "L"],
    ["MAS", "Mevaseret Zion", "Mevaseret Zion", 31.8017, 35.1508, "M"],
    ["MAA", "Ma'ale Adumim", "Ma'ale Adumim", 31.7773, 35.2981, "M"],
    ["GZ", "Givat Ze'ev", "Givat Ze'ev", 31.8613, 35.1683, "M"],
    ["ABG", "Abu Ghosh", "Abu Ghosh", 31.8063, 35.1093, "M"],
  ],
  SOUTH: [
    ["BS-GN", "Be'er Sheva Grand", "Be'er Sheva", 31.2504, 34.7715, "L"],
    ["BS-OC", "Be'er Sheva Old City", "Be'er Sheva", 31.2408, 34.7882, "M"],
    ["ASH", "Ashdod", "Ashdod", 31.8044, 34.6553, "L"],
    ["ASK", "Ashkelon", "Ashkelon", 31.6688, 34.5743, "L"],
    ["KG", "Kiryat Gat", "Kiryat Gat", 31.61, 34.7642, "M"],
    ["SDR", "Sderot", "Sderot", 31.525, 34.5969, "M"],
    ["NTV", "Netivot", "Netivot", 31.4231, 34.5888, "M"],
    ["OFK", "Ofakim", "Ofakim", 31.3141, 34.62, "M"],
    ["DIM", "Dimona", "Dimona", 31.0705, 35.0336, "M"],
    ["ARD", "Arad", "Arad", 31.2589, 35.2128, "M"],
    ["YER", "Yeruham", "Yeruham", 30.9877, 34.9294, "M"],
    ["EIL", "Eilat", "Eilat", 29.5577, 34.9519, "L"],
  ],
};

export const REGIONS = [
  { code: "NORTH", name: "North" },
  { code: "COAST", name: "Coast" },
  { code: "CENTER", name: "Center" },
  { code: "JERUSALEM", name: "Jerusalem" },
  { code: "SOUTH", name: "South" },
] as const;

export const DEPARTMENTS = [
  { code: "D-STORE", name: "Store Operations" },
  { code: "D-SUPPLY", name: "Supply Chain" },
  { code: "D-TRADE", name: "Trade & Commercial" },
  { code: "D-MKT", name: "Marketing" },
  { code: "D-FIN", name: "Finance" },
  { code: "D-HR", name: "HR" },
  { code: "D-LEGAL", name: "Legal & Compliance" },
  { code: "D-IT", name: "IT" },
] as const;

export const UNITS: UnitSeed[] = [
  { code: "GROUP", type: "group", name: "VECTOR Retail Group" },
  ...REGIONS.map((r) => ({ code: r.code, type: "region" as const, name: r.name, parent: "GROUP" })),
  ...REGIONS.flatMap((r) =>
    REGION_BRANCHES[r.code].map(([code, name, city, lat, lon, sizeClass]) => ({
      code,
      type: "branch" as const,
      name,
      parent: r.code,
      city,
      lat,
      lon,
      sizeClass,
    })),
  ),
  ...DEPARTMENTS.map((d) => ({ code: d.code, type: "department" as const, name: d.name, parent: "GROUP" })),
];

export type UserSeed = {
  key: string;
  name: string;
  email: string;
  title: string;
  /** C-suite member (ADR-008): executive layout and navigation; never a permission. */
  isCSuite?: boolean;
  roles: {
    role: "admin" | "executive" | "department_manager" | "regional_manager" | "viewer";
    unit: string;
    /** Head of the unit for this role; exactly one per unit and role (work is assigned to the head). */
    isHead: boolean;
  }[];
};

const person = (
  key: string,
  name: string,
  title: string,
  role: UserSeed["roles"][0]["role"],
  unit: string,
  isHead = true,
) => ({
  key,
  name,
  email: `${key}@vector-retail.example`,
  title,
  roles: [{ role, unit, isHead }],
});

/** A branch manager is a regional_manager assignment at a branch unit (no separate role; authorization.md §2). */
const BASE_USERS: UserSeed[] = [
  person("dana", "Dana Levi", "CEO", "executive", "GROUP"),
  person("yossi", "Yossi Cohen", "Regional Manager, North", "regional_manager", "NORTH"),
  person("gil", "Gil Peretz", "Regional Manager, Coast", "regional_manager", "COAST"),
  person("maya", "Maya Azulay", "Regional Manager, Center", "regional_manager", "CENTER"),
  person("rina", "Rina Avraham", "Regional Manager, Jerusalem", "regional_manager", "JERUSALEM"),
  person("omer", "Omer Biton", "Regional Manager, South", "regional_manager", "SOUTH"),
  person("avi", "Avi Mizrahi", "Branch Manager, Haifa Grand Canyon", "regional_manager", "HFA-GC"),
  person("lior", "Lior Ben-Ami", "Branch Manager, Tel Aviv Dizengoff", "regional_manager", "TLV-DZ"),
  person("shira", "Shira Katz", "VP Store Operations", "department_manager", "D-STORE"),
  person("noa", "Noa Friedman", "VP Supply Chain", "department_manager", "D-SUPPLY"),
  person("ben", "Ben Shalom", "Head of DC Operations, Supply Chain", "department_manager", "D-SUPPLY", false),
  person("eitan", "Eitan Rosen", "VP Trade & Commercial", "department_manager", "D-TRADE"),
  person("ronit", "Ronit Shapiro", "VP Marketing", "department_manager", "D-MKT"),
  // ADR-008: the CFO reads the whole group (Viewer @ Group) and acts only in Finance.
  {
    ...person("michal", "Michal Golan", "CFO", "department_manager", "D-FIN"),
    roles: [
      { role: "department_manager", unit: "D-FIN", isHead: true },
      { role: "viewer", unit: "GROUP", isHead: false },
    ],
  },
  // ADR-008: the COO reads the whole group and acts in the two operations departments, where the VPs stay heads.
  {
    ...person("oren", "Oren Halevi", "COO", "department_manager", "D-STORE"),
    roles: [
      { role: "department_manager", unit: "D-STORE", isHead: false },
      { role: "department_manager", unit: "D-SUPPLY", isHead: false },
      { role: "viewer", unit: "GROUP", isHead: false },
    ],
  },
  person("hila", "Hila Dahan", "VP HR", "department_manager", "D-HR"),
  person("yael", "Yael Barak", "General Counsel", "department_manager", "D-LEGAL"),
  person("dafna", "Dafna Mor", "Senior Legal Counsel", "department_manager", "D-LEGAL", false),
  person("amir", "Amir Klein", "CIO", "department_manager", "D-IT"),
  person("tal", "Tal Ben-David", "Board observer", "viewer", "GROUP"),
  person("admin", "Ops Admin", "System administrator", "admin", "GROUP"),
];

/** The C-suite (ADR-008, FB-1): CEO, CFO, COO and the VPs who head a department. */
export const C_SUITE = ["dana", "michal", "oren", "shira", "noa", "eitan", "ronit", "hila", "yael", "amir"];

export const USERS: UserSeed[] = BASE_USERS.map((u) => ({ ...u, isCSuite: C_SUITE.includes(u.key) }));

export type KpiSeed = {
  code: string;
  name: string;
  unit: "ILS" | "count" | "pct" | "score";
  higherIsBetter: boolean;
  strategicWeight: number;
  owner: string;
  /** branch KPIs are observed per branch; department KPIs once per day on the department unit. */
  level: "branch" | "department";
  /** Plan / target level shown on dashboards; null = compare with the usual level only. */
  target: number | null;
};

export const KPIS: KpiSeed[] = [
  // Branch KPIs (per branch, per day). Net sales and transactions are compared with their usual level.
  {
    code: "net_sales",
    name: "Net sales",
    unit: "ILS",
    higherIsBetter: true,
    strategicWeight: 0.8,
    owner: "D-STORE",
    level: "branch",
    target: null,
  },
  {
    code: "transactions",
    name: "Transactions",
    unit: "count",
    higherIsBetter: true,
    strategicWeight: 0.6,
    owner: "D-STORE",
    level: "branch",
    target: null,
  },
  {
    code: "osa",
    name: "On-shelf availability",
    unit: "pct",
    higherIsBetter: true,
    strategicWeight: 0.9,
    owner: "D-SUPPLY",
    level: "branch",
    target: 96,
  },
  {
    code: "labor_pct",
    name: "Labor cost % of sales",
    unit: "pct",
    higherIsBetter: false,
    strategicWeight: 0.5,
    owner: "D-STORE",
    level: "branch",
    target: 15.8,
  },
  {
    code: "shrink_pct",
    name: "Shrinkage % of sales",
    unit: "pct",
    higherIsBetter: false,
    strategicWeight: 0.6,
    owner: "D-STORE",
    level: "branch",
    target: 1.5,
  },
  {
    code: "nps",
    name: "Customer NPS",
    unit: "score",
    higherIsBetter: true,
    strategicWeight: 0.6,
    owner: "D-STORE",
    level: "branch",
    target: 40,
  },
  // Department KPIs (one value per day on the department unit).
  {
    code: "dc_on_time",
    name: "DC deliveries on time",
    unit: "pct",
    higherIsBetter: true,
    strategicWeight: 0.8,
    owner: "D-SUPPLY",
    level: "department",
    target: 95,
  },
  {
    code: "supplier_fill",
    name: "Supplier fill rate",
    unit: "pct",
    higherIsBetter: true,
    strategicWeight: 0.7,
    owner: "D-TRADE",
    level: "department",
    target: 97,
  },
  {
    code: "gross_margin",
    name: "Gross margin",
    unit: "pct",
    higherIsBetter: true,
    strategicWeight: 0.8,
    owner: "D-TRADE",
    level: "department",
    target: 26, // G-E0g (was 31.5)
  },
  {
    code: "campaign_ready",
    name: "Campaigns on schedule",
    unit: "pct",
    higherIsBetter: true,
    strategicWeight: 0.6,
    owner: "D-MKT",
    level: "department",
    target: 90,
  },
  {
    code: "opex_vs_budget",
    name: "Operating spend vs budget",
    unit: "pct",
    higherIsBetter: false,
    strategicWeight: 0.7,
    owner: "D-FIN",
    level: "department",
    target: 100,
  },
  {
    code: "vacancy_pct",
    name: "Open store positions",
    unit: "pct",
    higherIsBetter: false,
    strategicWeight: 0.5,
    owner: "D-HR",
    level: "department",
    target: 4,
  },
  {
    code: "training_pct",
    name: "Mandatory training complete",
    unit: "pct",
    higherIsBetter: true,
    strategicWeight: 0.4,
    owner: "D-HR",
    level: "department",
    target: 95,
  },
  {
    code: "compliance_on_time",
    name: "Compliance items on time",
    unit: "pct",
    higherIsBetter: true,
    strategicWeight: 0.7,
    owner: "D-LEGAL",
    level: "department",
    target: 100,
  },
  {
    code: "pos_uptime",
    name: "POS uptime",
    unit: "pct",
    higherIsBetter: true,
    strategicWeight: 0.6,
    owner: "D-IT",
    level: "department",
    target: 99.8,
  },
  {
    code: "it_incidents",
    name: "Open IT incidents",
    unit: "count",
    higherIsBetter: false,
    strategicWeight: 0.4,
    owner: "D-IT",
    level: "department",
    target: 5,
  },
];
