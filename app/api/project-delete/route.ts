import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { readSharedDb, writeSharedDb } from "@/lib/server/sharedDb";
import { del } from "@vercel/blob";

export const runtime = "nodejs";

type TeamMember = { id: string; name: string; role: string; status?: "active" | "pending" };
type Team = {
  id: string;
  name: string;
  projectName: string;
  joinCode: string;
  members?: TeamMember[];
  pendingMembers?: TeamMember[];
  createdAt: string;
  ownerId?: string;
};

type DocFile = {
  id: string;
  originalName: string;
  storedName: string;
  url?: string;
  docType: "calendar" | "scenario";
  mime: string;
  size: number;
  uploadedByName: string;
  uploadedByRole: string;
  createdAt: string;
};

type Db = {
  teams?: Team[];
  projectDocs?: Record<string, { calendar: DocFile[]; scenario: DocFile[] }>;
};

const FILES_DIRNAME = ".hkfiles";

function filesDir() {
  return path.join(process.cwd(), FILES_DIRNAME);
}

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

function canManage(role: string) {
  const r = String(role || "").trim().toLowerCase();
  if (!r) return false;
  if (r === "yapımcı".toLowerCase()) return true;
  if (r === "yapım amiri".toLowerCase()) return true;
  if (r.startsWith("reji")) return true;
  if (r.includes("devamlılık")) return true;
  return false;
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const projectName = String(body.projectName || "").trim();
    const userName = String(body.userName || "").trim();
    const userRole = String(body.userRole || "").trim();

    if (!projectName) return NextResponse.json({ ok: false, error: "projectName zorunlu." }, { status: 400 });
    if (!userName) return NextResponse.json({ ok: false, error: "userName zorunlu." }, { status: 400 });
    if (!userRole) return NextResponse.json({ ok: false, error: "userRole zorunlu." }, { status: 400 });

    if (!canManage(userRole)) {
      return NextResponse.json({ ok: false, error: "Silme yetkisi sadece Reji / Yapımcı / Yapım Amiri." }, { status: 403 });
    }

    const db = await safeReadDb();

    const teams = Array.isArray(db.teams) ? db.teams : [];
    const hasProjectInDb =
      teams.some((t) => String(t?.projectName || "").trim() === projectName) ||
      !!(db.projectDocs && db.projectDocs[projectName]);

    // If project exists in server db, require membership to prevent accidental deletes across projects
    if (hasProjectInDb && !isMemberOfProject(db, projectName, userName)) {
      return NextResponse.json({ ok: false, error: "Bu proje için silme yetkin yok (ekip üyesi değilsin)." }, { status: 403 });
    }

    // Delete docs + physical files
    const bucket = db.projectDocs && db.projectDocs[projectName];
    if (bucket) {
      const all: DocFile[] = [
        ...(Array.isArray(bucket.calendar) ? bucket.calendar : []),
        ...(Array.isArray(bucket.scenario) ? bucket.scenario : []),
      ];

      const dir = filesDir();
      for (const f of all) {
        if (f?.url) {
          try {
            await del(f.url);
          } catch {
            // ignore
          }
        }
      }

      for (const f of all) {
        const stored = String(f?.storedName || "").trim();
        if (!stored) continue;
        const full = path.join(dir, stored);
        try {
          if (fs.existsSync(full)) fs.unlinkSync(full);
        } catch {
          // ignore
        }
      }

      try {
        delete db.projectDocs![projectName];
      } catch {
        // ignore
      }
    }

    // Delete teams for this project
    if (Array.isArray(db.teams)) {
      db.teams = db.teams.filter((t) => String(t?.projectName || "").trim() !== projectName);
    }

    await safeWriteDb(db);

    return NextResponse.json({ ok: true, projectName });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Sunucu hatası." }, { status: 500 });
  }
}
