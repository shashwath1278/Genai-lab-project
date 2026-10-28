import type { Category, CollegeData, Contact, Program, Route } from "./college-data";
import { daysBetween, formatINR, formatNumber } from "./format";

// Pure functions over CollegeData. The LLM calls these through tools so that
// eligibility verdicts and rupee totals are computed, never guessed.

export class CalcError extends Error {}

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

const PROGRAM_ALIASES: Record<string, string[]> = {
  CSE: ["CS", "COMPUTERSCIENCE", "COMPUTERSCIENCEENGINEERING", "BECSE"],
  AIML: ["AI", "ML", "AIANDML", "AIML", "ARTIFICIALINTELLIGENCE", "ARTIFICIALINTELLIGENCEANDMACHINELEARNING"],
  ISE: ["IS", "INFORMATIONSCIENCE", "IT", "INFORMATIONTECHNOLOGY"],
  ECE: ["EC", "ELECTRONICS", "ELECTRONICSANDCOMMUNICATION"],
  ME: ["MECH", "MECHANICAL"],
  CV: ["CIVIL", "CE"],
  MBA: ["MANAGEMENT", "BUSINESSADMINISTRATION"],
  MCA: ["COMPUTERAPPLICATIONS"],
  "MTECH-CSE": ["MTECH", "MTECHCSE", "MTECHCS"],
};

export function findProgram(data: CollegeData, input: string): Program {
  const key = norm(input);
  const program =
    data.programs.find((p) => norm(p.code) === key) ??
    data.programs.find((p) => PROGRAM_ALIASES[p.code]?.includes(key)) ??
    data.programs.find((p) => norm(p.name).includes(key) && key.length >= 4);
  if (!program) {
    throw new CalcError(`Unknown programme "${input}". Valid codes: ${data.programs.map((p) => p.code).join(", ")}.`);
  }
  return program;
}

const EXAM_ALIASES: Record<string, string> = {
  KCET: "KCET", CET: "KCET", KEA: "KCET", GOVERNMENT: "KCET",
  COMEDK: "COMEDK", COMEDKUGET: "COMEDK",
  JEE: "JEE Main", JEEMAIN: "JEE Main", JEEMAINS: "JEE Main",
  PGCET: "PGCET", CAT: "CAT", MAT: "MAT", GATE: "GATE",
  MANAGEMENT: "Management", DIRECT: "Management", MQ: "Management", NONE: "Management",
};

export function normalizeExam(exam: string): string {
  return EXAM_ALIASES[norm(exam)] ?? exam;
}

function findRoute(program: Program, exam: string | undefined): Route | undefined {
  if (!exam) return undefined;
  const e = normalizeExam(exam);
  return program.routes.find((r) => r.exam === e);
}

function cutoffText(type: Route["cutoffType"], value: number | null): string {
  if (value == null || type === "none") return "no entrance cutoff";
  if (type === "rank") return `rank ${formatNumber(value)}`;
  if (type === "percentile") return `${value} percentile`;
  return `score ${value}`;
}

// ---------------------------------------------------------------- eligibility

export type CheckStatus = "pass" | "warn" | "fail" | "unknown";
export type Verdict = "likely" | "borderline" | "unlikely" | "not-eligible" | "needs-info";

export type EligibilityInput = {
  program: string;
  exam: string;
  category?: Category;
  aggregatePercent?: number;
  rank?: number;
  percentile?: number;
  score?: number;
};

export type EligibilityResult = {
  program: { code: string; name: string; degree: string };
  exam: string;
  quota: string | null;
  category: Category;
  verdict: Verdict;
  headline: string;
  checks: { label: string; status: CheckStatus; detail: string }[];
  cutoff: { type: Route["cutoffType"]; generalMerit: number | null; forCategory: number | null; year: number } | null;
  feePerYear: number | null;
  alternatives: { code: string; name: string; cutoff: string }[];
  acceptedExams: string[];
  note: string;
};

