import { getSql } from "@/lib/db";
import { CalendarPlanner } from "@/components/CalendarPlanner";

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

export default async function AdminCalendarPage() {
  const services = await loadServices();
  return <CalendarPlanner services={services} />;
}
