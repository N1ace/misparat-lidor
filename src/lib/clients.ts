import { getSql } from "./db";
import { clampName, NAME_LIMITS } from "./name-limits";

/** Upsert client by phone; returns client id. */
export async function upsertClient(input: {
  name: string;
  phone: string;
  email?: string | null;
  notify_channel?: "sms" | "email";
}): Promise<string> {
  const sql = getSql();
  const channel = input.notify_channel || "sms";
  const name = clampName(input.name, NAME_LIMITS.person);
  const [row] = await sql<{ id: string }[]>`
    insert into clients (name, phone, email, notify_channel)
    values (${name}, ${input.phone}, ${input.email ?? null}, ${channel})
    on conflict (phone) do update set
      name = excluded.name,
      email = coalesce(excluded.email, clients.email),
      notify_channel = coalesce(excluded.notify_channel, clients.notify_channel),
      updated_at = now()
    returning id
  `;
  return row.id;
}

export async function getClientByPhone(phone: string) {
  const sql = getSql();
  const [row] = await sql<{
    id: string;
    name: string;
    phone: string;
    email: string | null;
    notify_channel: "sms" | "email";
  }[]>`
    select id, name, phone, email, notify_channel from clients where phone = ${phone} limit 1
  `;
  return row || null;
}

export function namesMatch(a: string, b: string): boolean {
  return a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();
}
