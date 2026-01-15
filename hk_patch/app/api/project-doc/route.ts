import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

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
};

type DocFile = {
  id: string;
  originalName: string;
  storedName: string;
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

const DB_FILENAME = ".hkdb.json";
const FILES_DIRNAME = ".hkfiles";

function dbPath() {
  return path.join(process.cwd(), DB_FILENAME);
}

function filesDir() {
  return path.join(process.cwd(), FILES_DIRNAME);
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

function uid(prefix = "id") {
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

function canUpload(role: string) {
  const r = String(role || "").trim().toLowerCase();
  if (!r) return false;
  if (r === "yapımcı".toLowerCase()) return true;
  if (r === "yapım amiri".toLowerCase()) return true;
  if (r.startsWith("reji")) return true;
  if (r.includes("devamlılık")) return true;
  return false;
}

function sanitizeFilename(name: string) {
  const base = String(name || "file").replace(/[/\\?%*:|"<>]/g, "_");
  return base.slice(0, 120);
}

function ensureProjectBucket(db: Db, projectName: string) {
  db.projectDocs = db.projectDocs && typeof db.projectDocs === "object" ? db.projectDocs : {};
  db.projectDocs[projectName] = db.projectDocs[projectName] || { calendar: [], scenario: [] };
  if (!Array.isArray(db.projectDocs[projectName].calendar)) db.projectDocs[projectName].calendar = [];
  if (!Array.isArray(db.projectDocs[projectName].scenario)) db.projectDocs[projectName].scenario = [];
  return db.projectDocs[projectName];
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const projectName = String(url.searchParams.get("projectName") || "").trim();
  const userName = String(url.searchParams.get("userName") || "").trim();

  if (!projectName) {
    return NextResponse.json({ ok: false, error: "projectName zorunlu." }, { status: 400 });
  }
  if (!userName) {
    return NextResponse.json({ ok: false, error: "userName zorunlu." }, { status: 400 });
  }

  const db = safeReadDb();
  if (!isMemberOfProject(db, projectName, userName)) {
    return NextResponse.json({ ok: false, error: "Bu proje için erişim yok (ekip üyesi değilsin)." }, { status: 403 });
  }

  const bucket = (db.projectDocs && db.projectDocs[projectName]) || { calendar: [], scenario: [] };
  return NextResponse.json({ ok: true, projectName, files: bucket });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const projectName = String(form.get("projectName") || "").trim();
    const docTypeRaw = String(form.get("docType") || "").trim();
    const userName = String(form.get("userName") || "").trim();
    const userRole = String(form.get("userRole") || "").trim();
    const file = form.get("file") as File | null;

    const docType = (docTypeRaw === "calendar" ? "calendar" : docTypeRaw === "scenario" ? "scenario" : null) as
      | "calendar"
      | "scenario"
      | null;

    if (!projectName) return NextResponse.json({ ok: false, error: "projectName zorunlu." }, { status: 400 });
    if (!docType) return NextResponse.json({ ok: false, error: "docType zorunlu." }, { status: 400 });
    if (!userName) return NextResponse.json({ ok: false, error: "userName zorunlu." }, { status: 400 });
    if (!userRole) return NextResponse.json({ ok: false, error: "userRole zorunlu." }, { status: 400 });
    if (!file) return NextResponse.json({ ok: false, error: "Dosya zorunlu." }, { status: 400 });

    if (!canUpload(userRole)) {
      return NextResponse.json({ ok: false, error: "Bu dosyayı yükleme yetkin yok." }, { status: 403 });
    }

    const db = safeReadDb();
    if (!isMemberOfProject(db, projectName, userName)) {
      return NextResponse.json({ ok: false, error: "Bu projeye dosya yüklemek için ekip üyesi olmalısın." }, { status: 403 });
    }

    // validate extensions
    const originalName = sanitizeFilename(file.name || "dosya");
    const ext = originalName.toLowerCase().split(".").pop() || "";
    const okCalendar = ["xlsx", "xls", "csv"].includes(ext);
    const okScenario = ["doc", "docx"].includes(ext);

    if (docType === "calendar" && !okCalendar) {
      return NextResponse.json({ ok: false, error: "Takvim için sadece Excel/CSV (.xlsx, .xls, .csv) yüklenebilir." }, { status: 400 });
    }
    if (docType === "scenario" && !okScenario) {
      return NextResponse.json({ ok: false, error: "Senaryo için sadece Word (.doc, .docx) yüklenebilir." }, { status: 400 });
    }

    // write file to disk
    const dir = filesDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const id = uid("doc");
    const storedName = `${id}_${originalName}`;
    const dest = path.join(dir, storedName);

    const buf = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(dest, buf);

    const meta: DocFile = {
      id,
      originalName,
      storedName,
      docType,
      mime: file.type || "application/octet-stream",
      size: buf.length,
      uploadedByName: userName,
      uploadedByRole: userRole,
      createdAt: new Date().toISOString(),
    };

    const bucket = ensureProjectBucket(db, projectName);
    bucket[docType].unshift(meta);

    safeWriteDb(db);

    return NextResponse.json({ ok: true, file: meta });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Sunucu hatası." }, { status: 500 });
  }
}
