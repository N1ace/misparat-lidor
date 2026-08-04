import { getSql } from "./db";
import { validateBookablePeriod, fitsPreferredWindow } from "./availability";
import { formatJerusalem, hebrewWeekday } from "./time";
import { getShopSettings } from "./settings";
import { smsWaitlistOffer, smsWaitlistLost } from "./messages";

export type FreedPeriod = { start: Date; end: Date };

async function settingsOrDefaults() {
  try {
    return await getShopSettings();
  } catch {
    return {
      waitlist_enabled: true,
      waitlist_offer_ttl_minutes: 15,
      waitlist_min_lead_minutes: 30,
      waitlist_max_per_phone: 2,
      notify_confirmation: true,
      notify_reminder: true,
      reminder_hours_before: 24,
    };
  }
}

function resolveOrigin(origin?: string) {
  return (origin || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
}

/** After a slot is released (cancel / delete). Safe to call after the release commits. */
export async function onSlotFreed(
  period: FreedPeriod,
  opts?: { origin?: string },
): Promise<void> {
  const settings = await settingsOrDefaults();
  if (!settings.waitlist_enabled) return;

  const leadMs = (settings.waitlist_min_lead_minutes ?? 30) * 60_000;
  if (period.start.getTime() - Date.now() < leadMs) return;

  await offerToNextEligible(period, opts);
}

export async function offerToNextEligible(
  freedPeriod: FreedPeriod,
  opts?: { origin?: string; onlyEntryId?: string },
): Promise<{ offered: boolean; entryId?: string }> {
  const sql = getSql();
  const settings = await settingsOrDefaults();
  if (!settings.waitlist_enabled) return { offered: false };

  const leadMs = (settings.waitlist_min_lead_minutes ?? 30) * 60_000;
  if (freedPeriod.start.getTime() - Date.now() < leadMs) return { offered: false };

  const targetDate = formatJerusalem(freedPeriod.start, "yyyy-MM-dd");
  const origin = resolveOrigin(opts?.origin);

  const candidates = await sql<{
    id: string;
    service_id: string;
    duration_minutes: number;
    price_agorot: number;
    client_name: string;
    client_phone: string;
    any_time: boolean;
  }[]>`
    select id, service_id, duration_minutes, price_agorot, client_name, client_phone, any_time
    from waitlist_entries
    where status = 'waiting'
      and target_date = ${targetDate}::date
      and (${opts?.onlyEntryId || null}::uuid is null or id = ${opts?.onlyEntryId || null}::uuid)
    order by seq asc
  `;

  for (const entry of candidates) {
    const proposedStart = freedPeriod.start;
    const proposedEnd = new Date(proposedStart.getTime() + entry.duration_minutes * 60_000);
    if (proposedEnd > freedPeriod.end) continue;

    const check = await validateBookablePeriod({
      serviceId: entry.service_id,
      start: proposedStart,
      durationMinutes: entry.duration_minutes,
      bypassLead: true,
    });
    if (!check.ok) continue;

    if (!entry.any_time) {
      const windows = await sql<{ start_time: string; end_time: string }[]>`
        select start_time::text, end_time::text
        from waitlist_windows where entry_id = ${entry.id}::uuid
      `;
      if (!fitsPreferredWindow(proposedStart, proposedEnd, windows)) continue;
    }

    try {
      const made = await makeOffer({
        entry,
        start: proposedStart,
        end: proposedEnd,
        ttlMinutes: settings.waitlist_offer_ttl_minutes ?? 15,
        origin,
      });
      if (made) return { offered: true, entryId: entry.id };
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === "23P01" || /exclusion|overlap/i.test(err.message || "")) {
        return { offered: false };
      }
      throw e;
    }
  }

  return { offered: false };
}

