import { NextResponse } from "next/server";
import { clearClientSessionCookie, readClientSession } from "@/lib/client-auth";

export const runtime = "nodejs";

export async function POST() {
  const session = await readClientSession();
  if (session) await clearClientSessionCookie();
  return NextResponse.json({ ok: true });
}
