import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getShopSettings, updateShopSettings, type ShopSettings } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET() {
  if (!(await readSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const settings = await getShopSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  if (!(await readSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<ShopSettings>;
  const allowed: (keyof ShopSettings)[] = [
    "business_name",
    "business_phone",
    "business_address",
    "owner_email",
    "online_booking_horizon_days",
    "manual_booking_horizon_days",
    "min_client_cancel_minutes",
    "lead_minutes",
    "slot_step_minutes",
    "slot_step_by_duration",
    "buffer_minutes",
    "reminder_hours_before",
    "notify_confirmation",
    "notify_reminder",
    "notify_cancellation",
    "waitlist_enabled",
    "waitlist_offer_ttl_minutes",
    "waitlist_min_lead_minutes",
    "waitlist_max_per_phone",
  ];
  const patch: Partial<ShopSettings> = {};
  for (const key of allowed) {
    if (key in body) (patch as Record<string, unknown>)[key] = body[key];
  }
  try {
    const settings = await updateShopSettings(patch);
    return NextResponse.json({ settings });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "שגיאת שמירה" }, { status: 500 });
  }
}
