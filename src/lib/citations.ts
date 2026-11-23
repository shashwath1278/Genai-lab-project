// Shared by client and server.

/**
 * Models cite in different styles: Gemini writes [2]; gpt-oss writes 【2】 or
 * 【2†L3-L5】. Normalise them all to [2] (web results: [W2]) before linking or
 * reading aloud.
 */
export function normalizeCitations(text: string): string {
  return (
    text
      .replace(/[【［](W?\d{1,2})(?:[†:][^】］]*)?[】］]/g, "[$1]")
      // Anything else in those brackets (e.g. 【estimateCost】, a tool name) isn't a source: drop it.
      .replace(/ ?[【［](?!W?\d)[^】］]*[】］]/g, "")
  );
}
