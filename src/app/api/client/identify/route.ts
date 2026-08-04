import { NextRequest, NextResponse } from "next/server";
import { normalizePhoneIL } from "@/lib/phone";
import { getClientByPhone, namesMatch } from "@/lib/clients";
import { findClientByDevice, issueClientSession } from "@/lib/client-auth";
import { clampName, NAME_LIMITS } from "@/lib/name-limits";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    phone?: string;
    deviceId?: string;
  };
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown";
  if (!rateLimit(`client-id:${ip}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "יותר מדי בקשות" }, { status: 429 });
  }

  if (!body.name?.trim() || !body.phone) {
    return NextResponse.json({ error: "שם וטלפון חובה" }, { status: 400 });
  }
  const phone = normalizePhoneIL(body.phone);
  if (!phone) return NextResponse.json({ error: "טלפון לא תקין" }, { status: 400 });
  const name = clampName(body.name, NAME_LIMITS.person);
  if (!name) return NextResponse.json({ error: "שם וטלפון חובה" }, { status: 400 });

  if (body.deviceId) {
    const byDevice = await findClientByDevice(body.deviceId, phone);
    if (byDevice) {
      await issueClientSession({
        clientId: byDevice.id,
        phone: byDevice.phone,
        name: byDevice.name,
        deviceId: body.deviceId,
      });
      return NextResponse.json({
        ok: true,
        loggedIn: true,
        via: "device",
        client: {
          id: byDevice.id,
          name: byDevice.name,
          phone: byDevice.phone,
          email: byDevice.email,
          notify_channel: byDevice.notify_channel,
        },
      });
    }
  }

  const existing = await getClientByPhone(phone);
  if (existing && namesMatch(existing.name, name)) {
    await issueClientSession({
      clientId: existing.id,
      phone: existing.phone,
      name: existing.name,
      deviceId: body.deviceId,
    });
    return NextResponse.json({
      ok: true,
      loggedIn: true,
      via: "match",
      client: {
        id: existing.id,
        name: existing.name,
        phone: existing.phone,
        email: existing.email,
        notify_channel: existing.notify_channel,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    loggedIn: false,
    needsOtp: true,
    isNew: !existing,
  });
}
