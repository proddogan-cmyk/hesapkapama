import { NextRequest, NextResponse } from "next/server";
import { readSharedDb, writeSharedDb } from "@/lib/server/sharedDb";

type TeamMember = {
  id: string;
  name: string;
  role: string;
  phone?: string;
  status?: "active" | "pending";
};

type Team = {
  id: string;
  name: string;
  projectName: string;
  ownerId: string;
  joinCode: string;
  members: TeamMember[];
  pendingMembers: TeamMember[];
  createdAt: string;
};

type Db = {
  teams: Team[];
};

async function safeReadDb(): Promise<Db> {
  try {
    const parsed = await readSharedDb<any>({ teams: [] });
    if (!parsed || typeof parsed !== "object") return { teams: [] };
    if (!Array.isArray(parsed.teams)) return { teams: [] };
    return { teams: parsed.teams as Team[] };
  } catch {
    return { teams: [] };
  }
}

async function safeWriteDb(db: Db) {
  await writeSharedDb(db);
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const teamId = String(body.teamId || "").trim();
    const name = String(body.name || "").trim();
    const role = String(body.role || "Yapım Asistanı").trim() || "Yapım Asistanı";
    const phone = String(body.phone || "").trim();

    if (!teamId) return NextResponse.json({ ok: false, error: "teamId zorunlu." }, { status: 400 });
    if (!name) return NextResponse.json({ ok: false, error: "Üye adı zorunlu." }, { status: 400 });

    const db = await safeReadDb();
    const team = db.teams.find((t) => t.id === teamId);
    if (!team) return NextResponse.json({ ok: false, error: "Ekip bulunamadı." }, { status: 404 });

    team.members = Array.isArray(team.members) ? team.members : [];
    const already = team.members.some((m) => String(m.name).toLowerCase() === name.toLowerCase());
    if (already) return NextResponse.json({ ok: true, team, message: "Zaten var." });

    const mem: TeamMember = { id: uid("mem"), name, role, phone: phone || undefined, status: "active" };
    team.members.push(mem);

    await safeWriteDb(db);

    return NextResponse.json({ ok: true, team, member: mem });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Sunucu hatası." }, { status: 500 });
  }
}
