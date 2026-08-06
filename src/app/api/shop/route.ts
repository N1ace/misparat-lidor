import { NextResponse } from "next/server";
import { getLiveShop } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public shop profile for website / client portal (from admin business settings). */
export async function GET() {
  const shop = await getLiveShop();
  return NextResponse.json(
    { shop },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
