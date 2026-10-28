import fs from "node:fs";
import path from "node:path";
import type { DB } from "./db";

export type CutoffType = "rank" | "percentile" | "score" | "none";
export type Category = "GM" | "OBC" | "SC/ST";

export type Route = {
  exam: string;
  quota: string;
  cutoffType: CutoffType;
  cutoff: number | null;
  feePerYear: number;
};

export type Program = {
  code: string;
  name: string;
  level: "UG" | "PG";
  degree: string;
  durationYears: number;
  intake: number;
  department: string;
  minAggregate: number;
  reservedMinAggregate: number;
  subjects: string;
  placementRate: number | null;
  medianPackageLpa: number | null;
  highestPackageLpa: number | null;
  highlights: string[];
  routes: Route[];
};

export type OtherFee = {
  code: string;
  name: string;
  amount: number;
  frequency: "one-time" | "annual";
  refundable: boolean;
  hostelOnly?: boolean;
};
export type HostelOption = { code: string; name: string; sharing: number; ac: boolean; feePerYear: number; seats: number };
export type MessPlan = { code: string; name: string; feePerYear: number };
export type TransportZone = { code: string; name: string; feePerYear: number };
export type ScholarshipRule = {
  exam?: string;
  maxRank?: number;
  minPercentile?: number;
  maxFamilyIncome?: number;
  sports?: boolean;
  programs?: string[];
  gender?: string;
  sibling?: boolean;
};
export type Scholarship = {
  code: string;
  name: string;
  waiverPercent: number;
  rule: ScholarshipRule;
  criteria: string;
  renewal: string;
};
export type ImportantDate = {
  title: string;
  category: string;
  start: string;
  end: string | null;
  audience: string;
  note?: string | null;
};
export type RequiredDocument = { level: "UG" | "PG" | "ALL"; name: string; mandatory: boolean; note?: string | null };
export type Contact = {
  office: string;
  person: string;
  role: string;
  email: string;
  phone: string;
  location: string;
  hours: string;
  topics: string;
};

export type CollegeData = {
  academicYear: string;
  cutoffYear: number;
  categoryRankMultiplier: Record<Category, number>;
  categoryPercentileRelaxation: Record<Category, number>;
  programs: Program[];
  otherFees: OtherFee[];
  hostelOptions: HostelOption[];
  messPlans: MessPlan[];
  transportZones: TransportZone[];
  scholarships: Scholarship[];
  scholarshipNotes: string[];
  importantDates: ImportantDate[];
  requiredDocuments: RequiredDocument[];
  contacts: Contact[];
};

export const STRUCTURED_DIR = path.join(process.cwd(), "data", "structured");

export function loadCollegeDataFromJson(dir = STRUCTURED_DIR): CollegeData {
  const programs = JSON.parse(fs.readFileSync(path.join(dir, "programs.json"), "utf8"));
  const campus = JSON.parse(fs.readFileSync(path.join(dir, "campus.json"), "utf8"));
  return { ...programs, ...campus } as CollegeData;
}

export function seedStructuredData(db: DB, data: CollegeData) {
  const tables = [
    "program_routes", "programs", "other_fees", "hostel_options", "mess_plans", "transport_zones",
    "scholarships", "important_dates", "required_documents", "contacts", "settings",
  ];
  const run = db.transaction(() => {
    for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();

    const setting = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
    for (const key of ["academicYear", "cutoffYear", "categoryRankMultiplier", "categoryPercentileRelaxation", "scholarshipNotes"] as const) {
      setting.run(key, JSON.stringify(data[key]));
    }

    const program = db.prepare(`INSERT INTO programs (code, name, level, degree, duration_years, intake, department,
      min_aggregate, reserved_min_aggregate, subjects, placement_rate, median_package_lpa, highest_package_lpa, highlights)
      VALUES (@code, @name, @level, @degree, @durationYears, @intake, @department, @minAggregate, @reservedMinAggregate,
      @subjects, @placementRate, @medianPackageLpa, @highestPackageLpa, @highlights)`);
    const route = db.prepare(`INSERT INTO program_routes (program_code, exam, quota, cutoff_type, cutoff, fee_per_year)
      VALUES (?, ?, ?, ?, ?, ?)`);
    for (const p of data.programs) {
      program.run({ ...p, highlights: JSON.stringify(p.highlights) });
      for (const r of p.routes) route.run(p.code, r.exam, r.quota, r.cutoffType, r.cutoff, r.feePerYear);
    }

    const fee = db.prepare("INSERT INTO other_fees (code, name, amount, frequency, refundable, hostel_only) VALUES (?, ?, ?, ?, ?, ?)");
    for (const f of data.otherFees) fee.run(f.code, f.name, f.amount, f.frequency, f.refundable ? 1 : 0, f.hostelOnly ? 1 : 0);

    const hostel = db.prepare("INSERT INTO hostel_options (code, name, sharing, ac, fee_per_year, seats) VALUES (?, ?, ?, ?, ?, ?)");
    for (const h of data.hostelOptions) hostel.run(h.code, h.name, h.sharing, h.ac ? 1 : 0, h.feePerYear, h.seats);

    const mess = db.prepare("INSERT INTO mess_plans (code, name, fee_per_year) VALUES (?, ?, ?)");
    for (const m of data.messPlans) mess.run(m.code, m.name, m.feePerYear);

    const zone = db.prepare("INSERT INTO transport_zones (code, name, fee_per_year) VALUES (?, ?, ?)");
    for (const z of data.transportZones) zone.run(z.code, z.name, z.feePerYear);

    const sch = db.prepare("INSERT INTO scholarships (code, name, waiver_percent, rule, criteria, renewal) VALUES (?, ?, ?, ?, ?, ?)");
    for (const s of data.scholarships) sch.run(s.code, s.name, s.waiverPercent, JSON.stringify(s.rule), s.criteria, s.renewal);

    const date = db.prepare("INSERT INTO important_dates (title, category, start_date, end_date, audience, note) VALUES (?, ?, ?, ?, ?, ?)");
    for (const d of data.importantDates) date.run(d.title, d.category, d.start, d.end, d.audience, d.note ?? null);

    const doc = db.prepare("INSERT INTO required_documents (level, name, mandatory, note) VALUES (?, ?, ?, ?)");
    for (const d of data.requiredDocuments) doc.run(d.level, d.name, d.mandatory ? 1 : 0, d.note ?? null);

    const contact = db.prepare(`INSERT INTO contacts (office, person, role, email, phone, location, hours, topics)
      VALUES (@office, @person, @role, @email, @phone, @location, @hours, @topics)`);
    for (const c of data.contacts) contact.run(c);
  });
  run();
}

