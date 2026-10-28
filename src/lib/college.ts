// Shared by client and server: no Node imports here.

export const COLLEGE = {
  name: "Northgate Institute of Technology",
  short: "NGIT",
  city: "Bengaluru",
  assistant: "Northgate Copilot",
};

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
    starters: ["Last date to pay the exam fee?", "Attendance needed to write exams?", "How do I apply for revaluation?"],
  },
  {
    id: "parent",
    label: "Parent",
    short: "Parent",
    blurb: "Safety, fees, refunds, progress tracking",
    tone: "a parent or guardian. Be warm, clear and reassuring without overselling. Spell out costs, safety measures and who to contact, and avoid student slang.",
    starters: ["How safe is the girls' hostel?", "Refund if we cancel admission?", "Which scholarships cut the fees?"],
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
