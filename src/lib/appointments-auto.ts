import { getSql } from "./db";

/** Mark past confirmed appointments as done when their end time has passed. */
export async function autoCompletePastAppointments(): Promise<number> {
  const sql = getSql();
  const rows = await sql<{ id: string }[]>`
    update appointments
    set status = 'done'
    where status = 'confirmed'
      and upper(period) < now()
    returning id
  `;
  return rows.length;
}
