import { NextRequest, NextResponse } from "next/server";
import { createSession, setSessionCookie, verifyPassword, clearSessionCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown";
  if (!rateLimit(`admin-login:${ip}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "יותר מדי ניסיונות" }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (!body.password || !(await verifyPassword(body.password))) {
    return NextResponse.json({ error: "סיסמה שגויה" }, { status: 401 });
  }

  const token = await createSession();
  await setSessionCookie(token);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
