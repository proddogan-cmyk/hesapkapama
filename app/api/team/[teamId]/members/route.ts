import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { updateDb } from "@/lib/server/fileDb";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ teamId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { teamId } = await ctx.params;
  const body = (await req.json()) as { action?: "remove"; memberUserId?: string };
  const action = body?.action;

  if (action !== "remove") return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const memberUserId = String(body?.memberUserId || "").trim();
  if (!memberUserId) return NextResponse.json({ error: "missing_memberUserId" }, { status: 400 });

  await updateDb((db) => {
    const team = db.teams.find((t) => t.id === teamId);
    if (!team) throw new Error("team_not_found");
    if (team.ownerUserId !== userId) throw new Error("forbidden");
    if (memberUserId === team.ownerUserId) throw new Error("cannot_remove_owner");

    team.members = team.members.filter((m) => m.userId !== memberUserId);

    // cleanup pending requests for that user/team
    for (const r of db.joinRequests) {
      if (r.teamId === teamId && r.userId === memberUserId && r.status === "pending") {
        r.status = "rejected";
      }
    }
  });

  return NextResponse.json({ ok: true });
}
