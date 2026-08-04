import { NextRequest, NextResponse } from "next/server";
import { normalizePhoneIL } from "@/lib/phone";
import { verifyClientLoginOtp } from "@/lib/client-otp";
import { upsertClient, getClientByPhone } from "@/lib/clients";
import { issueClientSession } from "@/lib/client-auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    phone?: string;
    code?: string;
    deviceId?: string;
  };
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown";
  if (!rateLimit(`client-otp-v:${ip}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "יותר מדי בקשות" }, { status: 429 });
  }

  if (!body.phone || !body.code?.trim()) {
    return NextResponse.json({ error: "חסרים שדות" }, { status: 400 });
  }
  const phone = normalizePhoneIL(body.phone);
  if (!phone) return NextResponse.json({ error: "טלפון לא תקין" }, { status: 400 });

  const verified = await verifyClientLoginOtp({ phone, code: body.code });
  if (!verified) {
    return NextResponse.json({ error: "קוד שגוי או שפג תוקפו" }, { status: 400 });
  }

  const clientId = await upsertClient({
    name: verified.name,
    phone,
    email: verified.email,
    notify_channel: verified.channel,
  });

  await issueClientSession({
    clientId,
    phone,
    name: verified.name,
    deviceId: body.deviceId,
  });

  const client = await getClientByPhone(phone);
  return NextResponse.json({
    ok: true,
    loggedIn: true,
    client: client
      ? {
          id: client.id,
          name: client.name,
          phone: client.phone,
          email: client.email,
          notify_channel: client.notify_channel,
        }
      : null,
  });
}
