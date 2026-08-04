import { getSql } from "@/lib/db";
import { SHOP } from "@/lib/shop";
import { BookingFlow } from "@/components/BookingFlow";

export const dynamic = "force-dynamic";

async function loadServices() {
  try {
    const sql = getSql();
    return await sql<{
      id: string;
      name: string;
      duration_minutes: number;
      price_agorot: number;
    }[]>`
      select id, name, duration_minutes, price_agorot
      from services where active = true
      order by sort_order, name
    `;
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const services = await loadServices();

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-4 pb-16 pt-8">
      <header className="mb-10 text-center">
        <p className="mb-2 text-sm font-medium tracking-wide text-[var(--muted)]">אשדוד · אבנר בן נר</p>
        <h1 className="display text-4xl text-[var(--text)] sm:text-5xl">{SHOP.name}</h1>
        <p className="mt-3 text-[var(--muted)]">בחרו שירות, שעה — וסיימתם</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm">
          <a className="rounded-full border border-[var(--line)] px-4 py-2 text-[var(--text)]" href={`tel:${SHOP.phoneE164}`}>
            {SHOP.phoneDisplay}
          </a>
          <a className="rounded-full border border-[var(--line)] px-4 py-2" href={SHOP.mapsUrl} target="_blank" rel="noreferrer">
            ניווט בגוגל
          </a>
          <a className="rounded-full border border-[var(--line)] px-4 py-2" href={SHOP.wazeUrl} target="_blank" rel="noreferrer">
            Waze
          </a>
        </div>
      </header>

      {services.length === 0 ? (
        <p className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6 text-center text-[var(--muted)]">
          המערכת עדיין לא מחוברת למסד נתונים. הגדירו DATABASE_URL והריצו את המיגרציה.
        </p>
      ) : (
        <BookingFlow services={services} />
      )}

      <footer className="mt-14 text-center text-sm text-[var(--muted)]">
        <p>{SHOP.address}</p>
        <p className="mt-1">
          <a href="/admin" className="underline-offset-2 hover:underline">
            כניסת מנהל
          </a>
        </p>
      </footer>
    </main>
  );
}