async function makeOffer(opts: {
  entry: {
    id: string;
    service_id: string;
    duration_minutes: number;
    price_agorot: number;
    client_name: string;
    client_phone: string;
  };
  start: Date;
  end: Date;
  ttlMinutes: number;
  origin: string;
}): Promise<boolean> {
  const sql = getSql();
  const { entry, start, end, ttlMinutes, origin } = opts;

  const [svc] = await sql<{ name: string }[]>`
    select name from services where id = ${entry.service_id}::uuid
  `;
  const serviceName = svc?.name || "שירות";
  const cancelToken = crypto.randomUUID();
  const offerToken = crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  const day = hebrewWeekday(formatJerusalem(start, "yyyy-MM-dd"));
  const time = formatJerusalem(start, "HH:mm");
  const url = `${origin}/offer/${offerToken}`;
  const body = smsWaitlistOffer({ day, time, url });

  const result = await sql.begin(async (tx) => {
    const claimed = await tx<{ id: string }[]>`
      update waitlist_entries
      set status = 'offered', updated_at = now()
      where id = ${entry.id}::uuid and status = 'waiting'
      returning id
    `;
    if (!claimed.length) return false;

    const [appt] = await tx<{ id: string }[]>`
      insert into appointments (
        period, service_id, service_name, duration_minutes, price_agorot,
        client_name, client_phone, cancel_token, source, status
      ) values (
        tstzrange(${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz, '[)'),
        ${entry.service_id}::uuid,
        ${serviceName},
        ${entry.duration_minutes},
        ${entry.price_agorot},
        ${entry.client_name},
        ${entry.client_phone},
        ${cancelToken},
        'online',
        'held'
      )
      returning id
    `;

    await tx`
      insert into waitlist_offers (entry_id, appointment_id, token, expires_at, status)
      values (
        ${entry.id}::uuid, ${appt.id}::uuid, ${offerToken},
        ${expiresAt.toISOString()}::timestamptz, 'pending'
      )
    `;

    await tx`
      insert into outbox (appointment_id, kind, channel, recipient, body, send_after)
      values (${appt.id}::uuid, 'waitlist_offer', 'sms', ${entry.client_phone}, ${body}, now())
    `;

    return true;
  });

  return !!result;
}

export async function expireDueOffers(opts?: { origin?: string }): Promise<number> {
  const sql = getSql();
  const origin = resolveOrigin(opts?.origin);
  let n = 0;

  const due = await sql<{
    id: string;
    entry_id: string;
    appointment_id: string;
    start: Date;
    end: Date;
  }[]>`
    select o.id, o.entry_id, o.appointment_id,
           lower(a.period) as start, upper(a.period) as end
    from waitlist_offers o
    join appointments a on a.id = o.appointment_id
    where o.status = 'pending' and o.expires_at <= now()
    order by o.expires_at
    limit 20
  `;

  for (const row of due) {
    try {
      const released = await sql.begin(async (tx) => {
        const updated = await tx<{ id: string }[]>`
          update waitlist_offers
          set status = 'expired', responded_at = now()
          where id = ${row.id}::uuid and status = 'pending'
          returning id
        `;
        if (!updated.length) return null;
        await tx`delete from appointments where id = ${row.appointment_id}::uuid and status = 'held'`;
        await tx`
          update waitlist_entries
          set status = 'waiting', updated_at = now()
          where id = ${row.entry_id}::uuid and status = 'offered'
        `;
        return { start: new Date(row.start), end: new Date(row.end) };
      });
      if (!released) continue;
      n += 1;
      await offerToNextEligible(released, { origin });
    } catch (e) {
      console.error("[waitlist] expire failed", row.id, e);
    }
  }
  return n;
}

