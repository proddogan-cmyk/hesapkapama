import { NextRequest, NextResponse } from "next/server";
import { readSharedDb, writeSharedDb } from "@/lib/server/sharedDb";

export const runtime = "nodejs";

type Db = { advanceTransfers?: any[] };

async function safeReadDb(): Promise<Db> {
  try {
    const parsed = await readSharedDb<any>({});
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Db;
  } catch {
    return {};
  }
}

async function safeWriteDb(db: Db) {
  await writeSharedDb(db);
}

function normalizeName(s: string) {
  return String(s || "").trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const userName = String(body?.userName || "").trim();
    const ids = Array.isArray(body?.ids) ? body.ids.map((x: any) => String(x || "").trim()).filter(Boolean) : [];

    if (!userName) return NextResponse.json({ ok: false, error: "userName zorunlu." }, { status: 400 });
    if (!ids.length) return NextResponse.json({ ok: true });

    const u = normalizeName(userName);
    const db = await safeReadDb();
    db.advanceTransfers = Array.isArray(db.advanceTransfers) ? db.advanceTransfers : [];

    for (const id of ids) {
      const t: any = (db.advanceTransfers as any[]).find((x) => x.id === id);
      if (!t) continue;
      if (t.status !== "accepted") continue;

      if (normalizeName(t.fromName) === u) t.appliedFrom = true;
      if (normalizeName(t.toName) === u) t.appliedTo = true;
    }

    await safeWriteDb(db);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Sunucu hatası." }, { status: 500 });
  }
}
