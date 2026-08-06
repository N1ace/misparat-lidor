/** Client-safe settings types/defaults — no DB imports. */

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
  /** When true, offered starts step by the selected service duration (not fixed slot_step). */
  slot_step_by_duration: boolean;
  buffer_minutes: number;
  reminder_hours_before: number;
  notify_confirmation: boolean;
  notify_reminder: boolean;
  notify_cancellation: boolean;
  waitlist_enabled: boolean;
  waitlist_offer_ttl_minutes: number;
  waitlist_min_lead_minutes: number;
  waitlist_max_per_phone: number;
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
  slot_step_by_duration: true,
  buffer_minutes: 0,
  reminder_hours_before: 24,
  notify_confirmation: true,
  notify_reminder: true,
  notify_cancellation: true,
  waitlist_enabled: true,
  waitlist_offer_ttl_minutes: 15,
  waitlist_min_lead_minutes: 30,
  waitlist_max_per_phone: 2,
};