export async function acceptOffer(
  token: string,
  origin: string,
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "gone" | "expired" | "overlap" }> {
  const sql = getSql();
  const settings = await getShopSettings();
  const { smsConfirmation, smsReminder } = await import("./messages");

  try {
    return await sql.begin(async (tx) => {
      const [offer] = await tx<{
        id: string;
        entry_id: string;
        appointment_id: string;
        status: string;
        expires_at: Date;
        client_phone: string;
        client_name: string;
        target_date: string;
        start: Date;
        service_name: string;
      }[]>`
        select o.id, o.entry_id, o.appointment_id, o.status, o.expires_at,
               e.client_phone, e.client_name, e.target_date::text,
               lower(a.period) as start, a.service_name
        from waitlist_offers o
        join waitlist_entries e on e.id = o.entry_id
        join appointments a on a.id = o.appointment_id
        where o.token = ${token}
        for update of o
      `;
      if (!offer) return { ok: false as const, reason: "not_found" as const };
      if (offer.status !== "pending") return { ok: false as const, reason: "gone" as const };
      if (new Date(offer.expires_at) <= new Date()) {
        return { ok: false as const, reason: "expired" as const };
      }

      await tx`
        update appointments set status = 'confirmed'
        where id = ${offer.appointment_id}::uuid and status = 'held'
      `;
      await tx`
        update waitlist_offers
        set status = 'accepted', responded_at = now()
        where id = ${offer.id}::uuid
      `;
      await tx`
        update waitlist_entries
        set status = 'fulfilled', updated_at = now()
        where id = ${offer.entry_id}::uuid
      `;
      await tx`
        update waitlist_entries
        set status = 'cancelled', updated_at = now()
        where client_phone = ${offer.client_phone}
          and target_date = ${offer.target_date}::date
          and id <> ${offer.entry_id}::uuid
          and status in ('waiting','offered')
      `;

      const smsConfirm = smsConfirmation({
        name: offer.client_name,
        service: offer.service_name,
        startAt: new Date(offer.start),
      });
      const smsRem = smsReminder({ time: formatJerusalem(offer.start, "HH:mm") });

      if (settings.notify_confirmation) {
        await tx`
          insert into outbox (appointment_id, kind, channel, recipient, body, send_after)
          values (
            ${offer.appointment_id}::uuid, 'confirmation', 'sms',
            ${offer.client_phone}, ${smsConfirm}, now()
          )
        `;
      }
      if (settings.notify_reminder) {
        const reminderAt = new Date(
          new Date(offer.start).getTime() - settings.reminder_hours_before * 60 * 60 * 1000,
        );
        const reminderSend = reminderAt < new Date() ? new Date() : reminderAt;
        await tx`
          insert into outbox (appointment_id, kind, channel, recipient, body, send_after)
          values (
            ${offer.appointment_id}::uuid, 'reminder', 'sms',
            ${offer.client_phone}, ${smsRem}, ${reminderSend.toISOString()}::timestamptz
          )
        `;
      }

      void origin;
      return { ok: true as const };
    });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "23P01") return { ok: false, reason: "overlap" };
    throw e;
  }
}

export async function declineOffer(
  token: string,
  opts?: { origin?: string },
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "gone" }> {
  const sql = getSql();
  const origin = resolveOrigin(opts?.origin);

  const result = await sql.begin(async (tx) => {
    const [offer] = await tx<{
      id: string;
      entry_id: string;
      appointment_id: string;
      status: string;
      start: Date;
      end: Date;
      client_phone: string;
    }[]>`
      select o.id, o.entry_id, o.appointment_id, o.status,
             lower(a.period) as start, upper(a.period) as end,
             e.client_phone
      from waitlist_offers o
      join appointments a on a.id = o.appointment_id
      join waitlist_entries e on e.id = o.entry_id
      where o.token = ${token}
      for update of o
    `;
    if (!offer) return { ok: false as const, reason: "not_found" as const };
    if (offer.status !== "pending") return { ok: false as const, reason: "gone" as const };

    await tx`
      update waitlist_offers
      set status = 'declined', responded_at = now()
      where id = ${offer.id}::uuid
    `;
    await tx`delete from appointments where id = ${offer.appointment_id}::uuid and status = 'held'`;
    await tx`
      update waitlist_entries
      set status = 'waiting', updated_at = now()
      where id = ${offer.entry_id}::uuid
    `;

    const lost = smsWaitlistLost();
    await tx`
      insert into outbox (appointment_id, kind, channel, recipient, body, send_after)
      values (null, 'waitlist_lost', 'sms', ${offer.client_phone}, ${lost}, now())
    `;

    return {
      ok: true as const,
      period: { start: new Date(offer.start), end: new Date(offer.end) },
    };
  });

  if (!result.ok) return result;
  await offerToNextEligible(result.period, { origin });
  return { ok: true };
}
