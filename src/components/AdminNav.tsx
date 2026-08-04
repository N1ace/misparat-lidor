"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "היום" },
  { href: "/admin/week", label: "שבוע" },
  { href: "/admin/services", label: "שירותים" },
  { href: "/admin/hours", label: "שעות" },
  { href: "/admin/messages", label: "הודעות" },
  { href: "/admin/password", label: "סיסמה" },
];

export function AdminNav() {
  const path = usePathname();
  if (path === "/admin/login") return null;

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-[var(--line)] pb-4">
      {links.map((l) => {
        const on = path === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-full px-3 py-2 text-sm font-semibold ${
              on ? "bg-[var(--accent)] text-[#1a0f0a]" : "border border-[var(--line)]"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
      <button
        type="button"
        className="mr-auto rounded-full border border-[var(--line)] px-3 py-2 text-sm"
        onClick={async () => {
          await fetch("/api/admin/login", { method: "DELETE" });
          window.location.href = "/admin/login";
        }}
      >
        יציאה
      </button>
    </nav>
  );
}
