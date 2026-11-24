import path from "node:path";

// Native packages (SQLite, the vector extension, the ONNX runtime) are loaded by
// Node itself rather than by the bundler. Turbopack would otherwise link them
// with directory junctions, which some drives can't create (os error 1392), and
// that kept `npm run dev` on the much slower webpack server. `createRequire` is
// fetched at run time because webpack strips an imported one at build time.
const { createRequire } = process.getBuiltinModule("node:module");
const nodeRequire = createRequire(path.join(process.cwd(), "package.json"));

export const loadBetterSqlite = () => nodeRequire("better-sqlite3") as typeof import("better-sqlite3");
export const loadSqliteVec = () => nodeRequire("sqlite-vec") as typeof import("sqlite-vec");
export const loadTransformers = () => nodeRequire("@huggingface/transformers") as typeof import("@huggingface/transformers");
