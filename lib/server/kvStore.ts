"use server";

import { Pool, type PoolClient } from "@neondatabase/serverless";

const KV_TABLE = "hk_kv_store";

let pool: Pool | null = null;

function getPool() {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is missing.");
  }
  pool = new Pool({ connectionString: url });
  return pool;
}

async function ensureTable(client: PoolClient) {
  await client.query(
    `CREATE TABLE IF NOT EXISTS ${KV_TABLE} (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`
  );
}

export async function getKv<T>(key: string, fallback: T): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTable(client);
    const res = await client.query(`SELECT value FROM ${KV_TABLE} WHERE key = $1`, [key]);
    if (!res.rowCount) return fallback;
    return (res.rows[0]?.value ?? fallback) as T;
  } finally {
    client.release();
  }
}

export async function setKv<T>(key: string, value: T): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTable(client);
    await client.query(
      `INSERT INTO ${KV_TABLE} (key, value, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, value]
    );
  } finally {
    client.release();
  }
}

export async function updateKv<T>(
  key: string,
  fallback: T,
  updater: (current: T) => T
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureTable(client);

    const res = await client.query(
      `SELECT value FROM ${KV_TABLE} WHERE key = $1 FOR UPDATE`,
      [key]
    );
    const current = (res.rowCount ? res.rows[0]?.value : fallback) as T;
    const next = updater(current);

    await client.query(
      `INSERT INTO ${KV_TABLE} (key, value, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, next]
    );
    await client.query("COMMIT");
    return next;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw e;
  } finally {
    client.release();
  }
}
