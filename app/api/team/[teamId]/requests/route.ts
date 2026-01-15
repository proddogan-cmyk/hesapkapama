import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

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

const DB_FILENAME = ".hkdb.json";

function dbPath() {
  return path.join(process.cwd(), DB_FILENAME);
}

function safeReadDb(): Db {
  try {
    const p = dbPath();
    if (!fs.existsSync(p)) return { teams: [] };
    const raw = fs.readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { teams: [] };
    if (!Array.isArray(parsed.teams)) return { teams: [] };
    return { teams: parsed.teams as Team[] };
  } catch {
    return { teams: [] };
  }
}

function safeWriteDb(db: Db) {
  const p = dbPath();
  fs.writeFileSync(p, JSON.stringify(db, null, 2), "utf-8");
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

export async function GET(req: NextRequest, context: { params: Promise<{ teamId: string; }> }) {
  const { teamId } = await context.params;
  const db = safeReadDb();
  return NextResponse.json({ ok: true, teams: db.teams });
}

export async function POST(req: NextRequest, context: { params: Promise<{ teamId: string; }> }) {
  const { teamId } = await context.params;
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

    const db = safeReadDb();
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
    safeWriteDb(db);

    return NextResponse.json({ ok: true, team, teams: db.teams });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Sunucu hatası." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ teamId: string; }> }) {
  const { teamId } = await context.params;
  try {
    const body = await req.json().catch(() => ({} as any));
    const resolvedTeamId = String(teamId || body.teamId || "").trim();
    const ownerId = String(body.ownerId || "").trim();

    if (!resolvedTeamId) return NextResponse.json({ ok: false, error: "teamId zorunlu." }, { status: 400 });

    const db = safeReadDb();
    const idx = db.teams.findIndex((t) => t.id === resolvedTeamId);
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
    safeWriteDb(db);

    return NextResponse.json({ ok: true, teams: db.teams });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Sunucu hatası." }, { status: 500 });
  }
}
