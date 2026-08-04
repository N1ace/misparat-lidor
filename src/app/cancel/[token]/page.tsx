import Link from "next/link";
import { getSql } from "@/lib/db";
import { SHOP } from "@/lib/shop";
import { formatJerusalem, hebrewWeekday } from "@/lib/time";
import { CancelActions } from "@/components/CancelActions";

export const dynamic = "force-dynamic";

export default async function CancelPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let appt: {
    id: string;
    service_name: string;
    client_name: string;
    status: string;
    start: Date;
  } | null = null;

  try {
    const sql = getSql();
    const [row] = await sql<{
      id: string;
      service_name: string;
      client_name: string;
      status: string;
      start: Date;
    }[]>`
      select id, service_name, client_name, status, lower(period) as start
      from appointments where cancel_token = ${token}
    `;
    appt = row ?? null;
  } catch {
    appt = null;
  }

  if (!appt) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="display text-2xl">הקישור לא תקף</h1>
        <p className="mt-3 text-[var(--muted)]">לא מצאנו תור עם הקישור הזה.</p>
        <Link href="/" className="mt-6 inline-block text-[var(--accent)]">
          חזרה לקביעת תור
        </Link>
      </main>
    );
  }

  const ymd = formatJerusalem(appt.start, "yyyy-MM-dd");
  const time = formatJerusalem(appt.start, "HH:mm");

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="display text-center text-3xl">{SHOP.name}</h1>
      <div className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6">
        <h2 className="display text-xl">
          {appt.status === "cancelled" ? "התור כבר בוטל" : "ביטול תור"}
        </h2>
        <p className="mt-4 text-[var(--muted)]">
          {appt.client_name} · {appt.service_name}
          <br />
          יום {hebrewWeekday(ymd)} בשעה {time}
        </p>
        {appt.status !== "cancelled" && <CancelActions token={token} />}
      </div>
    </main>
  );
}
