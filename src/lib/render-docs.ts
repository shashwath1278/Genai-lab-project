import type { CollegeData, Route } from "./college-data";
import { COLLEGE } from "./college";
import { formatDateRange, formatINR, formatNumber } from "./format";

// Documents generated from the structured tables, so the text the bot cites and
// the numbers its calculators use always come from the same source.

export type GeneratedDoc = {
  slug: string;
  title: string;
  category: string;
  audience: string[];
  content: string;
};

function cutoffLabel(r: Route, cutoffYear: number): string {
  if (r.cutoffType === "rank") return `closing rank ${formatNumber(r.cutoff!)} (${cutoffYear})`;
  if (r.cutoffType === "percentile") return `${r.cutoff} percentile and above (${cutoffYear})`;
  if (r.cutoffType === "score") return `GATE score ${r.cutoff} and above (${cutoffYear})`;
  return "no entrance exam; 12th/degree marks and interview";
}

function programsDoc(d: CollegeData): GeneratedDoc {
  const lines = [
    `# Programmes, Eligibility & Fees (${d.academicYear})`,
    "",
    `This document lists every programme at ${COLLEGE.name} with its eligibility, admission routes, last year's closing cutoffs and the tuition fee per year for ${d.academicYear}. Tuition fees depend on the admission route (quota), not on the student's category.`,
    "",
  ];
  for (const p of d.programs) {
    lines.push(`## ${p.degree} ${p.name} (${p.code})`);
    lines.push("");
    lines.push(
      `${p.degree} ${p.name} is a ${p.durationYears}-year ${p.level === "UG" ? "undergraduate" : "postgraduate"} programme run by the ${p.department}, with an intake of ${p.intake} students.`,
    );
    lines.push(
      `Eligibility: ${p.subjects}; minimum aggregate ${p.minAggregate}% (${p.reservedMinAggregate}% for OBC and SC/ST candidates).`,
    );
    lines.push("");
    lines.push("| Admission route | Quota | Cutoff | Tuition fee per year |");
    lines.push("|---|---|---|---|");
    for (const r of p.routes) {
      lines.push(`| ${r.exam} | ${r.quota} | ${cutoffLabel(r, d.cutoffYear)} | ${formatINR(r.feePerYear)} |`);
    }
    lines.push("");
    if (p.placementRate != null) {
      lines.push(
        `Placements (${d.cutoffYear} season): ${p.placementRate}% of eligible students placed, median package ${p.medianPackageLpa} LPA, highest package ${p.highestPackageLpa} LPA.`,
      );
    }
    lines.push(`Highlights: ${p.highlights.join("; ")}.`);
    lines.push("");
  }

  lines.push("## Category relaxation for cutoffs");
  lines.push("");
  lines.push(
    `Cutoffs above are for General Merit (GM). In past years, OBC candidates were admitted up to about ${d.categoryRankMultiplier.OBC}x the GM closing rank and SC/ST candidates up to about ${d.categoryRankMultiplier["SC/ST"]}x. Percentile cutoffs are about ${d.categoryPercentileRelaxation.OBC} points lower for OBC and ${d.categoryPercentileRelaxation["SC/ST"]} points lower for SC/ST. These are indicative; the counselling authority's allotment is final.`,
  );
  lines.push("");

  lines.push("## Other fees (all programmes)");
  lines.push("");
  lines.push("| Fee | Amount | When | Refundable |");
  lines.push("|---|---|---|---|");
  for (const f of d.otherFees.filter((f) => !f.hostelOnly)) {
    lines.push(`| ${f.name} | ${formatINR(f.amount)} | ${f.frequency === "annual" ? "every year" : "once, at admission"} | ${f.refundable ? "yes" : "no"} |`);
  }
  lines.push("");
  return {
    slug: "programmes-eligibility-fees",
    title: `Programmes, Eligibility & Fees (${d.academicYear})`,
    category: "fees",
    audience: ["prospective", "parent"],
    content: lines.join("\n"),
  };
}

