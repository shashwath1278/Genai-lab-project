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

/** Non-Latin script (Devanagari, Kannada, ...) anywhere in the text. */
export const hasNonAscii = (text: string) => /[^\x00-\x7F]/.test(text);
