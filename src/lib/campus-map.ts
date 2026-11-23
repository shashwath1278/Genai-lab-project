// The Northgate campus as a small map and walkway graph. Shared by client and
// server: the map card draws from it, the showCampusMap tool routes over it, and
// the "Campus Map and Directions" document is generated from it, so the card,
// the directions and the cited text always agree.
//
// Map units: 1 unit = 0.5 m. North is up; the Main Gate is on the north wall.

export type Pt = [number, number];

export type BuildingKind = "gate" | "academic" | "office" | "hall" | "hostel" | "amenity" | "sports" | "transport";

export type Building = {
  id: string;
  label: string;
  kind: BuildingKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Where the path meets the building. */
  door: Pt;
  /** The walkway junction the door connects to. */
  via: string;
  /** How directions refer to it, article included: "Block B", "the Auditorium". */
  called: string;
  oval?: boolean;
};

export type Place = {
  id: string;
  name: string;
  /** Buildings that make up the place; routes go to the nearest one. */
  buildings: string[];
  aliases: string[];
  /** What's there, from the handbook. */
  detail: string;
};

export const MAP_SIZE = { w: 1110, h: 630 };
export const METRES_PER_UNIT = 0.5;
const WALK_M_PER_MIN = 80;

export const NODES: Record<string, { at: Pt; name?: string }> = {
  gate: { at: [480, 44], name: "the Main Gate" },
  "nr-w": { at: [60, 120], name: "the corner of North Road and West Lane" },
  "nr-bus": { at: [205, 120] },
  "nr-bank": { at: [365, 120] },
  "nr-mid": { at: [480, 120], name: "the North Road crossing" },
  "nr-annexe": { at: [562, 120] },
  "nr-park": { at: [750, 120] },
  "nr-e": { at: [900, 120], name: "the corner of North Road and East Lane" },
  "av-admin": { at: [480, 210], name: "the Admin Block entrance" },
  circle: { at: [480, 300], name: "Jacaranda Circle" },
  "cw-w": { at: [60, 300], name: "the corner of Central Walk and West Lane" },
  "cw-a": { at: [165, 300] },
  "cw-lib": { at: [360, 300] },
  "cw-inn": { at: [600, 300] },
  "cw-b": { at: [795, 300] },
  "cw-e": { at: [900, 300], name: "the East Lane crossing" },
  "sw-w": { at: [60, 470], name: "the corner of South Walk and West Lane" },
  "sw-h1": { at: [130, 470] },
  "sw-h2": { at: [225, 470] },
  "sw-health": { at: [322, 470] },
  "sw-mid": { at: [480, 470], name: "the South Walk crossing" },
  "sw-h3": { at: [640, 470] },
  "sw-h4": { at: [735, 470] },
  "sw-e": { at: [900, 470], name: "the corner of South Walk and East Lane" },
  "el-hall": { at: [900, 545] },
};

export const ROADS: { name: string; nodes: string[] }[] = [
  { name: "Gate Avenue", nodes: ["gate", "nr-mid", "av-admin", "circle", "sw-mid"] },
  { name: "North Road", nodes: ["nr-w", "nr-bus", "nr-bank", "nr-mid", "nr-annexe", "nr-park", "nr-e"] },
  { name: "Central Walk", nodes: ["cw-w", "cw-a", "cw-lib", "circle", "cw-inn", "cw-b", "cw-e"] },
  { name: "South Walk", nodes: ["sw-w", "sw-h1", "sw-h2", "sw-health", "sw-mid", "sw-h3", "sw-h4", "sw-e"] },
  { name: "West Lane", nodes: ["nr-w", "cw-w", "sw-w"] },
  { name: "East Lane", nodes: ["nr-e", "cw-e", "sw-e", "el-hall"] },
];