function cutoffCheck(
  data: CollegeData,
  route: Route,
  category: Category,
  input: Pick<EligibilityInput, "rank" | "percentile" | "score">,
): { status: CheckStatus; detail: string; forCategory: number | null } {
  if (route.cutoffType === "none" || route.cutoff == null) {
    return { status: "pass", detail: "No entrance cutoff", forCategory: null };
  }
  if (route.cutoffType === "rank") {
    const limit = Math.round(route.cutoff * data.categoryRankMultiplier[category]);
    const closing = `closing ${formatNumber(limit)}`;
    if (input.rank == null) return { status: "unknown", detail: `Closing rank ${formatNumber(limit)}`, forCategory: limit };
    if (input.rank <= limit) return { status: "pass", detail: `${formatNumber(input.rank)} vs ${closing}`, forCategory: limit };
    if (input.rank <= limit * 1.15) return { status: "warn", detail: `${formatNumber(input.rank)} vs ${closing}, later rounds possible`, forCategory: limit };
    return { status: "fail", detail: `${formatNumber(input.rank)} vs ${closing}`, forCategory: limit };
  }
  const value = route.cutoffType === "percentile" ? input.percentile : input.score;
  const relax = route.cutoffType === "percentile" ? data.categoryPercentileRelaxation[category] : 0;
  const limit = route.cutoff - relax;
  const margin = route.cutoffType === "percentile" ? 3 : route.cutoff * 0.1;
  if (value == null) return { status: "unknown", detail: `Cutoff ${limit}`, forCategory: limit };
  if (value >= limit) return { status: "pass", detail: `${value} vs cutoff ${limit}`, forCategory: limit };
  if (value >= limit - margin) return { status: "warn", detail: `${value} vs cutoff ${limit}, just below`, forCategory: limit };
  return { status: "fail", detail: `${value} vs cutoff ${limit}`, forCategory: limit };
}

export function checkEligibility(data: CollegeData, input: EligibilityInput): EligibilityResult {
  const program = findProgram(data, input.program);
  const category: Category = input.category ?? "GM";
  const exam = normalizeExam(input.exam);
  const route = findRoute(program, exam);
  const checks: EligibilityResult["checks"] = [];
  const base = {
    program: { code: program.code, name: program.name, degree: program.degree },
    exam,
    category,
    acceptedExams: program.routes.map((r) => r.exam),
    note: `${data.cutoffYear} ${category} cutoffs; they change every year.`,
  };

  const minAgg = category === "GM" ? program.minAggregate : program.reservedMinAggregate;
  const aggLabel = program.level === "UG" ? "12th aggregate" : "Degree aggregate";
  if (input.aggregatePercent == null) {
    checks.push({ label: aggLabel, status: "unknown", detail: `Min ${minAgg}%` });
  } else {
    const ok = input.aggregatePercent >= minAgg;
    checks.push({ label: aggLabel, status: ok ? "pass" : "fail", detail: `${input.aggregatePercent}% (min ${minAgg}%)` });
  }

  if (!route) {
    checks.push({
      label: "Admission route",
      status: "fail",
      detail: `Accepts ${program.routes.map((r) => r.exam).join(", ")}`,
    });
    return {
      ...base,
      quota: null,
      verdict: "not-eligible",
      headline: `${program.code} doesn't admit through ${exam}`,
      checks,
      cutoff: null,
      feePerYear: null,
      alternatives: [],
    };
  }

  const cut = cutoffCheck(data, route, category, input);
  checks.push({
    label: `${route.exam} ${route.cutoffType === "none" ? "seat" : route.cutoffType}`,
    status: cut.status,
    detail: cut.detail,
  });

  const aggFail = checks[0].status === "fail";
  const verdict: Verdict = aggFail
    ? "not-eligible"
    : cut.status === "fail"
      ? "unlikely"
      : cut.status === "warn"
        ? "borderline"
        : cut.status === "unknown"
          ? "needs-info"
          : "likely";

  const headline = {
    "not-eligible": `Below the minimum aggregate for ${program.code}`,
    unlikely: `${program.code} via ${route.exam} looks unlikely`,
    borderline: `${program.code} via ${route.exam} is borderline`,
    "needs-info": `Need your ${route.exam} ${route.cutoffType === "rank" ? "rank" : route.cutoffType} to decide`,
    likely: `Good chance for ${program.code} via ${route.exam}`,
  }[verdict];

  // Other programmes at the same level that this rank/percentile clears via the same exam.
  const alternatives: EligibilityResult["alternatives"] = [];
  if (route.cutoffType !== "none" && cut.status !== "unknown" && !aggFail) {
    for (const p of data.programs) {
      if (p.code === program.code || p.level !== program.level) continue;
      const r = p.routes.find((x) => x.exam === route.exam);
      if (!r || r.cutoff == null) continue;
      const c = cutoffCheck(data, r, category, input);
      if (c.status === "pass") alternatives.push({ code: p.code, name: p.name, cutoff: cutoffText(r.cutoffType, c.forCategory) });
    }
  }

  return {
    ...base,
    quota: route.quota,
    verdict,
    headline,
    checks,
    cutoff: { type: route.cutoffType, generalMerit: route.cutoff, forCategory: cut.forCategory, year: data.cutoffYear },
    feePerYear: route.feePerYear,
    alternatives: alternatives.slice(0, 4),
  };
}

