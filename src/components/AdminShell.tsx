"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SHOP } from "@/lib/shop";

type NavItem = {
  href: string;
  label: string;
  icon: "grid" | "calendar" | "users" | "sparkles" | "block" | "list" | "gear";
};

const PRIMARY: NavItem[] = [
  { href: "/admin", label: "לוח בקרה", icon: "grid" },
  { href: "/admin/calendar", label: "יומן", icon: "calendar" },
  { href: "/admin/clients", label: "לקוחות", icon: "users" },
];

const MANAGE: NavItem[] = [
  { href: "/admin/services", label: "שירותים", icon: "sparkles" },
  { href: "/admin/closures", label: "סגירות וחופשות", icon: "block" },
  { href: "/admin/waitlist", label: "רשימת המתנה", icon: "list" },
];

const BOTTOM: NavItem[] = [{ href: "/admin/settings", label: "הגדרות", icon: "gear" }];

function Icon({ name }: { name: NavItem["icon"] }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  switch (name) {
    case "grid":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="3.5" />
          <path d="M22 21v-2a3.5 3.5 0 0 0-2.5-3.35M16.5 3.7a3.5 3.5 0 0 1 0 6.6" />
        </svg>
      );
    case "sparkles":
      return (
        <svg {...common}>
          <path d="M12 3l1.2 4.2L17.5 8.5 13.2 9.8 12 14l-1.2-4.2L6.5 8.5l4.3-1.3L12 3z" />
          <path d="M19 14l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14z" />
        </svg>
      );
    case "block":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4M9 15l6 0M12 12v6" />
        </svg>
      );
    case "list":
      return (
        <svg {...common}>
          <path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />
        </svg>
      );
    case "gear":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
        </svg>
      );
  }
}

function NavLink({ item }: { item: NavItem }) {
  const path = usePathname();
  const on =
    item.href === "/admin"
      ? path === "/admin"
      : path === item.href || path.startsWith(item.href + "/");

  return (
    <Link href={item.href} className={`admin-nav-link${on ? " on" : ""}`}>
      <span className="admin-nav-ico">
        <Icon name={item.icon} />
      </span>
      <span>{item.label}</span>
    </Link>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/admin/login") return <>{children}</>;

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    window.location.href = "/admin/login";
  }

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
          </span>
          <div>
            <strong>{SHOP.name}</strong>
            <span>מספרה · יש תור</span>
          </div>
        </div>

        <nav className="admin-nav" aria-label="תפריט ניהול">
          {PRIMARY.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
          <div className="admin-nav-sep" />
          {MANAGE.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
          <div className="admin-nav-sep" />
          {BOTTOM.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-shop">{SHOP.name}</div>
          <div className="admin-topbar-actions">
            <span className="admin-pill">
              <span className="admin-pill-dot" aria-hidden="true" />
              מחובר/ת כ־admin (מנהל ראשי)
            </span>
            <button type="button" className="admin-topbar-btn" onClick={logout}>
              התנתקות
            </button>
          </div>
        </header>
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
