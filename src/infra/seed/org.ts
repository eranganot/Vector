/** Phase 2 synthetic organization (docs/specs/synthetic-data.md). */
export const SEED_VERSION = "p2-v1";
export const ORG_NAME = "VECTOR Retail Group";
/** The demo story's "today": data exists up to the day before. */
export const STORY_DAY = "2026-10-22";
export const HISTORY_DAYS = 84;

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

export const UNITS: UnitSeed[] = [
  { code: "GROUP", type: "group", name: "VECTOR Retail Group" },
  { code: "NORTH", type: "region", name: "North", parent: "GROUP" },
  { code: "CENTER", type: "region", name: "Center", parent: "GROUP" },
  {
    code: "HFA-GC",
    type: "branch",
    name: "Haifa Grand Canyon",
    parent: "NORTH",
    city: "Haifa",
    lat: 32.7897,
    lon: 35.0076,
    sizeClass: "L",
  },
  {
    code: "HFA-DT",
    type: "branch",
    name: "Haifa Downtown",
    parent: "NORTH",
    city: "Haifa",
    lat: 32.8156,
    lon: 34.9984,
    sizeClass: "M",
  },
  {
    code: "NAZ",
    type: "branch",
    name: "Nazareth",
    parent: "NORTH",
    city: "Nazareth",
    lat: 32.6996,
    lon: 35.3035,
    sizeClass: "M",
  },
  {
    code: "TLV-DZ",
    type: "branch",
    name: "Tel Aviv Dizengoff",
    parent: "CENTER",
    city: "Tel Aviv",
    lat: 32.0753,
    lon: 34.7749,
    sizeClass: "L",
  },
  {
    code: "RG-AY",
    type: "branch",
    name: "Ramat Gan Ayalon",
    parent: "CENTER",
    city: "Ramat Gan",
    lat: 32.1,
    lon: 34.8268,
    sizeClass: "L",
  },
  {
    code: "PT",
    type: "branch",
    name: "Petah Tikva",
    parent: "CENTER",
    city: "Petah Tikva",
    lat: 32.0873,
    lon: 34.8878,
    sizeClass: "M",
  },
  { code: "D-STORE", type: "department", name: "Store Operations", parent: "GROUP" },
  { code: "D-SUPPLY", type: "department", name: "Supply Chain", parent: "GROUP" },
  { code: "D-MKT", type: "department", name: "Marketing", parent: "GROUP" },
];

export type UserSeed = {
  key: string;
  name: string;
  email: string;
  title: string;
  roles: { role: "admin" | "executive" | "department_manager" | "regional_manager" | "viewer"; unit: string }[];
};

export const USERS: UserSeed[] = [
  {
    key: "dana",
    name: "Dana Levi",
    email: "dana@vector-retail.example",
    title: "CEO",
    roles: [{ role: "executive", unit: "GROUP" }],
  },
  {
    key: "yossi",
    name: "Yossi Cohen",
    email: "yossi@vector-retail.example",
    title: "Regional Manager, North",
    roles: [{ role: "regional_manager", unit: "NORTH" }],
  },
  {
    key: "maya",
    name: "Maya Azulay",
    email: "maya@vector-retail.example",
    title: "Regional Manager, Center",
    roles: [{ role: "regional_manager", unit: "CENTER" }],
  },
  {
    key: "avi",
    name: "Avi Mizrahi",
    email: "avi@vector-retail.example",
    title: "Branch Manager, Haifa Grand Canyon",
    roles: [{ role: "regional_manager", unit: "HFA-GC" }],
  },
  {
    key: "noa",
    name: "Noa Friedman",
    email: "noa@vector-retail.example",
    title: "VP Supply Chain",
    roles: [{ role: "department_manager", unit: "D-SUPPLY" }],
  },
  {
    key: "ronit",
    name: "Ronit Shapiro",
    email: "ronit@vector-retail.example",
    title: "VP Marketing",
    roles: [{ role: "department_manager", unit: "D-MKT" }],
  },
  {
    key: "tal",
    name: "Tal Ben-David",
    email: "tal@vector-retail.example",
    title: "Board observer",
    roles: [{ role: "viewer", unit: "GROUP" }],
  },
  {
    key: "admin",
    name: "Ops Admin",
    email: "admin@vector-retail.example",
    title: "System administrator",
    roles: [{ role: "admin", unit: "GROUP" }],
  },
];

export const KPIS = [
  { code: "net_sales", name: "Net sales", unit: "ILS", higherIsBetter: true, strategicWeight: 0.8, owner: "D-STORE" },
  {
    code: "transactions",
    name: "Transactions",
    unit: "count",
    higherIsBetter: true,
    strategicWeight: 0.6,
    owner: "D-STORE",
  },
  {
    code: "osa",
    name: "On-shelf availability",
    unit: "pct",
    higherIsBetter: true,
    strategicWeight: 0.9,
    owner: "D-SUPPLY",
  },
  {
    code: "labor_pct",
    name: "Labor cost % of sales",
    unit: "pct",
    higherIsBetter: false,
    strategicWeight: 0.5,
    owner: "D-STORE",
  },
] as const;
