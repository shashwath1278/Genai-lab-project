import type { JSONValue } from "@ai-sdk/provider";
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
import { planCampusRoute } from "./campus-map";
import type { CollegeData } from "./college-data";
import { moneyForModel } from "./format";
import { recordGap } from "./gaps";
import { noteFact } from "./memory";
import { namedSites } from "./sites";
import { asksAboutCollege, searchWeb, webNote, webSearchEnabled } from "./websearch";

// Each tool's output renders as a card in the chat (see components/cards).

const EXAMS = ["KCET", "COMEDK", "JEE Main", "PGCET", "CAT", "MAT", "GATE", "Management"] as const;
// The codes themselves are listed once, in the instructions, not in every tool.
const PROGRAM_CODE = "Programme code, e.g. CSE.";
const DATE_CATEGORIES = ["all", "admissions", "academics", "exams", "events", "hostel", "scholarships"] as const;

/** What the model reads back: the card's result, with rupee figures pre-written to copy. */
const forModel = ({ output }: { output: unknown }) => ({ type: "json" as const, value: moneyForModel(output) as JSONValue });

/** Calculator errors go back to the model as data so it can correct itself. */
function safe<T>(fn: () => T): T | { error: string } {
  try {
    return fn();
  } catch (e) {
    if (e instanceof CalcError) return { error: e.message };
    throw e;
  }
}

