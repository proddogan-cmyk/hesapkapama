import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { putUserState } from "@/lib/server/fileDb";

export const runtime = "nodejs";

type Body = {
  profile?: any;
  projects?: any[];
  selectedProjectId?: string;
  transactions?: any[];
  nameTags?: string[];
};

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const projects = Array.isArray(body.projects) ? body.projects : [];
  const transactions = Array.isArray(body.transactions) ? body.transactions : [];
  const nameTags = Array.isArray(body.nameTags) ? body.nameTags : [];

  await putUserState(userId, {
    profile: body.profile,
    projects,
    selectedProjectId: body.selectedProjectId,
    transactions,
    nameTags,
  });

  return NextResponse.json({ ok: true });
}
