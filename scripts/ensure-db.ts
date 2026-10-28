import fs from "node:fs";
import { DB_PATH, getDb } from "../src/lib/db";
import { seed } from "./seed";

// Runs before `npm run dev`: builds the knowledge base on first start only.
async function main() {
  if (fs.existsSync(DB_PATH)) {
    const { n } = getDb().prepare("SELECT COUNT(*) AS n FROM chunks").get() as { n: number };
    if (n > 0) {
      console.log(`knowledge base ready (${n} chunks) at ${DB_PATH}`);
      return;
    }
  }
  console.log("no knowledge base yet; seeding...");
  await seed();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
