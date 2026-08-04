import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/availability";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  const serviceId = req.nextUrl.searchParams.get("serviceId");
  if (!date || !serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "פרמטרים חסרים" }, { status: 400 });
  }
  try {
    const slots = await getAvailableSlots(date, serviceId);
    return NextResponse.json({ slots });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
