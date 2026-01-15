import { NextRequest, NextResponse } from "next/server";
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const id = String(body?.id || "").trim();
    const userName = String(body?.userName || "").trim();
    const decision = String(body?.decision || "").trim(); // accept|reject

    if (!id) return NextResponse.json({ ok: false, error: "id zorunlu." }, { status: 400 });
    if (!userName) return NextResponse.json({ ok: false, error: "userName zorunlu." }, { status: 400 });
    if (decision !== "accept" && decision !== "reject") {
      return NextResponse.json({ ok: false, error: "decision accept|reject olmalı." }, { status: 400 });
    }

    const db = safeReadDb();
    db.advanceTransfers = Array.isArray(db.advanceTransfers) ? db.advanceTransfers : [];

    const t: any = (db.advanceTransfers as any[]).find((x) => x.id === id);
    if (!t) return NextResponse.json({ ok: false, error: "Kayıt bulunamadı." }, { status: 404 });

    if (t.status !== "pending") return NextResponse.json({ ok: true, transfer: t });

    if (normalizeName(t.approvalBy) !== normalizeName(userName)) {
      return NextResponse.json({ ok: false, error: "Bu avansı onaylama yetkin yok." }, { status: 403 });
    }

    const now = Date.now();
    if (decision === "accept") {
      t.status = "accepted";
      t.acceptedAt = now;
      t.appliedFrom = false;
      t.appliedTo = false;
    } else {
      t.status = "rejected";
      t.rejectedAt = now;
    }

    safeWriteDb(db);
    return NextResponse.json({ ok: true, transfer: t });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Sunucu hatası." }, { status: 500 });
  }
}
