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

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function normalizeName(s: string) {
  return String(s || "").trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    const joinCode = String(body?.joinCode || "").trim();
    const name = String(body?.name || "").trim();
    const phone = String(body?.phone || "").trim();
    const role = String(body?.role || "Yapım Asistanı").trim();

    if (!joinCode) return NextResponse.json({ ok: false, error: "Ekip kodu zorunlu." }, { status: 400 });
    if (!name) return NextResponse.json({ ok: false, error: "Üye adı zorunlu (Hesabım sayfasından ad/soyad kaydet)." }, { status: 400 });

    const db = await safeReadDb();
    const teams = Array.isArray(db.teams) ? db.teams : [];
    const t = teams.find((x) => String(x.joinCode || "").trim() === joinCode);

    if (!t) return NextResponse.json({ ok: false, error: "Ekip bulunamadı. Kod yanlış olabilir." }, { status: 404 });

    t.members = Array.isArray(t.members) ? t.members : [];
    t.pendingMembers = Array.isArray(t.pendingMembers) ? t.pendingMembers : [];

    const n = normalizeName(name);
    const already =
      t.members.some((m) => normalizeName(m.name) === n) ||
      t.pendingMembers.some((m) => normalizeName(m.name) === n);

    if (already) return NextResponse.json({ ok: true, team: t });

    t.pendingMembers.push({ id: uid("mem"), name, role, phone: phone || undefined, status: "pending" });

    await safeWriteDb(db);
    return NextResponse.json({ ok: true, team: t });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Sunucu hatası." }, { status: 500 });
  }
}
