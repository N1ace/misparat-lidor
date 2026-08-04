import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { isValidEmail } from "@/lib/phone";
import { clearClientSessionCookie, createClientToken, readClientSession, setClientSessionCookie } from "@/lib/client-auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await readClientSession();
  if (!session) return NextResponse.json({ client: null }, { status: 401 });
  const sql = getSql();
  const [row] = await sql<{
    id: string;
    name: string;
    phone: string;
    email: string | null;
    notify_channel: string;
  }[]>`
    select id, name, phone, email, notify_channel from clients where id = ${session.clientId}::uuid
  `;
  if (!row) {
    await clearClientSessionCookie();
    return NextResponse.json({ client: null }, { status: 401 });
  }
  return NextResponse.json({ client: row });
}

export async function PATCH(req: NextRequest) {
  const session = await readClientSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    email?: string | null;
    notify_channel?: "sms" | "email";
  };

  if (body.notify_channel && body.notify_channel !== "sms" && body.notify_channel !== "email") {
    return NextResponse.json({ error: "ערוץ לא תקין" }, { status: 400 });
  }
  const email =
    body.email === undefined
      ? undefined
      : body.email?.trim()
        ? body.email.trim().toLowerCase()
        : null;
  if (email && !isValidEmail(email)) {
    return NextResponse.json({ error: "אימייל לא תקין" }, { status: 400 });
  }
  if (body.notify_channel === "email" && email === null) {
    return NextResponse.json({ error: "נדרש אימייל להתראות במייל" }, { status: 400 });
  }

  const sql = getSql();
  const nameProvided = !!body.name?.trim();
  const emailProvided = body.email !== undefined;
  const channelProvided = !!body.notify_channel;

  const [row] = await sql<{
    id: string;
    name: string;
    phone: string;
    email: string | null;
    notify_channel: string;
  }[]>`
    update clients set
      name = case when ${nameProvided} then ${body.name?.trim() || null} else name end,
      email = case when ${emailProvided} then ${email ?? null} else email end,
      notify_channel = case when ${channelProvided} then ${body.notify_channel || null} else notify_channel end,
      updated_at = now()
    where id = ${session.clientId}::uuid
    returning id, name, phone, email, notify_channel
  `;

  if (!row) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

  if (body.notify_channel === "email" && !row.email) {
    return NextResponse.json({ error: "נדרש אימייל להתראות במייל" }, { status: 400 });
  }

  const token = await createClientToken({
    clientId: row.id,
    phone: row.phone,
    name: row.name,
  });
  await setClientSessionCookie(token);

  return NextResponse.json({ client: row });
}
