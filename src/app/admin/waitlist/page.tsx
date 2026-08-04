import { getSql } from "@/lib/db";
import { WaitlistPanel } from "@/components/WaitlistPanel";

export const dynamic = "force-dynamic";

export default async function AdminWaitlistPage() {
  const sql = getSql();
  const services = await sql<{ id: string; name: string }[]>`
    select id, name from services where active = true order by sort_order, name
  `;
  return <WaitlistPanel services={services} />;
}
