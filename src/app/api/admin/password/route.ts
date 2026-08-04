import { NextRequest, NextResponse } from "next/server";
import { readSession, hashPassword, setPasswordHash } from "@/lib/auth";
import { requestPasswordChangeOtp, verifyPasswordChangeOtp } from "@/lib/otp";

export const runtime = "nodejs";

async function requireAdmin() {
  if (!(await readSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

/** POST { action: 'request' } → email OTP; { action: 'confirm', code, password } → set password */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    code?: string;
    password?: string;
  };

  if (body.action === "request") {
    try {
      await requestPasswordChangeOtp();
      return NextResponse.json({ ok: true });
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: "לא ניתן לשלוח קוד" }, { status: 500 });
    }
  }

  if (body.action === "confirm") {
    if (!body.code || !body.password || body.password.length < 8) {
      return NextResponse.json({ error: "קוד או סיסמה לא תקינים" }, { status: 400 });
    }
    const ok = await verifyPasswordChangeOtp(body.code);
    if (!ok) return NextResponse.json({ error: "קוד שגוי או שפג תוקפו" }, { status: 400 });
    await setPasswordHash(await hashPassword(body.password));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "action לא מוכר" }, { status: 400 });
}
