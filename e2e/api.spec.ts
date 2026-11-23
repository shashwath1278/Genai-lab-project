import { expect, test } from "@playwright/test";

// API contract checks that need no LLM call.

test("status reports the knowledge base and the configured model", async ({ request }) => {
  const res = await request.get("/api/status");
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.documents).toBe(21);
  expect(body.chunks).toBe(134);
  expect(body.llm?.provider).toMatch(/gemini|groq/);
});

test("chat rejects requests without a user message", async ({ request }) => {
  const empty = await request.post("/api/chat", { data: { messages: [] } });
  expect(empty.status()).toBe(400);
  const bad = await request.post("/api/chat", { data: "not json", headers: { "content-type": "application/json" } });
  expect(bad.status()).toBe(400);
});

test("plan items are scoped to the browser session and export to .ics", async ({ playwright, baseURL }) => {
  const a = await playwright.request.newContext({ baseURL });
  const b = await playwright.request.newContext({ baseURL });

  const added = await a.post("/api/plan", {
    data: { items: [{ kind: "deadline", title: "Exam fee, last date; pay online", dueDate: "2026-12-01", detail: "Late fee applies" }, { kind: "task", title: "Get marks card" }] },
  });
  expect((await added.json()).added).toBe(2);
  const again = await a.post("/api/plan", { data: { items: [{ kind: "task", title: "Get marks card" }] } });
  expect((await again.json()).added).toBe(0); // duplicates are skipped

  const { items } = await (await a.get("/api/plan")).json();
  expect(items).toHaveLength(2);
  expect((await (await b.get("/api/plan")).json()).items).toHaveLength(0); // other session sees nothing

  const task = items.find((i: { kind: string }) => i.kind === "task");
  const toggled = await a.patch("/api/plan", { data: { id: task.id, done: true } });
  expect((await toggled.json()).items.find((i: { id: number }) => i.id === task.id).done).toBe(true);

  const ics = await a.get("/api/plan/ics");
  expect(ics.headers()["content-type"]).toContain("text/calendar");
  const text = await ics.text();
  expect(text).toContain("BEGIN:VCALENDAR\r\n");
  expect(text).toContain("DTSTART;VALUE=DATE:20261201");
  expect(text).toContain("SUMMARY:Exam fee\\, last date\\; pay online");
  expect(text).not.toContain("Get marks card"); // only open, dated items are exported

  await a.delete(`/api/plan?id=${task.id}`);
  expect((await (await a.get("/api/plan")).json()).items).toHaveLength(1);
  await a.dispose();
  await b.dispose();
});

test("feedback and admin endpoints validate their input", async ({ request }) => {
  expect((await request.post("/api/feedback", { data: { queryId: "x", value: "up" } })).status()).toBe(400);
  expect((await request.post("/api/feedback", { data: { queryId: 999999, value: "down" } })).status()).toBe(404);

  const docs = await (await request.get("/api/admin/documents")).json();
  const seed = docs.documents.find((d: { sourceType: string }) => d.sourceType === "seed");
  expect((await request.delete(`/api/admin/documents?id=${seed.id}`)).status()).toBe(400);

  const exe = await request.post("/api/admin/documents", {
    multipart: { file: { name: "notes.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") } },
  });
  expect(exe.status()).toBe(415);
  const blank = await request.post("/api/admin/documents", { data: { title: "Only a title" } });
  expect(blank.status()).toBe(400);
});
