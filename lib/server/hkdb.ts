import { getKv, updateKv } from "@/lib/server/kvStore";

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

const PROFILE_KEY = "hk_profiles";

async function readDb(): Promise<HKDB> {
  const fallback: HKDB = { profiles: {} };
  const db = await getKv<HKDB>(PROFILE_KEY, fallback);
  if (!db || typeof db !== "object" || !db.profiles || typeof db.profiles !== "object") {
    return fallback;
  }
  return db;
}

export async function getProfile(userKey: string): Promise<HKProfile | null> {
  if (!userKey) return null;
  const db = await readDb();
  return db.profiles[userKey] || null;
}

export async function saveProfile(userKey: string, profile: HKProfile): Promise<HKProfile> {
  if (!userKey) throw new Error("Missing user key");
  const updated = await updateKv<HKDB>(PROFILE_KEY, { profiles: {} }, (db) => {
    const next = db && typeof db === "object" ? db : { profiles: {} };
    const merged: HKProfile = {
      ...(next.profiles?.[userKey] || {}),
      ...profile,
      updatedAt: new Date().toISOString(),
    };
    return {
      ...next,
      profiles: {
        ...(next.profiles || {}),
        [userKey]: merged,
      },
    };
  });
  return updated.profiles[userKey];
}
