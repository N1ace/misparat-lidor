/** Shared max lengths so long strings cannot break mobile layouts. */
export const NAME_LIMITS = {
  /** Person / client display names */
  person: 40,
  /** Service titles */
  service: 40,
  /** Appointment / free-text notes */
  notes: 200,
  /** Waitlist / closure short labels */
  label: 60,
} as const;

export type NameLimitKey = keyof typeof NAME_LIMITS;

/** Truncate for display; existing long DB values still ellipsize safely. */
export function truncateLabel(value: string | null | undefined, max: number): string {
  const text = (value ?? "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

/** Clamp on write (forms / API). */
export function clampName(value: string | null | undefined, max: number): string {
  return (value ?? "").trim().slice(0, max);
}
