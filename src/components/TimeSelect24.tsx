"use client";

import { useMemo } from "react";
import { generateTimeOptions, normalizeHhmm, optionsWithValue } from "@/lib/time-format";

type Props = {
  value: string;
  onChange: (hhmm: string) => void;
  stepMinutes?: number;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
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
  ...rest
}: Props) {
  const options = useMemo(() => {
    const base = generateTimeOptions(stepMinutes);
    return optionsWithValue(base, value);
  }, [stepMinutes, value]);

  const normalized = normalizeHhmm(value);

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
