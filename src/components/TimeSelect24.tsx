"use client";

import { useMemo } from "react";
import { generateTimeOptions, normalizeHhmm, optionsWithValue, pad2 } from "@/lib/time-format";

type Props = {
  value: string;
  onChange: (hhmm: string) => void;
  stepMinutes?: number;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
  /** Two compact hour/minute selects with a colon (booking-style UI). */
  split?: boolean;
};

/** Native-looking select that always shows 24h HH:mm (no AM/PM). */
export function TimeSelect24({
  value,
  onChange,
  stepMinutes = 15,
  required,
  disabled,
  id,
  className,
  split,
  ...rest
}: Props) {
  const options = useMemo(() => {
    const base = generateTimeOptions(stepMinutes);
    return optionsWithValue(base, value);
  }, [stepMinutes, value]);

  const normalized = normalizeHhmm(value);
  const [hourPart, minutePart] = normalized.split(":");

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => pad2(i)), []);
  const minutes = useMemo(() => {
    const step = Math.max(1, Math.min(30, stepMinutes));
    const list: string[] = [];
    for (let m = 0; m < 60; m += step) list.push(pad2(m));
    if (!list.includes(minutePart)) list.push(minutePart);
    return list.sort();
  }, [stepMinutes, minutePart]);

  if (split) {
    return (
      <div
        className={className ? `cal-time-split ${className}` : "cal-time-split"}
        dir="ltr"
        role="group"
        aria-label={rest["aria-label"] || "שעה"}
      >
        <select
          id={id}
          className="time-select-24"
          required={required}
          disabled={disabled}
          value={hourPart}
          aria-label="שעות"
          onChange={(e) => onChange(normalizeHhmm(`${e.target.value}:${minutePart}`))}
        >
          {hours.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="cal-time-split-sep" aria-hidden>
          :
        </span>
        <select
          className="time-select-24"
          required={required}
          disabled={disabled}
          value={minutePart}
          aria-label="דקות"
          onChange={(e) => onChange(normalizeHhmm(`${hourPart}:${e.target.value}`))}
        >
          {minutes.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <select
      id={id}
      className={className ? `time-select-24 ${className}` : "time-select-24"}
      dir="ltr"
      required={required}
      disabled={disabled}
      value={normalized}
      onChange={(e) => onChange(normalizeHhmm(e.target.value))}
      aria-label={rest["aria-label"]}
    >
      {options.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}
