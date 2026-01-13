import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

type Db = { advanceTransfers?: any[] };

const DB_FILENAME = ".hkdb.json";

function dbPath() {
  return path.join(process.cwd(), DB_FILENAME);
}

function safeReadDb(): Db {
  try {
    const p = dbPath();
    if (!fs.existsSync(p)) return {};
    const raw = fs.readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Db;
  } catch {
    return {};
  }
}

function normalizeName(s: string) {
  return String(s || "").trim().toLowerCase();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userName = String(url.searchParams.get("userName") || "").trim();
  if (!userName) return NextResponse.json({ ok: true, items: [] });

  const u = normalizeName(userName);
  const db = safeReadDb();
  const all = Array.isArray(db.advanceTransfers) ? db.advanceTransfers : [];

  const items = all.filter((t: any) => {
    if (t.status !== "accepted") return false;

    const isFrom = normalizeName(t.fromName) === u;
    const isTo = normalizeName(t.toName) === u;
    if (!isFrom && !isTo) return false;

    if (isFrom && t.appliedFrom) return false;
    if (isTo && t.appliedTo) return false;

    return true;
  });

  return NextResponse.json({ ok: true, items });
}
