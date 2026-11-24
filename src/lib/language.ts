// Romanized Hindi ("Hinglish") is plain ASCII, so the non-ASCII check alone
// misses it and the query would be searched untranslated. These are common
// Hindi function and question words that rarely appear in English text;
// two or more distinct hits marks a query as code-mixed.
const HINGLISH_WORDS = new Set(
  (
    "kya hai hain ka ki ke ko mein kitna kitni kitne kaise kab kahan kaun kyun kyon nahi nahin aur bhi hoga hogi " +
    "chahiye karna karne sakta sakti sakte milega milegi milta milti wala wali batao bataiye mujhe hum humein " +
    "mera meri mere apna kaun-sa kaunsa liye abhi"
  ).split(" "),
);

export function looksHinglish(text: string): boolean {
  const words = new Set(text.toLowerCase().match(/[a-z-]+/g) ?? []);
  let hits = 0;
  for (const w of words) if (HINGLISH_WORDS.has(w) && ++hits >= 2) return true;
  return false;
}

// Words that lean on what was said before. "Is there…" and "this college" don't.
const REFERS =
  /\b(?:it|its|that|this|those|these|they|them|their|there|he|she|same|ones?|other|another|above|previous|earlier|instead|else|also|too|again|former|latter)\b|^\s*(?:and|or|but|so|then|what about|how about|why|ok(?:ay)?|yes|no|sure|more|which)\b/i;

/** A follow-up that can't be searched on its own ("and its hostel?"). Self-contained ones skip the rewrite call. */
export function dependsOnHistory(question: string): boolean {
  const q = question.replace(/\b(?:is|are|was|were|will) there\b/gi, " ").replace(/\b(?:this|the same) (?:college|campus|institute|university|year|semester|month|week)\b/gi, " ");
  return question.trim().split(/\s+/).length < 5 || REFERS.test(q);
}

/** Non-Latin script (Devanagari, Kannada, ...) anywhere in the text. */
export const hasNonAscii = (text: string) => /[^\x00-\x7F]/.test(text);
