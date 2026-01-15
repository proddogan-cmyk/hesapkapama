import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { applyCreditLedger } from "@/lib/server/fileDb";

/**
 * DEV/ADMIN endpoint:
 * Set ADMIN_CREDITS_TOKEN in .env.local to protect.
 *
 * If Clerk isn't configured, you can still use this endpoint in local mode by sending:
 * { localUserId: "local_...", amount: 1000, token: "..."}
 */
export const runtime = "nodejs";

type Body = { amount: number; token?: string; localUserId?: string };

export async function POST(req: Request) {
  const { userId: clerkUserId } = auth();

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const localUserId = String(body.localUserId || "").trim();
  const userId = clerkUserId || (localUserId.startsWith("local_") ? localUserId : "");
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const token = String(body.token || "");
  const expected = String(process.env.ADMIN_CREDITS_TOKEN || "");
  if (!expected || token !== expected) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const amount = Math.max(0, Math.floor(Number(body.amount || 0)));
  if (!amount) return NextResponse.json({ error: "amount_required" }, { status: 400 });

  await applyCreditLedger({
    userId,
    type: "ADMIN_ADJUST",
    amount,
    referenceType: "admin",
    referenceId: "manual_topup",
    idempotencyKey: `admin_topup_${userId}_${Date.now()}`,
  });

  return NextResponse.json({ ok: true });
}
