export const TZ = "Asia/Jerusalem";

export const SHOP = {
  name: process.env.SHOP_NAME || process.env.NEXT_PUBLIC_SHOP_NAME || "מספרת לידור",
  phoneE164: process.env.SHOP_PHONE || "+972535301669",
  phoneDisplay: process.env.NEXT_PUBLIC_SHOP_PHONE || "053-530-1669",
  address: process.env.SHOP_ADDRESS || process.env.NEXT_PUBLIC_SHOP_ADDRESS || "אבנר בן נר, אשדוד, ישראל",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("אבנר בן נר אשדוד ישראל"),
  wazeUrl: "https://waze.com/ul?q=" + encodeURIComponent("אבנר בן נר אשדוד"),
};

export const LEAD_MINUTES = 30;
export const SLOT_STEP_MINUTES = 15;