export const BUILDINGS: Building[] = [
  { id: "gate", label: "Main Gate", kind: "gate", x: 450, y: 14, w: 60, h: 30, door: [480, 44], via: "gate", called: "the Main Gate" },
  { id: "bus-bay", label: "Bus bay", kind: "transport", x: 120, y: 48, w: 170, h: 52, door: [205, 100], via: "nr-bus", called: "the bus bay" },
  { id: "bank", label: "Bank · ATMs", kind: "amenity", x: 310, y: 54, w: 110, h: 46, door: [365, 100], via: "nr-bank", called: "the bank" },
  { id: "annexe", label: "Gate Annexe", kind: "office", x: 525, y: 54, w: 75, h: 46, door: [562, 100], via: "nr-annexe", called: "the Gate Annexe" },
  { id: "parking", label: "Parking", kind: "transport", x: 640, y: 48, w: 220, h: 52, door: [750, 100], via: "nr-park", called: "the parking area" },
  { id: "block-a", label: "Block A", kind: "academic", x: 90, y: 150, w: 150, h: 120, door: [165, 270], via: "cw-a", called: "Block A" },
  { id: "admin", label: "Admin Block", kind: "office", x: 270, y: 150, w: 180, h: 120, door: [450, 210], via: "av-admin", called: "the Admin Block" },
  { id: "auditorium", label: "Auditorium", kind: "hall", x: 510, y: 150, w: 180, h: 120, door: [510, 210], via: "av-admin", called: "the Auditorium" },
  { id: "block-b", label: "Block B", kind: "academic", x: 720, y: 150, w: 150, h: 120, door: [795, 270], via: "cw-b", called: "Block B" },
  { id: "block-c", label: "Block C", kind: "academic", x: 90, y: 330, w: 150, h: 110, door: [165, 330], via: "cw-a", called: "Block C" },
  { id: "library", label: "Central Library", kind: "hall", x: 270, y: 330, w: 180, h: 110, door: [360, 330], via: "cw-lib", called: "the Central Library" },
  { id: "innovation", label: "Innovation Centre", kind: "hall", x: 510, y: 330, w: 180, h: 110, door: [600, 330], via: "cw-inn", called: "the Innovation Centre" },
  { id: "student-centre", label: "Student Centre", kind: "amenity", x: 720, y: 330, w: 150, h: 110, door: [795, 330], via: "cw-b", called: "the Student Centre" },
  { id: "h1", label: "H1", kind: "hostel", x: 90, y: 500, w: 80, h: 100, door: [130, 500], via: "sw-h1", called: "Hostel Block H1" },
  { id: "h2", label: "H2", kind: "hostel", x: 185, y: 500, w: 80, h: 100, door: [225, 500], via: "sw-h2", called: "Hostel Block H2" },
  { id: "health", label: "Health", kind: "amenity", x: 285, y: 500, w: 75, h: 70, door: [322, 500], via: "sw-health", called: "the Health Centre" },
  { id: "food-court", label: "Food Court", kind: "amenity", x: 400, y: 500, w: 160, h: 80, door: [480, 500], via: "sw-mid", called: "the Food Court" },
  { id: "h3", label: "H3", kind: "hostel", x: 600, y: 500, w: 80, h: 100, door: [640, 500], via: "sw-h3", called: "Hostel Block H3" },
  { id: "h4", label: "H4", kind: "hostel", x: 695, y: 500, w: 80, h: 100, door: [735, 500], via: "sw-h4", called: "Hostel Block H4" },
  { id: "ground", label: "Sports grounds", kind: "sports", x: 930, y: 150, w: 150, h: 290, door: [930, 300], via: "cw-e", called: "the sports grounds", oval: true },
  { id: "indoor", label: "Indoor Sports Hall", kind: "sports", x: 930, y: 500, w: 150, h: 90, door: [930, 545], via: "el-hall", called: "the Indoor Sports Hall" },
];

