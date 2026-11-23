import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The end-to-end suite builds into its own folder so it can run beside `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  // Native / filesystem-heavy packages stay as plain Node requires.
  // better-sqlite3 and @huggingface/transformers are already on Next's default list.
  serverExternalPackages: ["sqlite-vec", "onnxruntime-node"],
};

export default nextConfig;
