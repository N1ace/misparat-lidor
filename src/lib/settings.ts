import { getSql } from "./db";

export type ShopSettings = {
  business_name: string;
  business_phone: string;
  business_address: string;
  owner_email: string | null;
  online_booking_horizon_days: number;
  manual_booking_horizon_days: number;
  min_client_cancel_minutes: number;
  lead_minutes: number;
  slot_step_minutes: number;
  buffer_minutes: number;
  notify_confirmation: boolean;
  notify_reminder: boolean;
  notify_cancellation: boolean;
  waitlist_enabled: boolean;
};

export const DEFAULT_SETTINGS: ShopSettings = {
  business_name: "מספרת לידור",
  business_phone: "053-530-1669",
  business_address: "אבנר בן נר 1, אשדוד",
  owner_email: null,
  online_booking_horizon_days: 30,
  manual_booking_horizon_days: 90,
  min_client_cancel_minutes: 60,
  lead_minutes: 30,
  slot_step_minutes: 15,
  buffer_minutes: 0,
  notify_confirmation: true,
  notify_reminder: true,
  notify_cancellation: true,
  waitlist_enabled: true,
};

export async function getShopSettings(): Promise<ShopSettings> {
  try {
    const sql = getSql();
    const [row] = await sql<ShopSettings[]>`
      select business_name, business_phone, business_address, owner_email,
             online_booking_horizon_days, manual_booking_horizon_days,
             min_client_cancel_minutes, lead_minutes, slot_step_minutes, buffer_minutes,
             notify_confirmation, notify_reminder, notify_cancellation, waitlist_enabled
      from shop_settings where id = 1
    `;
    return row ? { ...DEFAULT_SETTINGS, ...row } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function updateShopSettings(
  patch: Partial<ShopSettings>,
): Promise<ShopSettings> {
  const sql = getSql();
  const cur = await getShopSettings();
  const next = { ...cur, ...patch };
  await sql`
    insert into shop_settings (
      id, business_name, business_phone, business_address, owner_email,
      online_booking_horizon_days, manual_booking_horizon_days, min_client_cancel_minutes,
      lead_minutes, slot_step_minutes, buffer_minutes,
      notify_confirmation, notify_reminder, notify_cancellation, waitlist_enabled, updated_at
    ) values (
      1, ${next.business_name}, ${next.business_phone}, ${next.business_address}, ${next.owner_email},
      ${next.online_booking_horizon_days}, ${next.manual_booking_horizon_days}, ${next.min_client_cancel_minutes},
      ${next.lead_minutes}, ${next.slot_step_minutes}, ${next.buffer_minutes},
      ${next.notify_confirmation}, ${next.notify_reminder}, ${next.notify_cancellation}, ${next.waitlist_enabled},
      now()
    )
    on conflict (id) do update set
      business_name = excluded.business_name,
      business_phone = excluded.business_phone,
      business_address = excluded.business_address,
      owner_email = excluded.owner_email,
      online_booking_horizon_days = excluded.online_booking_horizon_days,
      manual_booking_horizon_days = excluded.manual_booking_horizon_days,
      min_client_cancel_minutes = excluded.min_client_cancel_minutes,
      lead_minutes = excluded.lead_minutes,
      slot_step_minutes = excluded.slot_step_minutes,
      buffer_minutes = excluded.buffer_minutes,
      notify_confirmation = excluded.notify_confirmation,
      notify_reminder = excluded.notify_reminder,
      notify_cancellation = excluded.notify_cancellation,
      waitlist_enabled = excluded.waitlist_enabled,
      updated_at = now()
  `;
  return next;
}