export const PLACES: Place[] = [
  {
    id: "main-gate",
    name: "Main Gate",
    buildings: ["gate"],
    aliases: ["gate", "entrance", "north gate", "northgate", "security", "security office", "anti ragging", "anti ragging helpline", "reception"],
    detail: "The campus entrance on the north wall. The Security Office here runs the anti-ragging helpline.",
  },
  {
    id: "gate-annexe",
    name: "Main Gate Annexe (Transport Office)",
    buildings: ["annexe"],
    aliases: ["transport office", "bus pass office", "transport", "gate annexe", "annexe"],
    detail: "Just inside the Main Gate, on the east side. The Transport Office handles bus passes, routes and complaints.",
  },
  {
    id: "bus-bay",
    name: "Bus bay",
    buildings: ["bus-bay"],
    aliases: ["bus stop", "college bus", "buses", "bus pickup", "bus point", "bus bay", "bus"],
    detail: "Where college buses arrive by 8:15 am and leave at 4:45 pm and 6:15 pm (1:15 pm on Saturdays).",
  },
  {
    id: "parking",
    name: "Parking",
    buildings: ["parking"],
    aliases: ["two wheeler parking", "car parking", "bike parking", "vehicle parking", "parking lot"],
    detail: "Free two-wheeler parking for registered students; four-wheeler parking is for final-year students.",
  },
  {
    id: "bank",
    name: "Bank & ATMs",
    buildings: ["bank"],
    aliases: ["atm", "bank", "cash", "bank branch"],
    detail: "A bank branch with two ATMs.",
  },
  {
    id: "admin",
    name: "Admin Block",
    buildings: ["admin"],
    aliases: [
      "admissions office", "admission office", "admissions", "accounts", "accounts section", "fee counter", "fees office",
      "fee office", "scholarship cell", "scholarship office", "administration", "office",
    ],
    detail: "Admissions Office (Room A-102), Accounts Section (A-110) and Scholarship Cell (A-115). Open Mon-Sat, 9:00-17:00.",
  },
  {
    id: "auditorium",
    name: "Auditorium",
    buildings: ["auditorium"],
    aliases: ["seminar hall", "seminar halls", "convocation hall", "convocation", "auditorium"],
    detail: "A 1,200-seat auditorium with two seminar halls.",
  },
  {
    id: "block-a",
    name: "Academic Block A",
    buildings: ["block-a"],
    aliases: [
      "block a", "a block", "cse", "cse department", "computer science", "ise", "information science", "aiml", "ai and ml",
      "ai ml", "mca", "computer applications", "it helpdesk", "it help desk", "it support", "wifi help",
    ],
    detail: "Computer Science, Information Science, AI & ML and Computer Applications (MCA). The IT Helpdesk is in Room A-010.",
  },
  {
    id: "block-b",
    name: "Academic Block B",
    buildings: ["block-b"],
    aliases: [
      "block b", "b block", "ece", "electronics", "electronics and communication", "exam section", "examination section",
      "exam cell", "exams office", "coe", "controller of examinations", "examination",
    ],
    detail: "Electronics & Communication. The Examination Section is in Room B-001 on the ground floor.",
  },
  {
    id: "block-c",
    name: "Academic Block C",
    buildings: ["block-c"],
    aliases: ["block c", "c block", "mechanical", "mechanical engineering", "civil", "civil engineering", "mba", "school of management", "management"],
    detail: "Mechanical and Civil Engineering, and the Northgate School of Management (MBA) on the top floor. A small café is next door.",
  },
  {
    id: "library",
    name: "Central Library",
    buildings: ["library"],
    aliases: ["library", "central library", "reading room", "books", "library cafe"],
    detail: "The Central Library, with the help desk on the ground floor and a quiet zone on the first floor. A small café is beside it.",
  },
  {
    id: "innovation",
    name: "Innovation Centre",
    buildings: ["innovation"],
    aliases: [
      "placement cell", "placement office", "placements", "training and placement", "training and placement cell", "t and p",
      "tpo", "incubation centre", "incubation", "maker space", "makerspace", "startup", "start up",
    ],
    detail: "Maker space (open 24x7 with project approval), the Incubation Centre, and the Training & Placement Cell on the 2nd floor.",
  },
  {
    id: "student-centre",
    name: "Student Centre",
    buildings: ["student-centre"],
    aliases: [
      "dsw", "dean of student welfare", "student welfare", "counselling", "counseling", "counsellor", "counselor",
      "counselling room", "stationery", "stationery shop", "photocopy", "xerox", "print shop",
    ],
    detail: "Dean of Student Welfare (1st floor), the counselling room, and the stationery and photocopy shop (ground floor).",
  },
  {
    id: "food-court",
    name: "Food Court",
    buildings: ["food-court"],
    aliases: ["canteen", "cafeteria", "food court", "food", "lunch", "restaurant", "eat"],
    detail: "Five counters (South Indian, North Indian, Chinese, juices and snacks, bakery), open 7:30 am to 9:00 pm.",
  },
  {
    id: "h1",
    name: "Hostel Block H1 (men)",
    buildings: ["h1"],
    aliases: ["h1", "hostel h1", "hostel office", "boys hostel", "mens hostel", "men hostel", "gents hostel"],
    detail: "Men's hostel. The Hostel Office is on the ground floor.",
  },
  { id: "h2", name: "Hostel Block H2 (men)", buildings: ["h2"], aliases: ["h2", "hostel h2"], detail: "Men's hostel, next to the Health Centre." },
  {
    id: "h3",
    name: "Hostel Block H3 (women)",
    buildings: ["h3"],
    aliases: ["h3", "hostel h3", "girls hostel", "womens hostel", "women hostel", "ladies hostel"],
    detail: "Women's hostel.",
  },
  { id: "h4", name: "Hostel Block H4 (women)", buildings: ["h4"], aliases: ["h4", "hostel h4"], detail: "Women's hostel." },
  {
    id: "mess",
    name: "Hostel messes",
    buildings: ["h1", "h2", "h3", "h4"],
    aliases: ["mess", "hostel mess", "dining hall"],
    detail: "Each hostel block has its own mess, run by the hostel committee.",
  },
  {
    id: "health",
    name: "Health Centre",
    buildings: ["health"],
    aliases: ["doctor", "clinic", "medical", "medical centre", "nurse", "pharmacy", "first aid", "sick bay", "ambulance", "health centre", "hospital"],
    detail: "Next to Hostel Block H2. Doctor 8:00 am to 8:00 pm, nurse and ambulance 24x7, a small pharmacy.",
  },
  {
    id: "ground",
    name: "Sports grounds",
    buildings: ["ground"],
    aliases: ["cricket ground", "football field", "playground", "ground", "basketball court", "volleyball court", "throwball", "sports", "track"],
    detail: "Cricket ground, football field, two basketball courts, two volleyball courts and a throwball court.",
  },
  {
    id: "indoor",
    name: "Indoor Sports Hall",
    buildings: ["indoor"],
    aliases: ["gym", "gymnasium", "badminton", "table tennis", "chess room", "carrom", "indoor sports", "indoor stadium"],
    detail: "Four badminton courts, table tennis, a chess and carrom room, and the gym (6-9 am and 4-8 pm).",
  },
];

