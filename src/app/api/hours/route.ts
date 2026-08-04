import { NextResponse } from "next/server";
import { getWorkingWindows, groupWindowsByDay } from "@/lib/hours";
import { DAY_NAMES } from "@/lib/shop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const windows = await getWorkingWindows();
    const byDay = groupWindowsByDay(windows);
    return NextResponse.json(
      {
        windows,
        byDay,
        dayNames: DAY_NAMES,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
