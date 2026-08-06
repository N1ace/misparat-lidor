import { getSql } from "./db";
import { normalizePhoneIL } from "./phone";
import { wallTimeToUtc } from "./time";

export type PurgeCounts = {
  deletedAppointments: number;
  deletedWaitlist: number;
  deletedClients: number;
  deletedOtp: number;
};

function emptyCounts(): PurgeCounts {
  return {
    deletedAppointments: 0,
    deletedWaitlist: 0,
    deletedClients: 0,
    deletedOtp: 0,
  };
}

/** National 9-digit core (no leading 0) for fuzzy phone match across formats. */
export function phoneCoreDigits(phone: string): string | null {
  const e164 = normalizePhoneIL(phone);
  if (e164) return e164.replace(/\D/g, "").replace(/^972/, "");
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  let core = digits;
  if (core.startsWith("972")) core = core.slice(3);
  if (core.startsWith("0")) core = core.slice(1);
  return core.length >= 8 ? core : null;
}

async function deleteWaitlistByPhoneCore(core: string): Promise<number> {
  const sql = getSql();
  // Offers reference entries without ON DELETE CASCADE — clear them first
  await sql`
    delete from waitlist_offers
    where entry_id in (
      select id from waitlist_entries
      where right(regexp_replace(client_phone, '\D', '', 'g'), 9) = ${core}
         or right(regexp_replace(client_phone, '\D', '', 'g'), ${core.length}) = ${core}
    )
  `;
  const rows = await sql<{ id: string }[]>`
    delete from waitlist_entries
    where right(regexp_replace(client_phone, '\D', '', 'g'), 9) = ${core}
       or right(regexp_replace(client_phone, '\D', '', 'g'), ${core.length}) = ${core}
    returning id
  `;
  return rows.length;
}

async function deleteAppointmentsByPhoneCore(core: string): Promise<number> {
  const sql = getSql();
  const rows = await sql<{ id: string }[]>`
    delete from appointments
    where right(regexp_replace(client_phone, '\D', '', 'g'), 9) = ${core}
       or right(regexp_replace(client_phone, '\D', '', 'g'), ${core.length}) = ${core}
    returning id
  `;
  return rows.length;
}

async function deleteOtpByPhoneCore(core: string): Promise<number> {
  const sql = getSql();
  try {
    const rows = await sql<{ id: string }[]>`
      delete from client_otp
      where right(regexp_replace(phone, '\D', '', 'g'), 9) = ${core}
         or right(regexp_replace(phone, '\D', '', 'g'), ${core.length}) = ${core}
      returning id
    `;
    return rows.length;
  } catch {
    return 0;
  }
}

export async function purgeHistoryForPhone(phone: string): Promise<PurgeCounts> {
  const counts = emptyCounts();
  const core = phoneCoreDigits(phone);
  if (!core) return counts;
  counts.deletedAppointments = await deleteAppointmentsByPhoneCore(core);
  counts.deletedWaitlist = await deleteWaitlistByPhoneCore(core);
  counts.deletedOtp = await deleteOtpByPhoneCore(core);
  return counts;
}

export async function purgeHistoryForClientId(clientId: string): Promise<PurgeCounts> {
  const sql = getSql();
  const [client] = await sql<{ phone: string }[]>`
    select phone from clients where id = ${clientId}::uuid
  `;
  if (!client) {
    throw Object.assign(new Error("לקוח לא נמצא"), { status: 404 });
  }
  return purgeHistoryForPhone(client.phone);
}

export async function deleteClientById(
  clientId: string,
  opts?: { withHistory?: boolean },
): Promise<PurgeCounts> {
  const sql = getSql();
  const [client] = await sql<{ id: string; phone: string }[]>`
    select id, phone from clients where id = ${clientId}::uuid
  `;
  if (!client) {
    throw Object.assign(new Error("לקוח לא נמצא"), { status: 404 });
  }

  const counts = emptyCounts();
  if (opts?.withHistory) {
    const hist = await purgeHistoryForPhone(client.phone);
    counts.deletedAppointments = hist.deletedAppointments;
    counts.deletedWaitlist = hist.deletedWaitlist;
    counts.deletedOtp = hist.deletedOtp;
  } else {
    const core = phoneCoreDigits(client.phone);
    if (core) counts.deletedOtp = await deleteOtpByPhoneCore(core);
  }

  const deleted = await sql<{ id: string }[]>`
    delete from clients where id = ${clientId}::uuid returning id
  `;
  counts.deletedClients = deleted.length;
  return counts;
}

export async function purgeHistoryDateRange(fromYmd: string, toYmd: string): Promise<PurgeCounts> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(toYmd)) {
    throw Object.assign(new Error("תאריכים לא תקינים"), { status: 400 });
  }
  if (fromYmd > toYmd) {
    throw Object.assign(new Error("תאריך התחלה אחרי תאריך סיום"), { status: 400 });
  }

  const sql = getSql();
  const rangeStart = wallTimeToUtc(fromYmd, "00:00:00");
  const rangeEnd = wallTimeToUtc(toYmd, "23:59:59");
  const startIso = rangeStart.toISOString();
  const endIso = rangeEnd.toISOString();

  const counts = emptyCounts();

  // Offers tied to appointments cascade; still clear offers for waitlist entries we delete
  await sql`
    delete from waitlist_offers
    where entry_id in (
      select id from waitlist_entries
      where target_date >= ${fromYmd}::date and target_date <= ${toYmd}::date
    )
  `;

  const wl = await sql<{ id: string }[]>`
    delete from waitlist_entries
    where target_date >= ${fromYmd}::date and target_date <= ${toYmd}::date
    returning id
  `;
  counts.deletedWaitlist = wl.length;

  const appts = await sql<{ id: string }[]>`
    delete from appointments
    where period && tstzrange(${startIso}::timestamptz, ${endIso}::timestamptz, '[)')
    returning id
  `;
  counts.deletedAppointments = appts.length;

  return counts;
}

export async function purgeAllHistory(): Promise<PurgeCounts> {
  const sql = getSql();
  const counts = emptyCounts();

  await sql`delete from waitlist_offers`;
  const wl = await sql<{ id: string }[]>`delete from waitlist_entries returning id`;
  counts.deletedWaitlist = wl.length;

  const appts = await sql<{ id: string }[]>`delete from appointments returning id`;
  counts.deletedAppointments = appts.length;

  return counts;
}

export async function purgeAllClients(): Promise<PurgeCounts> {
  const sql = getSql();
  const counts = emptyCounts();
  try {
    const otp = await sql<{ id: string }[]>`delete from client_otp returning id`;
    counts.deletedOtp = otp.length;
  } catch {
    /* table may not exist in older DBs */
  }
  const clients = await sql<{ id: string }[]>`delete from clients returning id`;
  counts.deletedClients = clients.length;
  return counts;
}

export async function purgeAllBoth(): Promise<PurgeCounts> {
  const hist = await purgeAllHistory();
  const clients = await purgeAllClients();
  return {
    deletedAppointments: hist.deletedAppointments,
    deletedWaitlist: hist.deletedWaitlist,
    deletedClients: clients.deletedClients,
    deletedOtp: hist.deletedOtp + clients.deletedOtp,
  };
}