const buildingById = new Map(BUILDINGS.map((b) => [b.id, b]));
export const getBuilding = (id: string) => buildingById.get(id);

// ------------------------------------------------------------------ matching

// "a" stays: it's the A in "Block A".
const normalise = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|an|to|of|at|in|on|is|where|wheres|how|do|i|get|go|reach|find|campus|northgate|please|room|ngit)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Best place for a free-text name ("exam section", "girls' hostel"), or null. */
export function findPlace(query: string): Place | null {
  const q = normalise(query);
  if (!q) return null;
  const room = query.match(/\b([ABC])-?\d{3}\b/i);
  if (room) {
    const id = { a: "block-a", b: "block-b", c: "block-c" }[room[1].toLowerCase() as "a" | "b" | "c"];
    // Rooms A-1xx are in the Admin Block (A-102, A-110, A-115); A-0xx in Block A.
    const place = PLACES.find((p) => p.id === (room[1].toLowerCase() === "a" && /a-?1/i.test(room[0]) ? "admin" : id));
    if (place) return place;
  }
  let best: { place: Place; score: number } | null = null;
  const qTokens = new Set(q.split(" "));
  for (const place of PLACES) {
    for (const raw of [place.name, ...place.aliases]) {
      const a = normalise(raw);
      if (!a) continue;
      let score = 0;
      if (a === q) score = 100;
      else if (` ${q} `.includes(` ${a} `)) score = 60 + a.length;
      else if (` ${a} `.includes(` ${q} `)) score = 40 + q.length;
      else {
        const aTokens = a.split(" ");
        const hits = aTokens.filter((t) => qTokens.has(t) || qTokens.has(t.replace(/s$/, ""))).length;
        if (hits) score = (hits / Math.max(aTokens.length, qTokens.size)) * 35;
      }
      if (score > (best?.score ?? 0)) best = { place, score };
    }
  }
  return best && best.score >= 15 ? best.place : null;
}

