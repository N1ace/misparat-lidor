import { formatIsraeliPhone, normalizePhoneIL } from "./phone";

export const TZ = "Asia/Jerusalem";

export type ShopPublic = {
  name: string;
  phoneE164: string;
  phoneDisplay: string;
  address: string;
  addressShort: string;
  mapsUrl: string;
  mapsEmbed: string;
  wazeUrl: string;
  googleReviewsUrl: string;
  easyUrl: string;
};

/** Env / hardcoded fallbacks when DB settings are missing. */
export const SHOP: ShopPublic = {
  name: process.env.SHOP_NAME || process.env.NEXT_PUBLIC_SHOP_NAME || "מספרת לידור",
  phoneE164: process.env.SHOP_PHONE || "+972535301669",
  phoneDisplay: process.env.NEXT_PUBLIC_SHOP_PHONE || "053-530-1669",
  address: process.env.SHOP_ADDRESS || process.env.NEXT_PUBLIC_SHOP_ADDRESS || "אבנר בן נר 1, אשדוד, ישראל",
  addressShort: "אבנר בן נר 1, אשדוד",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("אבנר בן נר 1 אשדוד ישראל"),
  mapsEmbed:
    "https://maps.google.com/maps?q=" +
    encodeURIComponent("אבנר בן נר 1 אשדוד") +
    "&z=16&output=embed",
  wazeUrl: "https://waze.com/ul?q=" + encodeURIComponent("אבנר בן נר 1 אשדוד") + "&navigate=yes",
  googleReviewsUrl: "https://share.google/fbusxyxJ85Lt4AFYS",
  easyUrl: "https://easy.co.il/page/10119386",
};

/** Build public shop profile from admin business settings (DB). */
export function buildShopPublic(input?: {
  business_name?: string | null;
  business_phone?: string | null;
  business_address?: string | null;
}): ShopPublic {
  const name = (input?.business_name || "").trim() || SHOP.name;
  const phoneRaw = (input?.business_phone || "").trim() || SHOP.phoneDisplay;
  const phoneE164 = normalizePhoneIL(phoneRaw) || SHOP.phoneE164;
  const phoneDisplay = formatIsraeliPhone(phoneRaw) || SHOP.phoneDisplay;
  const addressShort = (input?.business_address || "").trim() || SHOP.addressShort;
  const address = /ישראל/i.test(addressShort) ? addressShort : `${addressShort}, ישראל`;
  const mapsQuery = addressShort.replace(/\s*,\s*ישראל\s*$/i, "").trim() || addressShort;

  return {
    name,
    phoneE164,
    phoneDisplay,
    address,
    addressShort,
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(`${mapsQuery} ישראל`),
    mapsEmbed:
      "https://maps.google.com/maps?q=" + encodeURIComponent(mapsQuery) + "&z=16&output=embed",
    wazeUrl: "https://waze.com/ul?q=" + encodeURIComponent(mapsQuery) + "&navigate=yes",
    googleReviewsUrl: SHOP.googleReviewsUrl,
    easyUrl: SHOP.easyUrl,
  };
}

/** Website fallback / first-seed hours. Live site + booking use DB `working_hours` (admin editable). */
export const HOURS: Record<number, [number, number] | null> = {
  0: [540, 1260], // Sun 09:00–21:00
  1: [600, 1260], // Mon 10:00–21:00
  2: [540, 1260], // Tue 09:00–21:00
  3: [540, 1260], // Wed 09:00–21:00
  4: [540, 1320], // Thu 09:00–22:00
  5: [480, 960], // Fri 08:00–16:00
  6: null, // Sat closed
};

export const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export function waMe(text?: string, shop: ShopPublic = SHOP) {
  const digits = shop.phoneE164.replace(/\D/g, "");
  const base = `https://wa.me/${digits}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export const LEAD_MINUTES = 30;
export const SLOT_STEP_MINUTES = 15;
