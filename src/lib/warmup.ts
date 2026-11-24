import { getCollegeData } from "./data";
import { embedQuery } from "./embeddings";

/** Best effort: a failure here only means the first question loads these itself. */
export async function warmUp() {
  try {
    getCollegeData();
    await embedQuery("warm up");
  } catch (err) {
    console.warn("[warm-up] skipped:", err instanceof Error ? err.message : err);
  }
}
