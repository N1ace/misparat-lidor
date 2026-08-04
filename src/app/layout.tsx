import type { Metadata, Viewport } from "next";
import { Assistant, Karantina } from "next/font/google";
import "./globals.css";

const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  variable: "--font-assistant",
  weight: ["400", "600", "700"],
});

const karantina = Karantina({
  subsets: ["hebrew", "latin"],
  variable: "--font-karantina",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "מספרת לידור — אשדוד",
  description: "תספורות מדויקות באבנר בן נר 1, אשדוד. קביעת תור אונליין.",
};

export const viewport: Viewport = {
  themeColor: "#0F1613",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${assistant.variable} ${karantina.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
