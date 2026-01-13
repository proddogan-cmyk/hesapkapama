import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb, makeId, updateDb, type DbTransfer } from "@/lib/server/fileDb";

export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = await getDb();
  const transfers = db.transfers
    .filter((t) => t.fromUserId === userId || t.toUserId === userId)
    .slice(0, 200);

  return NextResponse.json({ transfers });
}

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as { teamId?: string; toUserId?: string; amount?: number; note?: string };
  const teamId = String(body?.teamId || "").trim();
  const toUserId = String(body?.toUserId || "").trim();
  const amount = Number(body?.amount || 0);
  const note = body?.note ? String(body.note).trim() : undefined;

  if (!teamId || !toUserId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const db = await getDb();
  const team = db.teams.find((t) => t.id === teamId);
  if (!team) return NextResponse.json({ error: "team_not_found" }, { status: 404 });

  const fromMember = team.members.find((m) => m.userId === userId);
  const toMember = team.members.find((m) => m.userId === toUserId);

  if (!fromMember || !toMember) return NextResponse.json({ error: "not_member" }, { status: 403 });

  const transfer: DbTransfer = {
    id: makeId("tr"),
    teamId: team.id,
    projectName: team.projectName,
    fromUserId: userId,
    fromDisplayName: fromMember.displayName,
    toUserId,
    toDisplayName: toMember.displayName,
    amount,
    note,
    createdAt: Date.now(),
    status: "pending",
  };

  await updateDb((db2) => {
    db2.transfers.unshift(transfer);
  });

  return NextResponse.json({ transfer });
}