// ----------------------------------------------------------------------- cost

export type CostInput = {
  program: string;
  exam?: string;
  hostel?: string;
  mess?: string;
  transport?: string;
  scholarship?: string;
  years?: number;
};

export type CostYear = {
  year: number;
  tuition: number;
  scholarship: number;
  annualFees: number;
  hostel: number;
  mess: number;
  transport: number;
  total: number;
};

export type CostEstimate = {
  program: { code: string; name: string; degree: string; durationYears: number };
  route: { exam: string; quota: string; feePerYear: number };
  choices: { hostel: string | null; mess: string | null; transport: string | null; scholarship: string | null };
  years: CostYear[];
  oneTime: { name: string; amount: number; refundable: boolean }[];
  totals: {
    tuition: number;
    scholarship: number;
    annualFees: number;
    hostel: number;
    mess: number;
    transport: number;
    oneTime: number;
    grand: number;
    refundableDeposits: number;
  };
  assumptions: string[];
};

const isNone = (v?: string) => !v || /^(none|no|null|false|0)$/i.test(v.trim());

export function estimateCost(data: CollegeData, input: CostInput): CostEstimate {
  const program = findProgram(data, input.program);
  const assumptions: string[] = [`Fees are for ${data.academicYear}; later years may be revised.`];

  let route = findRoute(program, input.exam);
  if (!route) {
    route = program.routes[0];
    assumptions.push(
      input.exam
        ? `${input.exam} isn't a route for ${program.code}; used ${route.exam} (${route.quota}) instead.`
        : `Assumed admission through ${route.exam} (${route.quota} quota).`,
    );
  }

  const hostel = isNone(input.hostel)
    ? null
    : (data.hostelOptions.find((h) => norm(h.code) === norm(input.hostel!)) ?? data.hostelOptions[0]);
  if (hostel && norm(hostel.code) !== norm(input.hostel!)) assumptions.push(`Used ${hostel.name} for the hostel.`);

  let mess = isNone(input.mess) ? null : (data.messPlans.find((m) => norm(m.code) === norm(input.mess!)) ?? data.messPlans[0]);
  if (hostel && !mess) {
    mess = data.messPlans[0];
    assumptions.push(`Hostel residents take a mess plan; assumed the ${mess.name.toLowerCase()}.`);
  }

  const transport = isNone(input.transport)
    ? null
    : (data.transportZones.find((z) => norm(z.code) === norm(input.transport!)) ?? data.transportZones[1]);
  if (hostel && transport) assumptions.push("Hostel residents usually don't need a bus pass; remove it if you'll live on campus.");

  let scholarship = isNone(input.scholarship) ? null : data.scholarships.find((s) => norm(s.code) === norm(input.scholarship!));
  if (scholarship) {
    const rule = scholarship.rule;
    if (rule.exam && rule.exam !== route.exam) {
      assumptions.push(`${scholarship.name} is only for ${rule.exam} admissions, so it isn't applied.`);
      scholarship = undefined;
    } else if (rule.programs && !rule.programs.includes(program.code)) {
      assumptions.push(`${scholarship.name} is only for ${rule.programs.join("/")}, so it isn't applied.`);
      scholarship = undefined;
    } else {
      assumptions.push(`${scholarship.name} applied to tuition, assuming you qualify (${scholarship.criteria}) and meet the renewal condition each year.`);
    }
  } else if (!isNone(input.scholarship)) {
    assumptions.push(`Unknown scholarship "${input.scholarship}", not applied.`);
  }

  const yearsCount = Math.max(1, Math.min(Math.round(input.years ?? program.durationYears), program.durationYears));
  const annualFees = data.otherFees.filter((f) => f.frequency === "annual" && !f.hostelOnly).reduce((n, f) => n + f.amount, 0);

  const years: CostYear[] = Array.from({ length: yearsCount }, (_, i) => {
    const tuition = route!.feePerYear;
    const waiver = scholarship ? -Math.round((tuition * scholarship.waiverPercent) / 100) : 0;
    const row = {
      year: i + 1,
      tuition,
      scholarship: waiver,
      annualFees,
      hostel: hostel?.feePerYear ?? 0,
      mess: mess?.feePerYear ?? 0,
      transport: transport?.feePerYear ?? 0,
    };
    return { ...row, total: row.tuition + row.scholarship + row.annualFees + row.hostel + row.mess + row.transport };
  });

  const oneTime = data.otherFees
    .filter((f) => f.frequency === "one-time" && (!f.hostelOnly || hostel))
    .map((f) => ({ name: f.name, amount: f.amount, refundable: f.refundable }));

  const sum = (k: keyof Omit<CostYear, "year">) => years.reduce((n, y) => n + y[k], 0);
  const oneTimeTotal = oneTime.reduce((n, f) => n + f.amount, 0);
  const totals = {
    tuition: sum("tuition"),
    scholarship: sum("scholarship"),
    annualFees: sum("annualFees"),
    hostel: sum("hostel"),
    mess: sum("mess"),
    transport: sum("transport"),
    oneTime: oneTimeTotal,
    grand: sum("total") + oneTimeTotal,
    refundableDeposits: oneTime.filter((f) => f.refundable).reduce((n, f) => n + f.amount, 0),
  };

  return {
    program: { code: program.code, name: program.name, degree: program.degree, durationYears: program.durationYears },
    route: { exam: route.exam, quota: route.quota, feePerYear: route.feePerYear },
    choices: {
      hostel: hostel?.name ?? null,
      mess: mess?.name ?? null,
      transport: transport?.name ?? null,
      scholarship: scholarship?.name ?? null,
    },
    years,
    oneTime,
    totals,
    assumptions,
  };
}

