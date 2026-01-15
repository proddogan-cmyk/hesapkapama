import { NextRequest, NextResponse } from "next/server";
import { readSharedDb, writeSharedDb } from "@/lib/server/sharedDb";

type TeamMember = {
  id: string;
  name: string;
  role: string;
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

function makeJoinCode(existing: Set<string>) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < 1000; i++) {
    let code = "HK-";
    for (let j = 0; j < 6; j++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (!existing.has(code)) return code;
  }
  return "HK-" + uid("CODE").slice(-6).toUpperCase();
}

export async function GET(_req: NextRequest) {
  const db = await safeReadDb();
  return NextResponse.json({ ok: true, teams: db.teams });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const name = String(body.name || body.teamName || "").trim();
    const projectName = String(body.projectName || "").trim();
    const ownerId = String(body.ownerId || "").trim();

    if (!name || !projectName) {
      return NextResponse.json({ ok: false, error: "Ekip adı ve proje adı zorunlu." }, { status: 400 });
    }
    if (!ownerId) {
      return NextResponse.json({ ok: false, error: "ownerId zorunlu." }, { status: 400 });
    }

    const db = await safeReadDb();
    const existingCodes = new Set(db.teams.map((t) => t.joinCode));
    const team: Team = {
      id: uid("team"),
      name,
      projectName,
      ownerId,
      joinCode: makeJoinCode(existingCodes),
      members: [],
      pendingMembers: [],
      createdAt: new Date().toISOString(),
    };

    db.teams.unshift(team);
    await safeWriteDb(db);

    return NextResponse.json({ ok: true, team, teams: db.teams });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Sunucu hatası." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const teamId = String(body.teamId || "").trim();
    const ownerId = String(body.ownerId || "").trim();

    if (!teamId) return NextResponse.json({ ok: false, error: "teamId zorunlu." }, { status: 400 });

    const db = await safeReadDb();
    const idx = db.teams.findIndex((t) => t.id === teamId);
    if (idx === -1) return NextResponse.json({ ok: false, error: "Ekip bulunamadı." }, { status: 404 });

    const team = db.teams[idx];
    const hasOwner = Boolean(team.ownerId);
    if (hasOwner && !ownerId) {
      return NextResponse.json({ ok: false, error: "ownerId zorunlu." }, { status: 400 });
    }
    if (hasOwner && team.ownerId !== ownerId) {
      return NextResponse.json({ ok: false, error: "Bu ekibi silme yetkin yok." }, { status: 403 });
    }

    db.teams.splice(idx, 1);
    await safeWriteDb(db);

    return NextResponse.json({ ok: true, teams: db.teams });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Sunucu hatası." }, { status: 500 });
  }
}
