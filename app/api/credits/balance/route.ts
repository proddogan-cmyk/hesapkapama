import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCreditBalance } from "@/lib/server/fileDb";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { userId: clerkUserId } = auth();
  const localUserId = String(req.headers.get("x-local-user-id") || "").trim();
  const userId = clerkUserId || (localUserId.startsWith("local_") ? localUserId : "");
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const balance = await getCreditBalance(userId);
  return NextResponse.json({ ok: true, balance });
}
