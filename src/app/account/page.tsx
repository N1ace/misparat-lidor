import { getSql } from "@/lib/db";
import { SHOP } from "@/lib/shop";
import { getShopSettings } from "@/lib/settings";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AccountApp } from "./AccountApp";
import type { BookingService } from "@/components/BookingFlow";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `אזור אישי · ${SHOP.name}`,
  description: `התורים, ההמתנה וההגדרות שלכם ב${SHOP.name}`,
};

async function loadServices(): Promise<BookingService[]> {
  try {
    const sql = getSql();
    return await sql<BookingService[]>`
      select id, name, duration_minutes, price_agorot, image_path
      from services where active = true
      order by sort_order, name
    `;
  } catch {
    return [];
  }
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const [services, settings] = await Promise.all([loadServices(), getShopSettings()]);

  return (
    <>
      <div className="pole-strip spin" aria-hidden="true" />
      <SiteHeader solid />
      <main className="booking-page account-page">
        <div className="wrap booking-shell">
          <header style={{ marginBlockEnd: "1.25rem", textAlign: "center" }}>
            <h1 style={{ marginBlock: "0.35rem 0.35rem" }}>אזור אישי</h1>
            <p style={{ color: "var(--muted)", margin: 0 }}>תורים, הגדרות ויצירת קשר</p>
          </header>
          <AccountApp
            services={services}
            horizonDays={settings.online_booking_horizon_days}
            initialTab={tab}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
