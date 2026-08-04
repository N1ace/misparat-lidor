import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/availability";
import { getShopSettings } from "@/lib/settings";
import { wallTimeToUtc } from "@/lib/time";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  const serviceId = req.nextUrl.searchParams.get("serviceId");
  if (!date || !serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "פרמטרים חסרים" }, { status: 400 });
  }
  try {
    const settings = await getShopSettings();
    const dayStart = wallTimeToUtc(date, "00:00:00");
    const horizonEnd = new Date();
    horizonEnd.setHours(23, 59, 59, 999);
    horizonEnd.setDate(horizonEnd.getDate() + settings.online_booking_horizon_days);
    if (dayStart > horizonEnd) {
      return NextResponse.json({ slots: [], horizonDays: settings.online_booking_horizon_days });
    }
    const slots = await getAvailableSlots(date, serviceId);
    return NextResponse.json({ slots, horizonDays: settings.online_booking_horizon_days });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
