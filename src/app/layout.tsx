import type { Metadata, Viewport } from "next";
import { Heebo, Rubik } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  weight: ["400", "500", "600", "700", "800"],
});

const rubik = Rubik({
  subsets: ["hebrew", "latin"],
  variable: "--font-rubik",
  weight: ["700", "800", "900"],
});

export const metadata: Metadata = {
  title: "מספרת לידור — קביעת תור",
  description: "קביעת תור אונליין במספרת לידור, אבנר בן נר אשדוד",
};

export const viewport: Viewport = {
  themeColor: "#0d0e10",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${rubik.variable}`}>
      <body
        className="antialiased"
        style={
          {
            ["--font-body" as string]: "var(--font-heebo), system-ui, sans-serif",
            ["--font-display" as string]: "var(--font-rubik), var(--font-heebo), system-ui, sans-serif",
          } as React.CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
