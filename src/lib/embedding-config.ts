export const EMBEDDING_MODEL = "Xenova/bge-small-en-v1.5";
export const EMBEDDING_DIM = 384;
// bge models expect this instruction on queries (not on passages).
export const QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";
