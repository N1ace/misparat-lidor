import { createHash } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getSql } from "./db";
import { CLIENT_COOKIE } from "./constants";

const TTL_DAYS = 90;

export type ClientSession = {
  clientId: string;
  phone: string;
  name: string;
};

function secretKey() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET missing or too short");
  return new TextEncoder().encode(s);
}

export function hashDeviceId(deviceId: string): string {
  return createHash("sha256").update(`lidor-device:${deviceId}`).digest("hex");
}

export async function createClientToken(session: ClientSession): Promise<string> {
  return new SignJWT({
    role: "client",
    clientId: session.clientId,
    phone: session.phone,
    name: session.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_DAYS}d`)
    .sign(secretKey());
}

export async function setClientSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(CLIENT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_DAYS * 24 * 60 * 60,
  });
}

export async function clearClientSessionCookie() {
  const jar = await cookies();
  jar.delete(CLIENT_COOKIE);
}

export async function readClientSession(): Promise<ClientSession | null> {
  const jar = await cookies();
  const token = jar.get(CLIENT_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.role !== "client" || typeof payload.clientId !== "string") return null;
    return {
      clientId: payload.clientId,
      phone: String(payload.phone || ""),
      name: String(payload.name || ""),
    };
  } catch {
    return null;
  }
}

export async function registerDevice(clientId: string, deviceId: string): Promise<void> {
  if (!deviceId || deviceId.length < 8) return;
  const deviceHash = hashDeviceId(deviceId);
  const sql = getSql();
  await sql`
    insert into client_devices (client_id, device_hash, last_seen_at)
    values (${clientId}::uuid, ${deviceHash}, now())
    on conflict (client_id, device_hash) do update set last_seen_at = now()
  `;
}

export async function findClientByDevice(deviceId: string, phone: string) {
  const deviceHash = hashDeviceId(deviceId);
  const sql = getSql();
  const [row] = await sql<{
    id: string;
    name: string;
    phone: string;
    email: string | null;
    notify_channel: string;
  }[]>`
    select c.id, c.name, c.phone, c.email, c.notify_channel
    from client_devices d
    join clients c on c.id = d.client_id
    where d.device_hash = ${deviceHash} and c.phone = ${phone}
    limit 1
  `;
  if (row) {
    await sql`update client_devices set last_seen_at = now() where device_hash = ${deviceHash} and client_id = ${row.id}::uuid`;
  }
  return row || null;
}

export async function issueClientSession(opts: {
  clientId: string;
  phone: string;
  name: string;
  deviceId?: string | null;
}) {
  if (opts.deviceId) await registerDevice(opts.clientId, opts.deviceId);
  const token = await createClientToken({
    clientId: opts.clientId,
    phone: opts.phone,
    name: opts.name,
  });
  await setClientSessionCookie(token);
  return token;
}

export { CLIENT_COOKIE };
