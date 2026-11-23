import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { UIMessage } from "ai";
import { afterAll, describe, expect, it } from "vitest";
import { getChat, listChats, saveChat } from "../src/lib/chats";
import { loadCollegeDataFromJson } from "../src/lib/college-data";
import { openDb } from "../src/lib/db";
import {
  clearMemory,
  deleteFact,
  describeMemory,
  factsFromReadings,
  factsFromTools,
  listMemory,
  memoryEnabled,
  noteFact,
  saveFacts,
  setMemoryEnabled,
} from "../src/lib/memory";
import type { ReadingFile } from "../src/lib/reading";

const data = loadCollegeDataFromJson(path.join(process.cwd(), "data", "structured"));
const file = path.join(os.tmpdir(), `northgate-memory-${process.pid}.db`);
const db = openDb(file);
afterAll(() => {
  db.close();
  for (const s of ["", "-wal", "-shm"]) fs.rmSync(file + s, { force: true });
});

describe("facts from tool inputs", () => {
  it("reads an eligibility check, ignoring the default category", () => {
    const facts = factsFromTools([{ toolName: "checkEligibility", input: { program: "cse", exam: "kcet", rank: 12000, aggregatePercent: 85.3, category: "GM" } }], data);
    expect(facts.map((f) => [f.key, f.value])).toEqual([
      ["program", "CSE (Computer Science & Engineering)"],
      ["result", "KCET rank 12,000"],
      ["aggregate", "85.3%"],
    ]);
  });

  it("reads a cost estimate's choices by name", () => {
    const facts = factsFromTools([{ toolName: "estimateCost", input: { program: "AIML", exam: "COMEDK", hostel: "DOUBLE", mess: "VEG", transport: "B" } }], data);
    expect(Object.fromEntries(facts.map((f) => [f.key, f.value]))).toMatchObject({
      route: "COMEDK",
      hostel: "Double sharing, non-AC",
      mess: "Vegetarian mess plan",
      transport: expect.stringMatching(/^Zone B/),
    });
  });

  it("keeps the last value when the same thing comes up twice, and skips junk", () => {
    const facts = factsFromTools(
      [
        { toolName: "comparePrograms", input: { programs: ["CSE", "ECE", "nonsense"] } },
        { toolName: "checkEligibility", input: { program: "ECE", exam: "JEE Main", percentile: 96.5, category: "OBC" } },
        { toolName: "checkEligibility", input: { program: "not a programme" } },
        { toolName: "getImportantDates", input: {} },
      ],
      data,
    );
    expect(Object.fromEntries(facts.map((f) => [f.key, f.value]))).toEqual({
      shortlist: "CSE, ECE",
      program: "ECE (Electronics & Communication Engineering)",
      result: "JEE Main 96.5 percentile",
      category: "OBC",
    });
  });

  it("reads a marks card's PCM aggregate", () => {
    const file = { pcmPercent: 85.33, reading: { kind: "marksheet", exam: null } } as unknown as ReadingFile;
    expect(factsFromReadings([file])).toEqual([{ key: "aggregate", label: "12th PCM aggregate", value: "85.33%", source: "your marks card" }]);
  });

  it("turns a stated fact into a note", () => {
    expect(noteFact("home area", "Whitefield, Bengaluru")).toEqual({ key: "note:home-area", label: "Home area", value: "Whitefield, Bengaluru", source: "you told me" });
    expect(noteFact("  ", "x")).toBeNull();
  });
});

describe("memory store", () => {
  it("saves, reports only changes, and lets the user forget", () => {
    const a = "session-a";
    const first = saveFacts(a, [{ key: "result", label: "Entrance exam result", value: "KCET rank 12,000", source: "eligibility check" }], db);
    expect(first).toHaveLength(1);
    expect(saveFacts(a, first, db)).toEqual([]); // unchanged
    expect(saveFacts(a, [{ ...first[0], value: "KCET rank 9,500" }], db)).toHaveLength(1);
    expect(listMemory(a, db).map((f) => f.value)).toEqual(["KCET rank 9,500"]);
    expect(listMemory("session-b", db)).toEqual([]); // other browsers see nothing

    expect(describeMemory(listMemory(a, db))).toBe("- Entrance exam result: KCET rank 9,500 (from eligibility check)");
    deleteFact(a, listMemory(a, db)[0].id, db);
    expect(listMemory(a, db)).toEqual([]);
  });

  it("caps free-form notes", () => {
    const s = "session-notes";
    for (let i = 0; i < 15; i++) saveFacts(s, [noteFact(`note ${i}`, `value ${i}`)!], db);
    expect(listMemory(s, db)).toHaveLength(12);
    clearMemory(s, db);
    expect(listMemory(s, db)).toEqual([]);
  });

  it("can be switched off per browser", () => {
    expect(memoryEnabled("session-c", db)).toBe(true);
    setMemoryEnabled("session-c", false, db);
    expect(memoryEnabled("session-c", db)).toBe(false);
    expect(memoryEnabled("session-a", db)).toBe(true);
  });
});

describe("chat history", () => {
  const msg = (id: string, role: "user" | "assistant", parts: UIMessage["parts"]): UIMessage => ({ id, role, parts });

  it("saves chats per browser, with attachments by name only", () => {
    const messages = [
      msg("1", "user", [
        { type: "file", mediaType: "image/jpeg", filename: "receipt.jpg", url: "data:image/jpeg;base64,AAAA" },
        { type: "text", text: "Is this fee receipt correct?" },
      ]),
      msg("2", "assistant", [{ type: "text", text: "Two lines don't match." }]),
    ];
    saveChat("session-a", "chat-0001", messages, db);
    expect(listChats("session-a", db)).toEqual([expect.objectContaining({ id: "chat-0001", title: "Is this fee receipt correct?", turns: 1 })]);
    const saved = getChat("session-a", "chat-0001", db)!;
    expect(saved.messages[0].parts[0]).toMatchObject({ type: "file", filename: "receipt.jpg", url: "" });

    // Another browser can neither read nor overwrite it.
    expect(getChat("session-b", "chat-0001", db)).toBeNull();
    saveChat("session-b", "chat-0001", [msg("9", "user", [{ type: "text", text: "hijack" }])], db);
    expect(getChat("session-a", "chat-0001", db)!.title).toBe("Is this fee receipt correct?");
  });

  it("ignores bad ids", () => {
    saveChat("session-a", "../../etc", [msg("1", "user", [{ type: "text", text: "x" }])], db);
    expect(listChats("session-a", db).map((c) => c.id)).toEqual(["chat-0001"]);
  });
});
