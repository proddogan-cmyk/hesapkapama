import { NextRequest, NextResponse } from "next/server";
import { getProfile, saveProfile, type HKProfile } from "@/lib/server/hkdb";

/**
 * Onboarding currently POSTs to /api/user/profile.
 * Previously it returned a Next.js 404 HTML page because the route didn't exist.
 *
 * This implementation uses Postgres (Neon) for persistence.
 */

function pickUserKey(fallbackLocalUserId?: string) {
  // Prefer Clerk userId if available; otherwise fall back to localUserId.
  // auth() may throw if clerkMiddleware isn't correctly configured; we handle that.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { auth } = require("@clerk/nextjs/server");
    const a = auth();
    if (a?.userId) return String(a.userId);
  } catch {}
  if (fallbackLocalUserId) return String(fallbackLocalUserId);
  return "";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const localUserId = searchParams.get("localUserId") || "";
  const userKey = await pickUserKey(localUserId);

  if (!userKey) return NextResponse.json({ profile: null }, { status: 200 });

  const profile = await getProfile(userKey);
  return NextResponse.json({ profile }, { status: 200 });
}

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const localUserId = (body?.localUserId || "") as string;
  const userKey = await pickUserKey(localUserId);

  if (!userKey) {
    return NextResponse.json({ ok: false, error: "Missing user identity" }, { status: 400 });
  }

  const profile: HKProfile = {
    name: typeof body?.name === "string" ? body.name : "",
    company: typeof body?.company === "string" ? body.company : "",
    phone: typeof body?.phone === "string" ? body.phone : "",
    localUserId,
    requestId: typeof body?.requestId === "string" ? body.requestId : "",
  };

  try {
    const saved = await saveProfile(userKey, profile);
    return NextResponse.json({ ok: true, profile: saved }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Write failed" }, { status: 500 });
  }
}
