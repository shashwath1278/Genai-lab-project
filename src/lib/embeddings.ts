import path from "node:path";
import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import { EMBEDDING_MODEL, QUERY_PREFIX } from "./embedding-config";

env.cacheDir = path.join(process.cwd(), ".cache", "models");

const g = globalThis as unknown as { __embedder?: Promise<FeatureExtractionPipeline> };

function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!g.__embedder) {
    const loading = pipeline("feature-extraction", EMBEDDING_MODEL, { dtype: "q8" }) as Promise<FeatureExtractionPipeline>;
    // Don't cache a failed load (e.g. offline on first run); retry next call.
    loading.catch(() => {
      if (g.__embedder === loading) g.__embedder = undefined;
    });
    g.__embedder = loading;
  }
  return g.__embedder;
}

async function embed(texts: string[]): Promise<Float32Array[]> {
  const extractor = await getEmbedder();
  const output = await extractor(texts, { pooling: "cls", normalize: true });
  const [rows, dim] = output.dims as [number, number];
  const data = output.data as Float32Array;
  return Array.from({ length: rows }, (_, i) => data.slice(i * dim, (i + 1) * dim));
}

export async function embedPassages(texts: string[], batchSize = 16): Promise<Float32Array[]> {
  const out: Float32Array[] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    out.push(...(await embed(texts.slice(i, i + batchSize))));
  }
  return out;
}

export async function embedQuery(text: string): Promise<Float32Array> {
  const [vec] = await embed([QUERY_PREFIX + text]);
  return vec;
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
