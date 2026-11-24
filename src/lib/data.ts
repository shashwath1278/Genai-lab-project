import { loadCollegeDataFromDb, type CollegeData } from "./college-data";
import { getDb } from "./db";

const g = globalThis as unknown as { __collegeData?: { seededAt: string; data: CollegeData } };

/** Structured college data from SQLite, cached until the database is reseeded. */
export function getCollegeData(): CollegeData {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'seededAt'").get() as { value: string } | undefined;
  const seededAt = row?.value ?? "";
  if (g.__collegeData?.seededAt !== seededAt || !g.__collegeData?.data) g.__collegeData = { seededAt, data: loadCollegeDataFromDb(db) };
  return g.__collegeData.data;
}