type Row = Record<string, unknown>;

export function loadCollegeDataFromDb(db: DB): CollegeData {
  const settings = Object.fromEntries(
    (db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[]).map((r) => [r.key, JSON.parse(r.value)]),
  );
  const routes = db.prepare("SELECT * FROM program_routes ORDER BY id").all() as Row[];
  const programs = (db.prepare("SELECT * FROM programs ORDER BY rowid").all() as Row[]).map(
    (p): Program => ({
      code: p.code as string,
      name: p.name as string,
      level: p.level as Program["level"],
      degree: p.degree as string,
      durationYears: p.duration_years as number,
      intake: p.intake as number,
      department: p.department as string,
      minAggregate: p.min_aggregate as number,
      reservedMinAggregate: p.reserved_min_aggregate as number,
      subjects: p.subjects as string,
      placementRate: p.placement_rate as number | null,
      medianPackageLpa: p.median_package_lpa as number | null,
      highestPackageLpa: p.highest_package_lpa as number | null,
      highlights: JSON.parse(p.highlights as string),
      routes: routes
        .filter((r) => r.program_code === p.code)
        .map((r) => ({
          exam: r.exam as string,
          quota: r.quota as string,
          cutoffType: r.cutoff_type as CutoffType,
          cutoff: r.cutoff as number | null,
          feePerYear: r.fee_per_year as number,
        })),
    }),
  );

  return {
    academicYear: settings.academicYear,
    cutoffYear: settings.cutoffYear,
    categoryRankMultiplier: settings.categoryRankMultiplier,
    categoryPercentileRelaxation: settings.categoryPercentileRelaxation,
    scholarshipNotes: settings.scholarshipNotes ?? [],
    programs,
    otherFees: (db.prepare("SELECT * FROM other_fees ORDER BY rowid").all() as Row[]).map((f) => ({
      code: f.code as string,
      name: f.name as string,
      amount: f.amount as number,
      frequency: f.frequency as OtherFee["frequency"],
      refundable: !!f.refundable,
      hostelOnly: !!f.hostel_only,
    })),
    hostelOptions: (db.prepare("SELECT * FROM hostel_options ORDER BY rowid").all() as Row[]).map((h) => ({
      code: h.code as string,
      name: h.name as string,
      sharing: h.sharing as number,
      ac: !!h.ac,
      feePerYear: h.fee_per_year as number,
      seats: h.seats as number,
    })),
    messPlans: (db.prepare("SELECT code, name, fee_per_year AS feePerYear FROM mess_plans ORDER BY rowid").all() as MessPlan[]),
    transportZones: (db.prepare("SELECT code, name, fee_per_year AS feePerYear FROM transport_zones ORDER BY rowid").all() as TransportZone[]),
    scholarships: (db.prepare("SELECT * FROM scholarships ORDER BY rowid").all() as Row[]).map((s) => ({
      code: s.code as string,
      name: s.name as string,
      waiverPercent: s.waiver_percent as number,
      rule: JSON.parse(s.rule as string),
      criteria: s.criteria as string,
      renewal: s.renewal as string,
    })),
    importantDates: (db.prepare(
      "SELECT title, category, start_date AS start, end_date AS end, audience, note FROM important_dates ORDER BY start_date",
    ).all() as ImportantDate[]),
    requiredDocuments: (db.prepare("SELECT level, name, mandatory, note FROM required_documents ORDER BY id").all() as Row[]).map((d) => ({
      level: d.level as RequiredDocument["level"],
      name: d.name as string,
      mandatory: !!d.mandatory,
      note: d.note as string | null,
    })),
    contacts: db.prepare("SELECT office, person, role, email, phone, location, hours, topics FROM contacts ORDER BY id").all() as Contact[],
  };
}