// -------------------------------------------------------------------- compare

export type CompareResult = {
  programs: {
    code: string;
    name: string;
    degree: string;
    durationYears: number;
    intake: number;
    placementRate: number | null;
    medianPackageLpa: number | null;
    highestPackageLpa: number | null;
    highlights: string[];
    routes: { exam: string; quota: string; cutoff: string; feePerYear: number }[];
    lowestFeePerYear: number;
  }[];
  best: { placementRate?: string; medianPackage?: string; lowestFee?: string };
  cutoffYear: number;
};

export function comparePrograms(data: CollegeData, codes: string[]): CompareResult {
  const unique = [...new Map(codes.map((c) => findProgram(data, c)).map((p) => [p.code, p])).values()];
  if (unique.length < 2) throw new CalcError("Pick at least two different programmes to compare.");
  const programs = unique.slice(0, 4).map((p) => ({
    code: p.code,
    name: p.name,
    degree: p.degree,
    durationYears: p.durationYears,
    intake: p.intake,
    placementRate: p.placementRate,
    medianPackageLpa: p.medianPackageLpa,
    highestPackageLpa: p.highestPackageLpa,
    highlights: p.highlights,
    routes: p.routes.map((r) => ({ exam: r.exam, quota: r.quota, cutoff: cutoffText(r.cutoffType, r.cutoff), feePerYear: r.feePerYear })),
    lowestFeePerYear: Math.min(...p.routes.map((r) => r.feePerYear)),
  }));
  // A "best" badge only goes to an outright winner; ties get none.
  const top = (f: (p: (typeof programs)[number]) => number | null, lower = false) => {
    const values = programs.map(f).filter((v): v is number => v != null);
    if (values.length < 2) return undefined;
    const best = lower ? Math.min(...values) : Math.max(...values);
    const winners = programs.filter((p) => f(p) === best);
    return winners.length === 1 ? winners[0].code : undefined;
  };
  return {
    programs,
    best: {
      placementRate: top((p) => p.placementRate),
      medianPackage: top((p) => p.medianPackageLpa),
      lowestFee: top((p) => p.lowestFeePerYear, true),
    },
    cutoffYear: data.cutoffYear,
  };
}

// ---------------------------------------------------------------------- dates

export type DateStatus = "past" | "ongoing" | "upcoming";
export type DatesResult = {
  today: string;
  category: string;
  items: { title: string; category: string; start: string; end: string | null; note: string | null; status: DateStatus; daysUntil: number }[];
};

export function getImportantDates(
  data: CollegeData,
  { category = "all", upcomingOnly = true, today }: { category?: string; upcomingOnly?: boolean; today: string },
): DatesResult {
  const items = data.importantDates
    .filter((d) => category === "all" || d.category === category)
    .map((d) => {
      const end = d.end ?? d.start;
      const status: DateStatus = daysBetween(today, end) < 0 ? "past" : daysBetween(today, d.start) <= 0 ? "ongoing" : "upcoming";
      return { title: d.title, category: d.category, start: d.start, end: d.end, note: d.note ?? null, status, daysUntil: daysBetween(today, d.start) };
    })
    .filter((d) => !upcomingOnly || d.status !== "past")
    .sort((a, b) => a.start.localeCompare(b.start));
  return { today, category, items };
}

