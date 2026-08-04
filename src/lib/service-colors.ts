/** Preset palette for service identification on the planner. */
export const SERVICE_COLORS = [
  "#E28140",
  "#CC6E30",
  "#A85724",
  "#3E8E9E",
  "#2FA56A",
  "#E2A23A",
  "#D6453F",
  "#6B6660",
  "#E9AB78",
  "#4A4641",
] as const;

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function isValidServiceColor(value: string | null | undefined): boolean {
  return typeof value === "string" && HEX_RE.test(value);
}

export function pickServiceColor(index: number): string {
  return SERVICE_COLORS[index % SERVICE_COLORS.length];
}

export function normalizeServiceColor(
  value: string | null | undefined,
  fallbackIndex = 0,
): string {
  if (isValidServiceColor(value)) return value!;
  return pickServiceColor(fallbackIndex);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function serviceTextOnColor(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#1e293b" : "#ffffff";
}

export function serviceTintStyle(hex: string): {
  backgroundColor: string;
  color: string;
  borderColor: string;
} {
  const color = normalizeServiceColor(hex);
  const { r, g, b } = hexToRgb(color);
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.16)`,
    color,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.4)`,
  };
}
