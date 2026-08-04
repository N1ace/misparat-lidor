import { NextRequest, NextResponse } from "next/server";
import { isValidEmail, normalizePhoneIL } from "@/lib/phone";
import { requestClientLoginOtp } from "@/lib/client-otp";
import { clampName, NAME_LIMITS } from "@/lib/name-limits";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    phone?: string;
    channel?: "sms" | "email";
    email?: string;
  };
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown";
  if (!rateLimit(`client-otp:${ip}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "יותר מדי בקשות" }, { status: 429 });
  }

  if (!body.name?.trim() || !body.phone || !body.channel) {
    return NextResponse.json({ error: "חסרים שדות" }, { status: 400 });
  }
  if (body.channel !== "sms" && body.channel !== "email") {
    return NextResponse.json({ error: "ערוץ לא תקין" }, { status: 400 });
  }
  const phone = normalizePhoneIL(body.phone);
  if (!phone) return NextResponse.json({ error: "טלפון לא תקין" }, { status: 400 });
  const name = clampName(body.name, NAME_LIMITS.person);
  if (!name) return NextResponse.json({ error: "חסרים שדות" }, { status: 400 });

  const email: string | null = body.email?.trim() ? body.email.trim().toLowerCase() : null;
  if (body.channel === "email") {
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "אימייל נדרש לקבלת קוד במייל" }, { status: 400 });
    }
  } else if (email && !isValidEmail(email)) {
    return NextResponse.json({ error: "אימייל לא תקין" }, { status: 400 });
  }

  try {
    const result = await requestClientLoginOtp({
      phone,
      name,
      channel: body.channel,
      email,
    });
    return NextResponse.json({ ok: true, testCode: result.testCode });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "שליחת הקוד נכשלה" }, { status: 500 });
  }
}