// ------------------------------------------------------------------ checklist

export type ChecklistResult = {
  program: { code: string; name: string; degree: string };
  route: { exam: string; quota: string };
  steps: { title: string; detail: string }[];
  documents: { name: string; mandatory: boolean; note: string | null }[];
  deadlines: { title: string; date: string }[];
  contact: Contact | null;
  feeDueAtAdmission: number;
};

const COUNSELLING: Record<string, string> = { KCET: "KEA (KCET)", COMEDK: "COMEDK", PGCET: "KEA (PGCET)" };

export function buildAdmissionChecklist(data: CollegeData, input: { program: string; exam?: string; today: string }): ChecklistResult {
  const program = findProgram(data, input.program);
  const route = findRoute(program, input.exam) ?? program.routes[0];
  const counselling = COUNSELLING[route.exam];
  const admissionFee = data.otherFees.find((f) => f.code === "ADMISSION")?.amount ?? 0;
  const caution = data.otherFees.find((f) => f.code === "CAUTION")?.amount ?? 0;

  const steps = counselling
    ? [
        { title: `Register for ${counselling} counselling`, detail: `Choose Northgate ${program.code} in your option entry.` },
        { title: "Download your seat allotment order", detail: "Pay the counselling authority's fee online as instructed." },
        { title: "Report to the Admissions Office", detail: "Within the reporting window, with original documents and two sets of photocopies." },
        { title: "Pay fees at the Accounts Section", detail: `Admission fee ${formatINR(admissionFee)}, caution deposit ${formatINR(caution)} and the first-year tuition of ${formatINR(route.feePerYear)}.` },
        { title: "Collect your ID card and portal login", detail: "Then check the orientation schedule." },
      ]
    : [
        { title: "Apply on the Northgate admissions portal", detail: route.exam === "Management" ? "Upload marks cards." : `Upload marks cards and your ${route.exam} scorecard.` },
        {
          title: program.code === "MBA" ? "Attend the group discussion and interview" : program.level === "PG" ? "Attend the technical interview" : "Attend the faculty interaction",
          detail: "Online or on campus.",
        },
        { title: "Confirm your seat within 15 days", detail: `Pay the admission fee of ${formatINR(admissionFee)} after the provisional admission letter.` },
        { title: "Complete document verification and fee payment", detail: `First-year tuition ${formatINR(route.feePerYear)} plus the caution deposit of ${formatINR(caution)}.` },
        { title: "Collect your ID card and portal login", detail: "Then check the orientation schedule." },
      ];

  const documents = data.requiredDocuments
    .filter((d) => d.level === "ALL" || d.level === program.level)
    .filter((d) => !(route.exam === "Management" && /scorecard/i.test(d.name)))
    .map((d) => ({ name: d.name, mandatory: d.mandatory, note: d.note ?? null }));

  const deadlines = data.importantDates
    .filter((d) => d.category === "admissions" && daysBetween(input.today, d.end ?? d.start) >= 0)
    .filter((d) => (counselling ? !/management quota/i.test(d.title) : !/counselling/i.test(d.title)))
    .map((d) => ({ title: d.title, date: d.start }));

  return {
    program: { code: program.code, name: program.name, degree: program.degree },
    route: { exam: route.exam, quota: route.quota },
    steps,
    documents,
    deadlines,
    contact: data.contacts.find((c) => c.office === "Admissions Office") ?? null,
    feeDueAtAdmission: admissionFee + caution + route.feePerYear,
  };
}

// -------------------------------------------------------------------- contact

/** The office whose topics overlap most with the text; Admissions by default. */
export function suggestContact(data: CollegeData, text: string): Contact | null {
  const words = new Set(text.toLowerCase().match(/[a-z]{3,}/g) ?? []);
  let best: Contact | null = null;
  let bestScore = 0;
  for (const c of data.contacts) {
    const vocab = `${c.office} ${c.topics}`.toLowerCase().match(/[a-z]{3,}/g) ?? [];
    const score = vocab.filter((w) => words.has(w) || words.has(w.replace(/s$/, ""))).length;
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best ?? data.contacts.find((c) => c.office === "Admissions Office") ?? data.contacts[0] ?? null;
}
