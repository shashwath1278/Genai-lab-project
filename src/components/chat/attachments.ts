"use client";

import type { FileUIPart } from "ai";

export const MAX_ATTACHMENTS = 3;
const MAX_PDF_BYTES = 6 * 1024 * 1024;
const MAX_EDGE = 1600;
export const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/**
 * Turns a picked file into a message part. Photos are shrunk in the browser
 * (longest side 1,600 px, JPEG) so a phone photo of a page is a few hundred KB,
 * not several MB. PDFs go as they are, up to 6 MB.
 */
export async function prepareAttachment(file: File): Promise<FileUIPart> {
  if (file.type === "application/pdf") {
    if (file.size > MAX_PDF_BYTES) throw new Error(`"${file.name}" is larger than 6 MB.`);
    return { type: "file", mediaType: "application/pdf", filename: file.name, url: await readAsDataUrl(file) };
  }
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(`"${file.name}" isn't a JPG, PNG, WebP or PDF.`);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`"${file.name}" couldn't be opened as an image.`);
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; // transparent PNGs become white, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const name = file.name.replace(/\.(png|webp|jpe?g)$/i, "") + ".jpg";
  return { type: "file", mediaType: "image/jpeg", filename: name, url: canvas.toDataURL("image/jpeg", 0.85) };
}

/** For the request body: earlier attachments were read already, so only their names travel. */
export function withoutOldAttachments<M extends { parts: { type: string }[] }>(messages: M[]): M[] {
  return messages.map((m, i) => {
    if (i === messages.length - 1) return m;
    const files = m.parts.filter((p): p is FileUIPart => p.type === "file");
    if (!files.length) return m;
    return { ...m, parts: [...m.parts.filter((p) => p.type !== "file"), { type: "text", text: `[Attached: ${files.map((f) => f.filename ?? "a file").join(", ")}]` }] };
  });
}