export function createTools({
  data,
  queryId,
  question,
  today,
  onRemember,
  webStart = 0,
}: {
  data: CollegeData;
  queryId: number;
  question: string;
  today: string;
  /** Set when memory is on: saves a fact and returns whether it was new. */
  /** Web results already shown in this answer (numbering continues from here). */
  webStart?: number;
  onRemember?: (fact: NonNullable<ReturnType<typeof noteFact>>) => boolean;
}) {
  let webResults = webStart; // W-numbers stay unique across several searches in one answer

  const web = {
    searchWeb: tool({
      description:
        "Search the live web, a named site (Reddit, X, Quora, YouTube, GitHub, LinkedIn, any domain) or official exam and government sites. Use it whenever the user asks to search, scan, browse or check the web or a site, and for anything outside the handbook: reviews and opinions, news, companies and salaries, careers, entrance exams, government schemes, Bengaluru, study resources.",
      inputSchema: z.object({
        query: z.string().describe("Focused English query. Write 'Ramaiah Institute of Technology MSRIT' when it's about this college."),
        sites: z.array(z.string()).optional().describe("Only these sites, e.g. ['reddit'] or ['quora.com']."),
        official: z.boolean().optional().describe("True for exam dates and procedures, government schemes, certificates, and the college's own website."),
        recent: z.enum(["day", "week", "month", "year"]).optional().describe("Only recent pages, for news."),
      }),
      execute: async ({ query, sites, official, recent }) => {
        try {
          const asked = namedSites(question).map((s) => s.label); // sites the user named, even if the model left them out
          const out = await searchWeb(query, {
            sites: sites?.length ? sites : asked,
            official,
            recent,
            aboutCollege: asksAboutCollege(`${question} ${query}`),
            startAt: webResults + 1,
          });
          webResults += out.results.length;
          return out;
        } catch (e) {
          return { error: e instanceof Error ? e.message : "Web search failed." };
        }
      },
      toModelOutput: ({ output }) => ({
        type: "json" as const,
        value: (
          "error" in output
            ? output
            : { note: webNote(output), results: output.results.map((r) => ({ id: r.id, title: r.title, site: r.site, kind: r.tier, published: r.published, text: r.snippet })) }
        ) as JSONValue,
      }),
    }),
  };

  const memory = {
    remember: tool({
      description:
        "Save a lasting fact the user told you about themselves that will help in later chats: where they live or board the bus, diet, the programme they've decided on, interests, constraints. Not for questions, one-off details or anything sensitive (health, religion, names, phone numbers, ID numbers). Call it at most once per answer.",
      inputSchema: z.object({
        label: z.string().describe("Short label, e.g. 'Home area' or 'Diet'."),
        value: z.string().describe("The fact, e.g. 'Whitefield, Bengaluru' or 'Vegetarian'."),
      }),
      execute: async ({ label, value }) => {
        const fact = noteFact(label, value);
        // Never after reading the web in the same answer: a page must not be able to plant a memory.
        if (!fact || !onRemember || webResults > 0) return { saved: false };
        return { saved: onRemember(fact), label: fact.label, value: fact.value };
      },
    }),
  };

  const map = {
    showCampusMap: tool({
      description:
        "Show the campus map with a place highlighted and walking directions. Use for any 'where is ...', 'how do I get to ...', 'which building / room is ...' or 'campus map' question. Name places in plain words: 'examination section', 'girls hostel', 'Room A-102', 'placement cell'.",
      inputSchema: z.object({
        to: z.string().optional().describe("Where the user wants to go. Omit to show the whole campus."),
        from: z.string().optional().describe("Where they are starting from, if they said. Defaults to the Main Gate."),
      }),
      execute: async ({ to, from }) => planCampusRoute({ to, from }),
      // The model needs the words, not the map geometry.
      toModelOutput: ({ output }) => ({
        type: "json" as const,
        value: {
          destination: output.to && { name: output.to.name, whatIsThere: output.to.detail },
          start: output.from?.name ?? null,
          walk: output.route && `about ${output.route.distanceM} m, ${output.route.minutes} min`,
          steps: output.route?.steps ?? [],
          alreadyThere: output.sameBuilding,
          notOnMap: output.unknown,
          placesOnMap: output.unknown || !output.to ? output.known : undefined,
        },
      }),
    }),
  };

  return {
    ...(onRemember ? memory : ({} as Partial<typeof memory>)),
    ...(webSearchEnabled() ? web : ({} as Partial<typeof web>)),
    checkEligibility: tool({
      description:
        "Check whether a student is eligible for a programme and how likely admission is through a given exam, using last year's closing cutoffs. Use for any 'am I eligible / can I get' question.",
      inputSchema: z.object({
        program: z.string().describe(PROGRAM_CODE),
        exam: z.enum(EXAMS).describe("Admission route the student is using."),
        category: z.enum(["GM", "OBC", "SC/ST"]).optional().describe("Reservation category; GM if not mentioned."),
        aggregatePercent: z.number().optional().describe("12th PCM aggregate (UG) or degree aggregate (PG), in percent."),
        rank: z.number().optional().describe("Rank for KCET, COMEDK or PGCET."),
        percentile: z.number().optional().describe("Percentile for JEE Main, CAT or MAT."),
        score: z.number().optional().describe("GATE score."),
      }),
      execute: async (input) => safe(() => checkEligibility(data, input)),
      toModelOutput: forModel,
    }),

    estimateCost: tool({
      description:
        "Compute the total cost of a programme: tuition by admission route, scholarship waiver, annual fees, hostel, mess, bus and one-time fees, year by year. Use for any fee total or 'how much will it cost' question.",
      inputSchema: z.object({
        program: z.string().describe(PROGRAM_CODE),
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
          .describe(`Scholarship to apply: ${data.scholarships.map((s) => `${s.code} = ${s.name}`).join("; ")}.`),
        years: z.number().optional().describe("Number of years to include; defaults to the full programme."),
      }),
      execute: async (input) => safe(() => estimateCost(data, input)),
      toModelOutput: forModel,
    }),

    comparePrograms: tool({
      description: "Compare 2 to 4 programmes side by side: duration, intake, cutoffs, fees by route, placements and highlights.",
      inputSchema: z.object({
        programs: z.array(z.string()).min(2).max(4).describe("Programme codes."),
      }),
      execute: async ({ programs }) => safe(() => comparePrograms(data, programs)),
      toModelOutput: forModel,
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
        program: z.string().describe(PROGRAM_CODE),
        exam: z.enum(EXAMS).optional().describe("Admission route."),
      }),
      execute: async ({ program, exam }) => safe(() => buildAdmissionChecklist(data, { program, exam, today })),
    }),

    ...(data.campusMap ? map : ({} as Partial<typeof map>)),

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