// ------------------------------------------------------------------- routing

type Edge = { to: string; len: number; road: string };

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function buildGraph(): { at: Map<string, Pt>; adj: Map<string, Edge[]> } {
  const at = new Map<string, Pt>(Object.entries(NODES).map(([id, n]) => [id, n.at]));
  const adj = new Map<string, Edge[]>();
  const link = (a: string, b: string, road: string) => {
    const len = dist(at.get(a)!, at.get(b)!);
    (adj.get(a) ?? adj.set(a, []).get(a)!).push({ to: b, len, road });
    (adj.get(b) ?? adj.set(b, []).get(b)!).push({ to: a, len, road });
  };
  for (const r of ROADS) for (let i = 1; i < r.nodes.length; i++) link(r.nodes[i - 1], r.nodes[i], r.name);
  for (const b of BUILDINGS) {
    at.set(`door:${b.id}`, b.door);
    link(`door:${b.id}`, b.via, `path:${b.id}`);
  }
  return { at, adj };
}
const GRAPH = buildGraph();

function shortestPath(from: string, to: string): { nodes: string[]; roads: string[]; len: number } | null {
  const { adj } = GRAPH;
  const best = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, { node: string; road: string }>();
  const open = new Set([from]);
  while (open.size) {
    let cur = "";
    let curD = Infinity;
    for (const n of open) if ((best.get(n) ?? Infinity) < curD) [cur, curD] = [n, best.get(n)!];
    open.delete(cur);
    if (cur === to) break;
    for (const e of adj.get(cur) ?? []) {
      // Don't cut through other buildings: door nodes are only endpoints.
      if (e.to.startsWith("door:") && e.to !== to) continue;
      const d = curD + e.len;
      if (d < (best.get(e.to) ?? Infinity)) {
        best.set(e.to, d);
        prev.set(e.to, { node: cur, road: e.road });
        open.add(e.to);
      }
    }
  }
  if (!best.has(to)) return null;
  const nodes = [to];
  const roads: string[] = [];
  while (nodes[0] !== from) {
    const p = prev.get(nodes[0])!;
    roads.unshift(p.road);
    nodes.unshift(p.node);
  }
  return { nodes, roads, len: best.get(to)! };
}

const toMetres = (units: number) => Math.max(10, Math.round((units * METRES_PER_UNIT) / 10) * 10);

function compass([dx, dy]: Pt): string {
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "east" : "west") : dy > 0 ? "south" : "north";
}

/** left / right / straight for a change of heading (y grows downwards). */
function turn(a: Pt, b: Pt): "left" | "right" | "straight" {
  const cross = a[0] * b[1] - a[1] * b[0];
  const dot = a[0] * b[0] + a[1] * b[1];
  const angle = Math.atan2(cross, dot); // radians, positive = clockwise = right
  if (Math.abs(angle) < 0.35) return "straight";
  return angle > 0 ? "right" : "left";
}

