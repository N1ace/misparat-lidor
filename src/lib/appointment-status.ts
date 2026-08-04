export type ApptStatus = "confirmed" | "done" | "cancelled" | "no_show";

export const APPT_STATUS_LABEL: Record<ApptStatus, string> = {
  confirmed: "מאושר",
  done: "בוצע",
  cancelled: "בוטל",
  no_show: "לא הגיע",
};

export const APPT_STATUS_OPTIONS: { value: ApptStatus; label: string }[] = [
  { value: "confirmed", label: "מאושר" },
  { value: "done", label: "בוצע" },
  { value: "cancelled", label: "בוטל" },
  { value: "no_show", label: "לא הגיע" },
];

export function isApptStatus(v: string): v is ApptStatus {
  return v === "confirmed" || v === "done" || v === "cancelled" || v === "no_show";
}

export function statusLabel(status: string): string {
  return isApptStatus(status) ? APPT_STATUS_LABEL[status] : status;
}
