import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserState } from "@/lib/server/fileDb";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const state = await getUserState(userId);
  return NextResponse.json({ ok: true, state });
}
