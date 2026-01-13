import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { updateDb } from "@/lib/server/fileDb";

export async function POST(req: Request, ctx: { params: { teamId: string } }) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const teamId = ctx.params.teamId;
  const body = (await req.json()) as { requestId?: string; action?: "approve" | "reject" };
  const requestId = String(body?.requestId || "").trim();
  const action = body?.action;

  if (!requestId || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  await updateDb((db) => {
    const team = db.teams.find((t) => t.id === teamId);
    if (!team) throw new Error("team_not_found");
    if (team.ownerUserId !== userId) throw new Error("forbidden");

    const jr = db.joinRequests.find((r) => r.id === requestId && r.teamId === teamId);
    if (!jr) throw new Error("request_not_found");
    if (jr.status !== "pending") return;

    if (action === "reject") {
      jr.status = "rejected";
      return;
    }

    // approve
    jr.status = "approved";

    // add member
    if (!team.members.some((m) => m.userId === jr.userId)) {
      team.members.push({ userId: jr.userId, displayName: jr.displayName, role: jr.role, joinedAt: Date.now() });
    }
  });

  return NextResponse.json({ ok: true });
}
