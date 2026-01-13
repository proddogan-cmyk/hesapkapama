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

type AdvanceTransfer = {
  id: string;
  projectName: string;
  projectId?: string;
  amount: number;
  fromName: string;
  fromRole?: string;
  toName: string;
  toRole?: string;
  approvalBy: string;
  note?: string;
  createdBy: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: number;
  acceptedAt?: number;
  rejectedAt?: number;
  appliedFrom?: boolean;
  appliedTo?: boolean;
};

type Db = {
  teams?: Team[];
  advanceTransfers?: AdvanceTransfer[];
};

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

function uid(prefix = "adv") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function normalizeName(s: string) {
  return String(s || "").trim().toLowerCase();
}

function isMemberOfProject(db: Db, projectName: string, userName: string) {
  const teams = Array.isArray(db.teams) ? db.teams : [];
  const pn = String(projectName || "").trim();
  const un = normalizeName(userName);
  if (!pn || !un) return false;

  for (const t of teams) {
    if (String(t?.projectName || "").trim() !== pn) continue;
    const members = Array.isArray(t.members) ? t.members : [];
    if (members.some((m) => normalizeName(m?.name || "") === un)) return true;
  }
  return false;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userName = String(url.searchParams.get("userName") || "").trim();

  const db = safeReadDb();
  const all = Array.isArray(db.advanceTransfers) ? db.advanceTransfers : [];

  if (!userName) {
    return NextResponse.json({ ok: true, pendingToApprove: [], mine: [] });
  }

  const u = normalizeName(userName);
  const pendingToApprove = all.filter((a) => a.status === "pending" && normalizeName(a.approvalBy) === u);
  const mine = all.filter((a) => normalizeName(a.fromName) === u || normalizeName(a.toName) === u);

  return NextResponse.json({ ok: true, pendingToApprove, mine });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const projectName = String(body?.projectName || "").trim();
    const projectId = String(body?.projectId || "").trim();
    const amount = Number(body?.amount ?? 0);

    const fromName = String(body?.fromName || "").trim();
    const toName = String(body?.toName || "").trim();
    const approvalBy = String(body?.approvalBy || "").trim();

    const createdBy = String(body?.createdBy || "").trim();
    const note = String(body?.note || "").trim();
    const fromRole = String(body?.fromRole || "").trim();
    const toRole = String(body?.toRole || "").trim();

    if (!projectName) return NextResponse.json({ ok: false, error: "projectName zorunlu." }, { status: 400 });
    if (!fromName) return NextResponse.json({ ok: false, error: "fromName zorunlu." }, { status: 400 });
    if (!toName) return NextResponse.json({ ok: false, error: "toName zorunlu." }, { status: 400 });
    if (!approvalBy) return NextResponse.json({ ok: false, error: "approvalBy zorunlu." }, { status: 400 });
    if (!createdBy) return NextResponse.json({ ok: false, error: "createdBy zorunlu." }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ ok: false, error: "amount geçersiz." }, { status: 400 });

    const db = safeReadDb();
    db.advanceTransfers = Array.isArray(db.advanceTransfers) ? db.advanceTransfers : [];

    if (!isMemberOfProject(db, projectName, fromName)) {
      return NextResponse.json({ ok: false, error: "Gönderen bu proje ekibinde değil." }, { status: 403 });
    }
    if (!isMemberOfProject(db, projectName, toName)) {
      return NextResponse.json({ ok: false, error: "Alıcı bu proje ekibinde değil." }, { status: 403 });
    }

    const now = Date.now();
    const dupe = db.advanceTransfers.find((a) =>
      a.status === "pending" &&
      String(a.projectName) === projectName &&
      normalizeName(a.fromName) === normalizeName(fromName) &&
      normalizeName(a.toName) === normalizeName(toName) &&
      Number(a.amount) === amount &&
      Math.abs((a.createdAt || 0) - now) < 10_000
    );
    if (dupe) return NextResponse.json({ ok: true, transfer: dupe });

    const transfer: AdvanceTransfer = {
      id: uid("adv"),
      projectName,
      projectId: projectId || undefined,
      amount,
      fromName,
      fromRole: fromRole || undefined,
      toName,
      toRole: toRole || undefined,
      approvalBy,
      note: note || undefined,
      createdBy,
      status: "pending",
      createdAt: now,
      appliedFrom: false,
      appliedTo: false,
    };

    db.advanceTransfers.push(transfer);
    safeWriteDb(db);

    return NextResponse.json({ ok: true, transfer });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Sunucu hatası." }, { status: 500 });
  }
}
