import { NextRequest, NextResponse } from "next/server";
import { readSharedDb, writeSharedDb } from "@/lib/server/sharedDb";

export const runtime = "nodejs";

type TeamMember = { id: string; name: string; role: string; phone?: string; status?: "active" | "pending" };
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

    const teamId = String(body?.teamId || "").trim();
    const memberId = String(body?.memberId || "").trim();
    const decision = String(body?.decision || "").trim(); // approve|reject
    const ownerId = String(body?.ownerId || "").trim();

    if (!teamId) return NextResponse.json({ ok: false, error: "teamId zorunlu." }, { status: 400 });
    if (!memberId) return NextResponse.json({ ok: false, error: "memberId zorunlu." }, { status: 400 });
    if (decision !== "approve" && decision !== "reject") {
      return NextResponse.json({ ok: false, error: "decision approve|reject olmalı." }, { status: 400 });
    }

    const db = await safeReadDb();
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

    await safeWriteDb(db);
    return NextResponse.json({ ok: true, team: t });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Sunucu hatası." }, { status: 500 });
  }
}
