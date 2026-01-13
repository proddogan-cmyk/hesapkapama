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

function safeWriteDb(db: Db) {
  const p = dbPath();
  fs.writeFileSync(p, JSON.stringify(db, null, 2), "utf-8");
}

function normalizeName(s: string) {
  return String(s || "").trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const userName = String(body?.userName || "").trim();
    const ids = Array.isArray(body?.ids) ? body.ids.map((x: any) => String(x || "").trim()).filter(Boolean) : [];

    if (!userName) return NextResponse.json({ ok: false, error: "userName zorunlu." }, { status: 400 });
    if (!ids.length) return NextResponse.json({ ok: true });

    const u = normalizeName(userName);
    const db = safeReadDb();
    db.advanceTransfers = Array.isArray(db.advanceTransfers) ? db.advanceTransfers : [];

    for (const id of ids) {
      const t: any = (db.advanceTransfers as any[]).find((x) => x.id === id);
      if (!t) continue;
      if (t.status !== "accepted") continue;

      if (normalizeName(t.fromName) === u) t.appliedFrom = true;
      if (normalizeName(t.toName) === u) t.appliedTo = true;
    }

    safeWriteDb(db);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Sunucu hatası." }, { status: 500 });
  }
}
