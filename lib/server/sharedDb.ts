"use server";

import { getKv, setKv, updateKv } from "@/lib/server/kvStore";

const SHARED_DB_KEY = "hkdb_shared";

export async function readSharedDb<T>(fallback: T): Promise<T> {
  return getKv<T>(SHARED_DB_KEY, fallback);
}

export async function writeSharedDb<T>(value: T): Promise<void> {
  await setKv<T>(SHARED_DB_KEY, value);
}

export async function updateSharedDb<T>(
  fallback: T,
  updater: (current: T) => T
): Promise<T> {
  return updateKv<T>(SHARED_DB_KEY, fallback, updater);
}
