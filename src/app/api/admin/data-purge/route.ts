import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import {
  purgeAllBoth,
  purgeAllClients,
  purgeAllHistory,
  purgeHistoryDateRange,
  purgeHistoryForClientId,
} from "@/lib/data-purge";

export const runtime = "nodejs";

type Mode =
  | "client_history"
  | "date_range"
  | "all_history"
  | "all_clients"
  | "all_both";

export async function POST(req: NextRequest) {
  if (!(await readSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    mode?: Mode;
    clientId?: string;
    from?: string;
    to?: string;
    confirm?: string;
  };

  if (body.confirm !== "מחק") {
    return NextResponse.json({ error: "נדרש אישור: הקלידו מחק" }, { status: 400 });
  }

  try {
    switch (body.mode) {
      case "client_history": {
        if (!body.clientId) {
          return NextResponse.json({ error: "חסר clientId" }, { status: 400 });
        }
        const counts = await purgeHistoryForClientId(body.clientId);
        return NextResponse.json({ ok: true, ...counts });
      }
      case "date_range": {
        if (!body.from || !body.to) {
          return NextResponse.json({ error: "חסרים תאריכים" }, { status: 400 });
        }
        const counts = await purgeHistoryDateRange(body.from, body.to);
        return NextResponse.json({ ok: true, ...counts });
      }
      case "all_history": {
        const counts = await purgeAllHistory();
        return NextResponse.json({ ok: true, ...counts });
      }
      case "all_clients": {
        const counts = await purgeAllClients();
        return NextResponse.json({ ok: true, ...counts });
      }
      case "all_both": {
        const counts = await purgeAllBoth();
        return NextResponse.json({ ok: true, ...counts });
      }
      default:
        return NextResponse.json({ error: "מצב לא תקין" }, { status: 400 });
    }
  } catch (e: unknown) {
    const err = e as { message?: string; status?: number };
    const status = err.status || 500;
    console.error(e);
    return NextResponse.json({ error: err.message || "שגיאת שרת" }, { status });
  }
}
