import { getSql } from "@/lib/db";
import { SHOP } from "@/lib/shop";
import { getShopSettings } from "@/lib/settings";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BookingFlow, type BookingService } from "@/components/BookingFlow";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `קביעת תור · ${SHOP.name}`,
  description: `קביעת תור אונליין ב${SHOP.name}, ${SHOP.addressShort}`,
};

async function loadServices(): Promise<BookingService[]> {
  try {
    const sql = getSql();
    return await sql<BookingService[]>`
      select id, name, duration_minutes, price_agorot, image_path
      from services where active = true
      order by sort_order, name
    `;
  } catch (e) {
    console.error("[booking] loadServices failed:", e);
    return [];
  }
}

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const services = await loadServices();
  const { service: preselect } = await searchParams;
  const settings = await getShopSettings();

  return (
    <>
      <div className="pole-strip spin" aria-hidden="true" />
      <SiteHeader solid />
      <main className="booking-page">
        <div className="wrap booking-shell">
          <header style={{ marginBlockEnd: "1.75rem", textAlign: "center" }}>
            <p className="kicker" style={{ color: "var(--brass)", fontWeight: 700, margin: 0 }}>
              {SHOP.addressShort}
            </p>
            <h1 style={{ marginBlock: "0.35rem 0.5rem" }}>קבע תור</h1>
            <p style={{ color: "var(--muted)", margin: 0 }}>בחרו שירות, יום ושעה — וסיימתם</p>
          </header>

          {services.length === 0 ? (
            <p
              style={{
                border: "1px solid var(--line)",
                background: "var(--surface)",
                borderRadius: "var(--radius)",
                padding: "1.5rem",
                textAlign: "center",
                color: "var(--muted)",
              }}
            >
              המערכת עדיין לא מחוברת למסד נתונים. הגדירו DATABASE_URL והריצו את המיגרציה.
            </p>
          ) : (
            <BookingFlow
              services={services}
              initialService={preselect}
              horizonDays={settings.online_booking_horizon_days}
            />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
