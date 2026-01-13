import { promises as fs } from "fs";
import path from "path";

export type DbProfile = {
  firstName: string;
  lastName: string;
  title: string;
  bizType: "freelance" | "company";
  companyName?: string;
};

export type DbTeamMember = {
  userId: string;
  displayName: string;
  role: string;
  joinedAt: number;
};

export type DbJoinRequest = {
  id: string;
  teamId: string;
  userId: string;
  displayName: string;
  role: string;
  createdAt: number;
  status: "pending" | "approved" | "rejected";
};

export type DbTeam = {
  id: string;
  ownerUserId: string;
  projectName: string;
  joinCode: string;
  createdAt: number;
  members: DbTeamMember[]; // includes owner
};

export type DbTransfer = {
  id: string;
  teamId: string;
  projectName: string;
  fromUserId: string;
  fromDisplayName: string;
  toUserId: string;
  toDisplayName: string;
  amount: number;
  note?: string;
  createdAt: number;
  status: "pending" | "approved" | "rejected";
  approvedAt?: number;
};

export type DbShape = {
  version: 1;
  profiles: Record<string, DbProfile>;
  teams: DbTeam[];
  joinRequests: DbJoinRequest[];
  transfers: DbTransfer[];
};

const DEFAULT_DB: DbShape = {
  version: 1,
  profiles: {},
  teams: [],
  joinRequests: [],
  transfers: [],
};

function dbPath() {
  // repo root in dev/prod runtime
  return path.join(process.cwd(), ".hkdb.json");
}

async function readDb(): Promise<DbShape> {
  const p = dbPath();
  try {
    const raw = await fs.readFile(p, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_DB };
    return {
      ...DEFAULT_DB,
      ...parsed,
      profiles: parsed.profiles && typeof parsed.profiles === "object" ? parsed.profiles : {},
      teams: Array.isArray(parsed.teams) ? parsed.teams : [],
      joinRequests: Array.isArray(parsed.joinRequests) ? parsed.joinRequests : [],
      transfers: Array.isArray(parsed.transfers) ? parsed.transfers : [],
    } as DbShape;
  } catch {
    return { ...DEFAULT_DB };
  }
}

async function writeDb(next: DbShape) {
  const p = dbPath();
  const tmp = p + ".tmp";
  const data = JSON.stringify(next, null, 2);
  await fs.writeFile(tmp, data, "utf-8");
  await fs.rename(tmp, p);
}

export async function updateDb<T>(mutator: (db: DbShape) => T | Promise<T>): Promise<T> {
  const current = await readDb();
  const result = await mutator(current);
  await writeDb(current);
  return result;
}

export async function getDb(): Promise<DbShape> {
  return readDb();
}

export function makeJoinCode(): string {
  // 8-char readable code
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}
