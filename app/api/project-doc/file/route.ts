import fs from "fs";
import path from "path";
import { readSharedDb } from "@/lib/server/sharedDb";

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
  const id = String(url.searchParams.get("id") || "").trim();
  const userName = String(url.searchParams.get("userName") || "").trim();

  if (!id) return new Response("id zorunlu", { status: 400 });
  if (!userName) return new Response("userName zorunlu", { status: 400 });

  const db = await safeReadDb();
  const projectDocs = db.projectDocs || {};
  let found: { projectName: string; file: DocFile } | null = null;

  for (const [projectName, bucket] of Object.entries(projectDocs)) {
    const cal = Array.isArray(bucket?.calendar) ? bucket.calendar : [];
    const scn = Array.isArray(bucket?.scenario) ? bucket.scenario : [];
    const all = [...cal, ...scn];
    const f = all.find((x) => String(x?.id || "") === id);
    if (f) {
      found = { projectName, file: f as DocFile };
      break;
    }
  }

  if (!found) return new Response("Dosya bulunamadÄ±", { status: 404 });

  if (!isMemberOfProject(db, found.projectName, userName)) {
    return new Response("EriÅŸim yok (proje Ã¼yesi deÄŸilsin)", { status: 403 });
  }

  if (found.file.url) {
    return Response.redirect(found.file.url, 302);
  }

  const fullPath = path.join(filesDir(), found.file.storedName);
  if (!fs.existsSync(fullPath)) return new Response("Dosya depoda yok", { status: 404 });

  const data = fs.readFileSync(fullPath);
  return new Response(data, {
    status: 200,
    headers: {
      "content-type": found.file.mime || "application/octet-stream",
      "content-disposition": `attachment; filename="${encodeURIComponent(found.file.originalName)}"`,
      "content-length": String(data.length),
      "cache-control": "no-store",
    },
  });
}

