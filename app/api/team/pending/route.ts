import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

type TeamMember = { id: string; name: string; role: string; status?: "active" | "pending" };
type Team = {
  id: string;
  name: string;
  projectName: string;
  ownerId?: string;
  joinCode?: string;
  members?: TeamMember[];
  pendingMembers?: TeamMember[];
  createdAt?: string;
};

type Db = { teams?: Team[] };

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

    const teamId = String(body?.teamId || "").trim();
    const memberId = String(body?.memberId || "").trim();
    const decision = String(body?.decision || "").trim(); // approve|reject
    const ownerId = String(body?.ownerId || "").trim();

    if (!teamId) return NextResponse.json({ ok: false, error: "teamId zorunlu." }, { status: 400 });
    if (!memberId) return NextResponse.json({ ok: false, error: "memberId zorunlu." }, { status: 400 });
    if (decision !== "approve" && decision !== "reject") {
      return NextResponse.json({ ok: false, error: "decision approve|reject olmalı." }, { status: 400 });
    }

    const db = safeReadDb();
    const teams = Array.isArray(db.teams) ? db.teams : [];
    const t = teams.find((x) => x.id === teamId);
    if (!t) return NextResponse.json({ ok: false, error: "Ekip bulunamadı." }, { status: 404 });

    if (t.ownerId && ownerId && t.ownerId !== ownerId) {
      return NextResponse.json({ ok: false, error: "Bu işlem sadece ekip kurucusuna açık." }, { status: 403 });
    }

    t.members = Array.isArray(t.members) ? t.members : [];
    t.pendingMembers = Array.isArray(t.pendingMembers) ? t.pendingMembers : [];

    const idx = t.pendingMembers.findIndex((m) => m.id === memberId);
    if (idx === -1) return NextResponse.json({ ok: false, error: "Bekleyen üye bulunamadı." }, { status: 404 });

    const mem = t.pendingMembers[idx];
    t.pendingMembers.splice(idx, 1);

    if (decision === "approve") {
      const n = normalizeName(mem.name);
      const exists = t.members.some((m) => normalizeName(m.name) === n);
      if (!exists) t.members.push({ ...mem, status: "active" });
    }

    safeWriteDb(db);
    return NextResponse.json({ ok: true, team: t });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Sunucu hatası." }, { status: 500 });
  }
}
