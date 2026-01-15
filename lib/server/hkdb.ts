import fs from "node:fs";
import path from "node:path";

export type HKProfile = {
  name?: string;
  company?: string;
  phone?: string;
  localUserId?: string;
  requestId?: string;
  updatedAt?: string;
};

type HKDB = {
  profiles: Record<string, HKProfile>;
};

function dbPath() {
  // Local dev persistence. In production/serverless you MUST use a real DB.
  return path.join(process.cwd(), ".hkdb.json");
}

function readDb(): HKDB {
  const p = dbPath();
  try {
    const raw = fs.readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.profiles && typeof parsed.profiles === "object") {
      return parsed as HKDB;
    }
  } catch {}
  return { profiles: {} };
}

function writeDb(db: HKDB) {
  const p = dbPath();
  fs.writeFileSync(p, JSON.stringify(db, null, 2), "utf-8");
}

export function getProfile(userKey: string): HKProfile | null {
  if (!userKey) return null;
  const db = readDb();
  return db.profiles[userKey] || null;
}

export function saveProfile(userKey: string, profile: HKProfile): HKProfile {
  if (!userKey) throw new Error("Missing user key");
  const db = readDb();
  const updated: HKProfile = {
    ...db.profiles[userKey],
    ...profile,
    updatedAt: new Date().toISOString(),
  };
  db.profiles[userKey] = updated;
  writeDb(db);
  return updated;
}
