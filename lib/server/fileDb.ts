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
  phone?: string;
};

export type DbTeam = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: number;
  members: DbTeamMember[];
  joinRequests: { id: string; fromUserId: string; fromName: string; message?: string; createdAt: number }[];
  transfers: any[];
};

export type DbAdvanceItem = {
  id: string;
  userName: string;
  projectName: string;
  fromName: string;
  amount: number;
  createdAt: number;
  status: "new" | "applied";
};

export type DbState = {
  /** mirrors client AppState shape (plus timestamps) */
  profile?: any;
  projects: any[];
  selectedProjectId?: string;
  transactions: any[];
  nameTags: string[];
  updatedAt: number;
};

export type CreditLedgerEntry = {
  id: string;
  userId: string;
  type: "PURCHASE" | "CONSUME_RECEIPT" | "CONSUME_EXPORT" | "REFUND" | "ADMIN_ADJUST";
  amount: number; // + or -
  referenceType?: "receipt" | "export" | "payment" | "admin";
  referenceId?: string;
  idempotencyKey?: string;
  createdAt: number;
};

export type DbShape = {
  profiles: Record<string, DbProfile>;
  teams: Record<string, DbTeam>;
  advances: DbAdvanceItem[];
  states: Record<string, DbState>;
  creditBalances: Record<string, number>;
  creditLedger: CreditLedgerEntry[];
  processedIdempotency: Record<string, boolean>;
};

const DEFAULT_DB: DbShape = {
  profiles: {},
  teams: {},
  advances: [],
  states: {},
  creditBalances: {},
  creditLedger: [],
  processedIdempotency: {},
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

    // Soft-migrate old shapes by layering defaults
    return {
      ...DEFAULT_DB,
      ...parsed,
      profiles: { ...DEFAULT_DB.profiles, ...(parsed.profiles || {}) },
      teams: { ...DEFAULT_DB.teams, ...(parsed.teams || {}) },
      advances: Array.isArray(parsed.advances) ? parsed.advances : [],
      states: { ...DEFAULT_DB.states, ...(parsed.states || {}) },
      creditBalances: { ...DEFAULT_DB.creditBalances, ...(parsed.creditBalances || {}) },
      creditLedger: Array.isArray(parsed.creditLedger) ? parsed.creditLedger : [],
      processedIdempotency: { ...DEFAULT_DB.processedIdempotency, ...(parsed.processedIdempotency || {}) },
    };
  } catch {
    return { ...DEFAULT_DB };
  }
}

async function writeDb(next: DbShape) {
  const p = dbPath();
  await fs.writeFile(p, JSON.stringify(next, null, 2), "utf-8");
}

export async function getDb() {
  return readDb();
}

export async function updateDb(mutator: (db: DbShape) => void) {
  const db = await readDb();
  mutator(db);
  await writeDb(db);
  return db;
}

export async function getUserState(userId: string): Promise<DbState | null> {
  const db = await readDb();
  return db.states[userId] || null;
}

export async function putUserState(userId: string, state: Omit<DbState, "updatedAt">) {
  return updateDb((db) => {
    db.states[userId] = { ...state, updatedAt: Date.now() };
  });
}

function safeId() {
  return `${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
}

export async function getCreditBalance(userId: string): Promise<number> {
  const db = await readDb();
  const v = db.creditBalances[userId];
  return Number.isFinite(v) ? Number(v) : 0;
}

export async function applyCreditLedger(entry: Omit<CreditLedgerEntry, "id" | "createdAt">) {
  const id = safeId();
  const createdAt = Date.now();

  return updateDb((db) => {
    const idem = entry.idempotencyKey ? String(entry.idempotencyKey) : "";
    if (idem) {
      if (db.processedIdempotency[idem]) return; // already processed
      db.processedIdempotency[idem] = true;
    }

    const prev = Number.isFinite(db.creditBalances[entry.userId]) ? Number(db.creditBalances[entry.userId]) : 0;
    const next = prev + Number(entry.amount || 0);

    db.creditBalances[entry.userId] = next;
    db.creditLedger.push({ ...entry, id, createdAt });
  });
}

export async function consumeCreditsOrThrow(opts: {
  userId: string;
  kind: "receipt" | "export";
  amount: number; // positive number to consume
  referenceId?: string;
  idempotencyKey: string;
}) {
  const amt = Math.max(0, Math.floor(Number(opts.amount || 0)));
  if (!amt) return;

  // check balance first
  const bal = await getCreditBalance(opts.userId);
  if (bal < amt) {
    const err: any = new Error("insufficient_credits");
    err.code = "insufficient_credits";
    err.balance = bal;
    err.required = amt;
    throw err;
  }

  await applyCreditLedger({
    userId: opts.userId,
    type: opts.kind === "receipt" ? "CONSUME_RECEIPT" : "CONSUME_EXPORT",
    amount: -amt,
    referenceType: opts.kind,
    referenceId: opts.referenceId,
    idempotencyKey: opts.idempotencyKey,
  });
}

export async function refundCredits(opts: {
  userId: string;
  kind: "receipt" | "export";
  amount: number;
  referenceId?: string;
  idempotencyKey: string;
}) {
  const amt = Math.max(0, Math.floor(Number(opts.amount || 0)));
  if (!amt) return;

  await applyCreditLedger({
    userId: opts.userId,
    type: "REFUND",
    amount: +amt,
    referenceType: opts.kind,
    referenceId: opts.referenceId,
    idempotencyKey: opts.idempotencyKey,
  });
}
