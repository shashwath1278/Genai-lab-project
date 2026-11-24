// Shared by client and server: no Node imports here.

export const COLLEGE = {
  name: "M S Ramaiah Institute of Technology",
  short: "MSRIT",
  city: "Bengaluru",
  /** Where the official information lives. */
  site: "msrit.edu",
  /** The app keeps its own name; it is not an official MSRIT service. */
  assistant: "Northgate Copilot",
};

/** Any name for the college: its own, or the app's ("is Northgate good for CSE?"). */
export const COLLEGE_NAMES = /\bm\.?\s?s\.?\s?ramaiah institute of tech\w*|\bramaiah institute of tech\w*|\bmsrit\b|\bnorthgate(?: institute of technology)?\b|\bngit\b/gi;

export const PERSONAS = [
  {
    id: "prospective",
    label: "Prospective student",
    short: "Applicant",
    blurb: "Admissions, cutoffs, fees, campus life",
    tone: "an applicant deciding whether and how to join. Be encouraging and practical, explain admission jargon (quota, counselling, cutoff) briefly, and point out the next step they should take.",
    starters: ["Can I get AI & ML with KCET rank 12,000?", "CSE cost for 4 years with hostel?", "Documents needed for admission?"],
  },
  {
    id: "current",
    label: "Current student",
    short: "Student",
    blurb: "Exams, attendance, hostel, library, clubs",
    tone: "a student already enrolled. Be brief and direct, like a helpful senior. Lead with the rule or the date, then the detail.",
    starters: ["What attendance do I need?", "How do I contact the Controller of Examinations?", "How do I apply for revaluation?"],
  },
  {
    id: "parent",
    label: "Parent",
    short: "Parent",
    blurb: "Safety, fees, refunds, progress tracking",
    tone: "a parent or guardian. Be warm, clear and reassuring without overselling. Spell out costs, safety measures and who to contact, and avoid student slang.",
    starters: ["Hostel rules and mess timings?", "Refund if we leave the hostel?", "Which scholarships cut the fees?"],
  },
] as const;

export type PersonaId = (typeof PERSONAS)[number]["id"];

export const LANGUAGES = [
  { id: "en", label: "English", native: "English", speech: "en-IN" },
  { id: "hi", label: "Hindi", native: "हिन्दी", speech: "hi-IN" },
  { id: "kn", label: "Kannada", native: "ಕನ್ನಡ", speech: "kn-IN" },
  { id: "ta", label: "Tamil", native: "தமிழ்", speech: "ta-IN" },
  { id: "te", label: "Telugu", native: "తెలుగు", speech: "te-IN" },
] as const;

export type LanguageId = (typeof LANGUAGES)[number]["id"];

export function getPersona(id: string | undefined) {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];
}

export function getLanguage(id: string | undefined) {
  return LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0];
}
