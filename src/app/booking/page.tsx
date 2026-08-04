import { getSql } from "@/lib/db";
import { SHOP } from "@/lib/shop";
import { getShopSettings } from "@/lib/settings";
import { ClientPortal } from "@/components/ClientPortal";
import type { BookingService } from "@/components/BookingFlow";
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
  searchParams: Promise<{ service?: string; tab?: string }>;
}) {
  const { service: preselect, tab } = await searchParams;
  const [services, settings] = await Promise.all([loadServices(), getShopSettings()]);

  return (
    <>
      <div className="pole-strip spin" aria-hidden="true" />
      <main className="client-portal-page">
        <div className="wrap client-portal-shell">
          <ClientPortal
            services={services}
            horizonDays={settings.online_booking_horizon_days}
            initialTab={tab}
            initialService={preselect}
          />
        </div>
      </main>
    </>
  );
}
