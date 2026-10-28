import { tool } from "ai";
import { z } from "zod";
import {
  buildAdmissionChecklist,
  CalcError,
  checkEligibility,
  comparePrograms,
  estimateCost,
  getImportantDates,
  suggestContact,
} from "./calculators";
import type { CollegeData } from "./college-data";
import { recordGap } from "./gaps";

// Each tool's output renders as a card in the chat (see components/cards).

const EXAMS = ["KCET", "COMEDK", "JEE Main", "PGCET", "CAT", "MAT", "GATE", "Management"] as const;
const DATE_CATEGORIES = ["all", "admissions", "academics", "exams", "events", "hostel", "scholarships"] as const;

/** Calculator errors go back to the model as data so it can correct itself. */
function safe<T>(fn: () => T): T | { error: string } {
  try {
    return fn();
  } catch (e) {
    if (e instanceof CalcError) return { error: e.message };
    throw e;
  }
}

export function createTools({ data, queryId, question, today }: { data: CollegeData; queryId: number; question: string; today: string }) {
  const programHelp = `Programme code, one of: ${data.programs.map((p) => `${p.code} (${p.name})`).join(", ")}.`;

  return {
    checkEligibility: tool({
      description:
        "Check whether a student is eligible for a programme and how likely admission is through a given exam, using last year's closing cutoffs. Use for any 'am I eligible / can I get' question.",
      inputSchema: z.object({
        program: z.string().describe(programHelp),
        exam: z.enum(EXAMS).describe("Admission route the student is using."),
        category: z.enum(["GM", "OBC", "SC/ST"]).optional().describe("Reservation category; GM if not mentioned."),
        aggregatePercent: z.number().optional().describe("12th PCM aggregate (UG) or degree aggregate (PG), in percent."),
        rank: z.number().optional().describe("Rank for KCET, COMEDK or PGCET."),
        percentile: z.number().optional().describe("Percentile for JEE Main, CAT or MAT."),
        score: z.number().optional().describe("GATE score."),
      }),
      execute: async (input) => safe(() => checkEligibility(data, input)),
    }),

    estimateCost: tool({
      description:
        "Compute the total cost of a programme: tuition by admission route, scholarship waiver, annual fees, hostel, mess, bus and one-time fees, year by year. Use for any fee total or 'how much will it cost' question.",
      inputSchema: z.object({
        program: z.string().describe(programHelp),
        exam: z.enum(EXAMS).optional().describe("Admission route; decides the tuition fee. Defaults to the government quota."),
        hostel: z
          .enum(["none", ...data.hostelOptions.map((h) => h.code)] as [string, ...string[]])
          .optional()
          .describe(`Hostel room: ${data.hostelOptions.map((h) => `${h.code} = ${h.name}`).join("; ")}. 'none' for day scholars.`),
        mess: z
          .enum(["none", ...data.messPlans.map((m) => m.code)] as [string, ...string[]])
          .optional()
          .describe(`Mess plan: ${data.messPlans.map((m) => `${m.code} = ${m.name}`).join("; ")}.`),
        transport: z
          .enum(["none", ...data.transportZones.map((z) => z.code)] as [string, ...string[]])
          .optional()
          .describe(`College bus zone: ${data.transportZones.map((z) => `${z.code} = ${z.name}`).join("; ")}.`),
        scholarship: z
          .enum(["none", ...data.scholarships.map((s) => s.code)] as [string, ...string[]])
          .optional()
          .describe(`Scholarship to apply: ${data.scholarships.map((s) => `${s.code} = ${s.name} (${s.criteria})`).join("; ")}.`),
        years: z.number().optional().describe("Number of years to include; defaults to the full programme."),
      }),
      execute: async (input) => safe(() => estimateCost(data, input)),
    }),

    comparePrograms: tool({
      description: "Compare 2 to 4 programmes side by side: duration, intake, cutoffs, fees by route, placements and highlights.",
      inputSchema: z.object({
        programs: z.array(z.string()).min(2).max(4).describe(programHelp),
      }),
      execute: async ({ programs }) => safe(() => comparePrograms(data, programs)),
    }),

    getImportantDates: tool({
      description: "List key dates and deadlines from the academic calendar (exams, fee deadlines, fests, admissions, hostel, scholarships) with how many days are left.",
      inputSchema: z.object({
        category: z.enum(DATE_CATEGORIES).optional().describe("Filter by category; 'all' if unsure."),
        upcomingOnly: z.boolean().optional().describe("Hide dates that have already passed. Default true."),
      }),
      execute: async ({ category, upcomingOnly }) => getImportantDates(data, { category, upcomingOnly: upcomingOnly ?? true, today }),
    }),

    buildAdmissionChecklist: tool({
      description: "Build a step-by-step admission checklist for a programme and route: steps, documents to bring, upcoming deadlines and the office to contact.",
      inputSchema: z.object({
        program: z.string().describe(programHelp),
        exam: z.enum(EXAMS).optional().describe("Admission route."),
      }),
      execute: async ({ program, exam }) => safe(() => buildAdmissionChecklist(data, { program, exam, today })),
    }),

    flagKnowledgeGap: tool({
      description:
        "Call this when the context passages do not contain the answer to the user's question (or only part of it). It logs the question for the college staff so the missing information gets added, and returns the best office to contact.",
      inputSchema: z.object({
        topic: z.string().describe("Short description of the missing information, in English."),
      }),
      execute: async ({ topic }) => {
        const gap = recordGap(queryId, "model-flag");
        const contact = suggestContact(data, `${topic} ${question}`);
        return {
          logged: !!gap,
          topic,
          contact: contact && { office: contact.office, email: contact.email, phone: contact.phone, hours: contact.hours },
        };
      },
    }),
  };
}

export type CopilotTools = ReturnType<typeof createTools>;