const unit = (a: Pt, b: Pt): Pt => {
  const d = dist(a, b) || 1;
  return [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
};

const called = (id: string) => getBuilding(id)?.called ?? id;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "A and B on your right, C on your left" */
function passingText(items: { name: string; side: string }[]): string {
  const bySide = new Map<string, string[]>();
  for (const i of items) bySide.set(i.side, [...(bySide.get(i.side) ?? []), i.name]);
  return [...bySide].map(([side, names]) => `${names.join(" and ")} on your ${side}`).join(", ");
}

export type Route = { points: Pt[]; distanceM: number; minutes: number; steps: string[] };

/** Walking route between two buildings, with plain-language steps. */
export function routeBetween(fromId: string, toId: string): Route | null {
  const from = getBuilding(fromId);
  const to = getBuilding(toId);
  if (!from || !to || from.id === to.id) return null;
  const path = shortestPath(`door:${from.id}`, `door:${to.id}`);
  if (!path) return null;
  const { at } = GRAPH;
  const pts = path.nodes.map((n) => at.get(n)!);

  // Merge consecutive edges along the same road into legs.
  type Leg = { road: string; start: number; end: number };
  const legs: Leg[] = [];
  path.roads.forEach((road, i) => {
    const last = legs.at(-1);
    if (last && last.road === road) last.end = i + 1;
    else legs.push({ road, start: i, end: i + 1 });
  });

  const landmarksAlong = (leg: Leg, heading: Pt) => {
    const seen: { name: string; side: string }[] = [];
    for (let i = leg.start + 1; i < leg.end; i++) {
      for (const b of BUILDINGS) {
        if (b.via !== path.nodes[i] || b.id === from.id || b.id === to.id || b.kind === "gate") continue;
        const side = turn(heading, unit(pts[i], b.door));
        if (side !== "straight") seen.push({ name: b.called, side });
      }
    }
    return seen.slice(0, 2);
  };

  const steps: string[] = [`Start at ${called(from.id)}.`];
  let heading: Pt | null = null;
  for (const leg of legs) {
    const a = pts[leg.start];
    const b = pts[leg.end];
    const legLen = path.nodes.slice(leg.start, leg.end + 1).reduce((n, _, i, arr) => (i ? n + dist(at.get(arr[i - 1])!, at.get(arr[i])!) : 0), 0);
    const dir = unit(a, b);
    if (leg.road.startsWith("path:")) {
      if (leg.road === `path:${to.id}` && heading) {
        const side = turn(heading, dir);
        steps.push(`${capital(called(to.id))} is ${side === "straight" ? "straight ahead" : `on your ${side}`}.`);
      }
      heading = dir;
      continue;
    }
    const passing = landmarksAlong(leg, dir);
    const metres = `about ${toMetres(legLen)} m${passing.length ? `, passing ${passingText(passing)}` : ""}`;
    if (!heading || steps.length === 1) {
      steps.push(`Head ${compass(dir)} along ${leg.road} for ${metres}.`);
    } else {
      const junction = NODES[path.nodes[leg.start]]?.name;
      const how = turn(heading, dir);
      const move = how === "straight" ? `carry straight on along ${leg.road} for ${metres}` : `turn ${how} onto ${leg.road} and walk ${metres}`;
      steps.push(junction ? `At ${junction}, ${move}.` : `${capital(move)}.`);
    }
    heading = dir;
  }

  const distanceM = toMetres(path.len);
  return { points: pts, distanceM, minutes: Math.max(1, Math.round(distanceM / WALK_M_PER_MIN)), steps };
}

export type MapPlace = { id: string; name: string; detail: string; buildings: string[] };
export type MapResult = {
  to: MapPlace | null;
  from: MapPlace | null;
  route: Route | null;
  /** A place the user named that isn't on the map. */
  unknown: string | null;
  /** The start is already one of the destination's buildings (H3 has its own mess). */
  sameBuilding: boolean;
  known: string[];
};

const summary = (p: Place): MapPlace => ({ id: p.id, name: p.name, detail: p.detail, buildings: p.buildings });

/** What the showCampusMap tool returns. `from` defaults to the Main Gate. */
export function planCampusRoute(input: { to?: string | null; from?: string | null }): MapResult {
  const known = PLACES.map((p) => p.name);
  const to = input.to ? findPlace(input.to) : null;
  const fromText = input.from?.trim();
  const from = fromText ? findPlace(fromText) : to ? PLACES.find((p) => p.id === "main-gate")! : null;
  const unknown = input.to && !to ? input.to : fromText && !from ? fromText : null;
  if (!to || !from) return { to: to && summary(to), from: from && summary(from), route: null, unknown, sameBuilding: false, known };
  if (from.buildings.some((b) => to.buildings.includes(b))) {
    return { to: summary(to), from: summary(from), route: null, unknown: null, sameBuilding: true, known };
  }

  // Several buildings (e.g. the hostel messes): go to the nearest one.
  let route: Route | null = null;
  for (const fb of from.buildings) {
    for (const tb of to.buildings) {
      const r = routeBetween(fb, tb);
      if (r && (!route || r.distanceM < route.distanceM)) route = r;
    }
  }
  return { to: summary(to), from: summary(from), route, unknown: null, sameBuilding: false, known };
}
