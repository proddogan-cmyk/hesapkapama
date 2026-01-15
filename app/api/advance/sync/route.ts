import { NextRequest, NextResponse } from "next/server";
import { readSharedDb } from "@/lib/server/sharedDb";

export const runtime = "nodejs";

type Db = { advanceTransfers?: any[] };

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

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userName = String(url.searchParams.get("userName") || "").trim();
  if (!userName) return NextResponse.json({ ok: true, items: [] });

  const u = normalizeName(userName);
  const db = await safeReadDb();
  const all = Array.isArray(db.advanceTransfers) ? db.advanceTransfers : [];

  const items = all.filter((t: any) => {
    if (t.status !== "accepted") return false;

    const isFrom = normalizeName(t.fromName) === u;
    const isTo = normalizeName(t.toName) === u;
    if (!isFrom && !isTo) return false;

    if (isFrom && t.appliedFrom) return false;
    if (isTo && t.appliedTo) return false;

    return true;
  });

  return NextResponse.json({ ok: true, items });
}
