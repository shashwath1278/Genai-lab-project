import { loadCollegeDataFromDb, type CollegeData } from "./college-data";
import { getDb } from "./db";

const g = globalThis as unknown as { __collegeData?: CollegeData };

/** Structured college data from SQLite, cached per process (it only changes on reseed). */
export function getCollegeData(): CollegeData {
  g.__collegeData ??= loadCollegeDataFromDb(getDb());
  return g.__collegeData;
}
