import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { consumeCreditsOrThrow } from "@/lib/server/fileDb";

export const runtime = "nodejs";

type Body = {
  kind: "receipt" | "export";
  amount: number;
  referenceId?: string;
  idempotencyKey?: string;
  localUserId?: string;
};

export async function POST(req: Request) {
  const { userId: clerkUserId } = auth();

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const localUserId = String(body.localUserId || "").trim();
  const userId = clerkUserId || (localUserId.startsWith("local_") ? localUserId : "");
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const kind = body.kind === "export" ? "export" : "receipt";
  const amount = Math.max(0, Math.floor(Number(body.amount || 0)));
  const idempotencyKey = String(body.idempotencyKey || "").trim();
  if (!idempotencyKey) return NextResponse.json({ error: "idempotency_required" }, { status: 400 });

  try {
    await consumeCreditsOrThrow({
      userId,
      kind,
      amount,
      referenceId: body.referenceId ? String(body.referenceId) : undefined,
      idempotencyKey,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "insufficient_credits") {
      return NextResponse.json(
        { ok: false, error: "insufficient_credits", balance: e.balance, required: e.required },
        { status: 402 }
      );
    }
    return NextResponse.json({ ok: false, error: "consume_failed" }, { status: 500 });
  }
}
