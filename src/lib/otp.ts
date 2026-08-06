import { hash, compare } from "bcryptjs";
import { getSql } from "./db";
import { getEmailProvider } from "./email";
import { otpEmailBody } from "./messages";
import { getLiveShop } from "./settings";

function randomOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function requestPasswordChangeOtp(): Promise<void> {
  const email = process.env.OWNER_EMAIL;
  if (!email) throw new Error("OWNER_EMAIL is not set");

  const code = randomOtp();
  const codeHash = await hash(code, 10);
  const sql = getSql();

  await sql`update admin_otp set consumed_at = now() where purpose = 'password_change' and consumed_at is null`;

  await sql`
    insert into admin_otp (code_hash, purpose, expires_at)
    values (${codeHash}, 'password_change', now() + interval '10 minutes')
  `;

  const shop = await getLiveShop();
  const msg = otpEmailBody(code, shop);
  await getEmailProvider().send(email, msg.subject, msg.text);
}

export async function verifyPasswordChangeOtp(code: string): Promise<boolean> {
  const sql = getSql();
  const [row] = await sql<{ id: string; code_hash: string }[]>`
    select id, code_hash from admin_otp
    where purpose = 'password_change'
      and consumed_at is null
      and expires_at > now()
    order by created_at desc
    limit 1
  `;
  if (!row) return false;
  const ok = await compare(code.trim(), row.code_hash);
  if (!ok) return false;
  await sql`update admin_otp set consumed_at = now() where id = ${row.id}::uuid`;
  return true;
}
