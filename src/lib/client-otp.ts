import { hash, compare } from "bcryptjs";
import { getSql } from "./db";
import { getEmailProvider } from "./email";
import { getSmsProvider } from "./sms";
import { SHOP } from "./shop";

/** Fixed OTP while SMS/email providers are not configured. */
export const CLIENT_TEST_OTP = "000000";

export async function requestClientLoginOtp(opts: {
  phone: string;
  name: string;
  channel: "sms" | "email";
  email?: string | null;
}): Promise<{ testCode: string }> {
  const recipient = opts.channel === "email" ? (opts.email || "").trim().toLowerCase() : opts.phone;
  if (!recipient) throw new Error("חסר נמען לקוד");

  const code = CLIENT_TEST_OTP;
  const codeHash = await hash(code, 10);
  const sql = getSql();

  await sql`
    update client_otp set consumed_at = now()
    where phone = ${opts.phone} and purpose = 'client_login' and consumed_at is null
  `;

  await sql`
    insert into client_otp (phone, name, email, channel, recipient, code_hash, purpose, expires_at)
    values (
      ${opts.phone},
      ${opts.name},
      ${opts.email || null},
      ${opts.channel},
      ${recipient},
      ${codeHash},
      'client_login',
      now() + interval '10 minutes'
    )
  `;

  // Providers may be console stubs — never block booking on delivery.
  try {
    if (opts.channel === "sms") {
      await getSmsProvider().send(recipient, `קוד האימות שלך ב${SHOP.name}: ${code} (תקף 10 דק׳)`);
    } else {
      await getEmailProvider().send(
        recipient,
        `קוד אימות — ${SHOP.name}`,
        `שלום ${opts.name},\n\nקוד האימות שלך: ${code}\n\nהקוד תקף ל־10 דקות.\nאם לא ביקשת — התעלם מהודעה זו.\n\n${SHOP.name}`,
      );
    }
  } catch (e) {
    console.warn("[client-otp] delivery skipped/failed (using test code)", e);
  }

  console.log(`[client-otp TEST] phone=${opts.phone} code=${code}`);
  return { testCode: code };
}

export async function verifyClientLoginOtp(opts: {
  phone: string;
  code: string;
}): Promise<{ name: string; email: string | null; channel: "sms" | "email" } | null> {
  const sql = getSql();
  const [row] = await sql<{
    id: string;
    code_hash: string;
    name: string;
    email: string | null;
    channel: "sms" | "email";
  }[]>`
    select id, code_hash, name, email, channel from client_otp
    where phone = ${opts.phone}
      and purpose = 'client_login'
      and consumed_at is null
      and expires_at > now()
    order by created_at desc
    limit 1
  `;
  if (!row) return null;
  const ok = await compare(opts.code.trim(), row.code_hash);
  if (!ok) return null;
  await sql`update client_otp set consumed_at = now() where id = ${row.id}::uuid`;
  return { name: row.name, email: row.email, channel: row.channel };
}
