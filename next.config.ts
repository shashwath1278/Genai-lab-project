import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Native / filesystem-heavy packages stay as plain Node requires.
  // better-sqlite3 and @huggingface/transformers are already on Next's default list.
  serverExternalPackages: ["sqlite-vec", "onnxruntime-node"],
};

export default nextConfig;
