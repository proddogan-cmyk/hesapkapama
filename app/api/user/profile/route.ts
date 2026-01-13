import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb, updateDb, type DbProfile } from "@/lib/server/fileDb";

export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = await getDb();
  const profile = db.profiles[userId] || null;
  return NextResponse.json({ profile });
}

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as DbProfile;

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  const title = String(body.title || "").trim();
  const bizType = body.bizType === "company" ? "company" : "freelance";
  const companyName = bizType === "company" ? String(body.companyName || "").trim() : undefined;

  if (!firstName || !lastName || !title) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  await updateDb((db) => {
    db.profiles[userId] = { firstName, lastName, title, bizType, companyName };
  });

  return NextResponse.json({ ok: true });
}
