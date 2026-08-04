import { compare, hash } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getSql } from "./db";
import { ADMIN_COOKIE } from "./constants";

const TTL_DAYS = 30;

function secretKey() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET missing or too short");
  return new TextEncoder().encode(s);
}

export async function getPasswordHash(): Promise<string> {
  const sql = getSql();
  const [row] = await sql<{ password_hash: string }[]>`
    select password_hash from admin_credentials where id = 1
  `;
  if (row?.password_hash) return row.password_hash;
  const envHash = process.env.ADMIN_PASSWORD_HASH;
  if (!envHash) throw new Error("No admin password configured");
  return envHash;
}

export async function verifyPassword(password: string): Promise<boolean> {
  const h = await getPasswordHash();
  return compare(password, h);
}

export async function setPasswordHash(newHash: string): Promise<void> {
  const sql = getSql();
  await sql`
    insert into admin_credentials (id, password_hash, updated_at)
    values (1, ${newHash}, now())
    on conflict (id) do update set password_hash = excluded.password_hash, updated_at = now()
  `;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

export async function createSession(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_DAYS}d`)
    .sign(secretKey());
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

export async function readSession(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, secretKey());
    return true;
  } catch {
    return false;
  }
}

export { ADMIN_COOKIE } from "./constants";
