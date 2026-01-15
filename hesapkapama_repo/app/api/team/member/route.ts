import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const teamId = String(body.teamId || "").trim();
    const name = String(body.name || "").trim();
    const role = String(body.role || "Yapım Asistanı").trim() || "Yapım Asistanı";
    const phone = String(body.phone || "").trim();

    if (!teamId) return NextResponse.json({ ok: false, error: "teamId zorunlu." }, { status: 400 });
    if (!name) return NextResponse.json({ ok: false, error: "Üye adı zorunlu." }, { status: 400 });

    const db = safeReadDb();
    const team = db.teams.find((t) => t.id === teamId);
    if (!team) return NextResponse.json({ ok: false, error: "Ekip bulunamadı." }, { status: 404 });

    team.members = Array.isArray(team.members) ? team.members : [];
    const already = team.members.some((m) => String(m.name).toLowerCase() === name.toLowerCase());
    if (already) return NextResponse.json({ ok: true, team, message: "Zaten var." });

    const mem: TeamMember = { id: uid("mem"), name, role, phone: phone || undefined, status: "active" };
    team.members.push(mem);

    safeWriteDb(db);

    return NextResponse.json({ ok: true, team, member: mem });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Sunucu hatası." }, { status: 500 });
  }
}
