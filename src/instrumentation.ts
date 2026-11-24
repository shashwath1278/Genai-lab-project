/** Runs once when the server starts: open the database and load the embedding
 *  model, so the first question doesn't wait for them. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { warmUp } = await import("./lib/warmup");
  void warmUp();
}
