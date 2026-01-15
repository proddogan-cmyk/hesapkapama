import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { updateDb } from "@/lib/server/fileDb";

export async function POST(req: NextRequest, context: { params: Promise<{ transferId: string; }> }) {
  const { transferId } = await context.params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json()) as { action?: "approve" | "reject" };
  const action = body?.action;

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  await updateDb((db) => {
    const tr = db.transfers.find((t) => t.id === transferId);
    if (!tr) throw new Error("transfer_not_found");
    if (tr.toUserId !== userId) throw new Error("forbidden");
    if (tr.status !== "pending") return;

    if (action === "reject") {
      tr.status = "rejected";
      tr.approvedAt = Date.now();
      return;
    }

    tr.status = "approved";
    tr.approvedAt = Date.now();
  });

  return NextResponse.json({ ok: true });
}