function hostelTransportDoc(d: CollegeData): GeneratedDoc {
  const lines = [
    `# Hostel, Mess & Transport Fees (${d.academicYear})`,
    "",
    "## Hostel room fees",
    "",
    "Hostel room fees are charged per academic year. Mess fees are charged separately.",
    "",
    "| Room type | Fee per year | Seats |",
    "|---|---|---|",
    ...d.hostelOptions.map((h) => `| ${h.name} | ${formatINR(h.feePerYear)} | ${h.seats} |`),
    "",
    "## Mess plans",
    "",
    "| Plan | Fee per year |",
    "|---|---|",
    ...d.messPlans.map((m) => `| ${m.name} | ${formatINR(m.feePerYear)} |`),
    "",
    "## One-time hostel charges",
    "",
    ...d.otherFees.filter((f) => f.hostelOnly).map((f) => `- ${f.name}: ${formatINR(f.amount)}${f.refundable ? " (refundable)" : ""}`),
    "",
    "## College bus fees",
    "",
    "The yearly bus pass fee depends on the distance of the boarding point from campus.",
    "",
    "| Zone | Fee per year |",
    "|---|---|",
    ...d.transportZones.map((z) => `| ${z.name} | ${formatINR(z.feePerYear)} |`),
    "",
  ];
  return {
    slug: "hostel-mess-transport-fees",
    title: `Hostel, Mess & Transport Fees (${d.academicYear})`,
    category: "fees",
    audience: ["prospective", "parent", "current"],
    content: lines.join("\n"),
  };
}

function scholarshipsDoc(d: CollegeData): GeneratedDoc {
  const lines = [
    "# Scholarships and Fee Concessions",
    "",
    "## Summary",
    "",
    "| Scholarship | Tuition waiver | Who qualifies | To keep it |",
    "|---|---|---|---|",
    ...d.scholarships.map((s) => `| ${s.name} | ${s.waiverPercent}% | ${s.criteria} | ${s.renewal} |`),
    "",
    "## Rules",
    "",
    ...d.scholarshipNotes.map((n) => `- ${n}`),
    "",
  ];
  for (const s of d.scholarships) {
    lines.push(`## ${s.name}`, "", `${s.waiverPercent}% of the tuition fee is waived for: ${s.criteria}. Renewal condition: ${s.renewal}.`, "");
  }
  return {
    slug: "scholarships",
    title: "Scholarships and Fee Concessions",
    category: "scholarships",
    audience: ["prospective", "parent", "current"],
    content: lines.join("\n"),
  };
}

const CATEGORY_TITLES: Record<string, string> = {
  admissions: "Admissions",
  academics: "Academics",
  exams: "Examinations",
  events: "Events and fests",
  hostel: "Hostel",
  scholarships: "Scholarships",
};

function calendarDoc(d: CollegeData): GeneratedDoc {
  const lines = [`# Academic Calendar and Key Dates (${d.academicYear})`, ""];
  const categories = [...new Set(d.importantDates.map((x) => x.category))];
  for (const c of categories) {
    lines.push(`## ${CATEGORY_TITLES[c] ?? c}`, "");
    for (const x of d.importantDates.filter((x) => x.category === c)) {
      lines.push(`- **${x.title}**: ${formatDateRange(x.start, x.end)}${x.note ? `. ${x.note}` : ""}`);
    }
    lines.push("");
  }
  return {
    slug: "academic-calendar",
    title: `Academic Calendar and Key Dates (${d.academicYear})`,
    category: "calendar",
    audience: ["current", "prospective", "parent"],
    content: lines.join("\n"),
  };
}

function contactsDoc(d: CollegeData): GeneratedDoc {
  const lines = ["# Contacts and Office Hours", ""];
  for (const c of d.contacts) {
    lines.push(
      `## ${c.office}`,
      "",
      `${c.person}, ${c.role}. Email ${c.email}, phone ${c.phone}. Location: ${c.location}. Hours: ${c.hours}. Contact for: ${c.topics}.`,
      "",
    );
  }
  return {
    slug: "contacts",
    title: "Contacts and Office Hours",
    category: "contacts",
    audience: ["prospective", "parent", "current"],
    content: lines.join("\n"),
  };
}

function documentsDoc(d: CollegeData): GeneratedDoc {
  const list = (level: "UG" | "PG") =>
    d.requiredDocuments
      .filter((x) => x.level === "ALL" || x.level === level)
      .map((x) => `- ${x.name}${x.mandatory ? "" : " (if applicable)"}${x.note ? `: ${x.note}` : ""}`);
  return {
    slug: "admission-documents",
    title: "Admission Documents Checklist",
    category: "admissions",
    audience: ["prospective", "parent"],
    content: [
      "# Admission Documents Checklist",
      "",
      "Bring the originals and two sets of self-attested photocopies to document verification.",
      "",
      "## B.E. (undergraduate) admissions",
      "",
      ...list("UG"),
      "",
      "## MBA, MCA and M.Tech (postgraduate) admissions",
      "",
      ...list("PG"),
      "",
    ].join("\n"),
  };
}

export function renderGeneratedDocs(d: CollegeData): GeneratedDoc[] {
  return [programsDoc(d), hostelTransportDoc(d), scholarshipsDoc(d), calendarDoc(d), contactsDoc(d), documentsDoc(d)];
}
