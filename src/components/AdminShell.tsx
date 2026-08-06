"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useLiveShop } from "@/hooks/useLiveShop";
import { SHOP } from "@/lib/shop";

type NavItem = {
  href: string;
  label: string;
  icon: "grid" | "calendar" | "users" | "sparkles" | "block" | "list" | "gear" | "clock" | "bell" | "key" | "shop";
};

const PRIMARY: NavItem[] = [
  { href: "/admin", label: "לוח בקרה", icon: "grid" },
  { href: "/admin/calendar", label: "יומן", icon: "calendar" },
  { href: "/admin/clients", label: "לקוחות", icon: "users" },
];

const MANAGE_BASE: NavItem[] = [
  { href: "/admin/services", label: "שירותים", icon: "sparkles" },
  { href: "/admin/hours", label: "שעות פעילות", icon: "clock" },
  { href: "/admin/closures", label: "סגירות וחופשות", icon: "block" },
];

const SETTINGS_NAV: NavItem[] = [
  { href: "/admin/settings", label: "הגדרות", icon: "gear" },
];

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
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "gear":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 7H3s3 0 3-7" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
      );
    case "key":
      return (
        <svg {...common}>
          <circle cx="8" cy="15" r="4" />
          <path d="M11.5 12.5L20 4m0 0h-4m4 0v4" />
        </svg>
      );
    case "shop":
      return (
        <svg {...common}>
          <path d="M4 10h16l-1 10H5L4 10z" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      );
  }
}

function navItemActive(pathname: string, _search: string, item: NavItem) {
  const [path] = item.href.split("?");
  if (path === "/admin") return pathname === "/admin";
  if (path === "/admin/settings") {
    return pathname.startsWith("/admin/settings");
  }
  return pathname === path || pathname.startsWith(path + "/");
}

function NavLink({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() || "";
  const on = navItemActive(pathname, search, item);

  return (
    <Link
      href={item.href}
      className={`admin-nav-link${on ? " on" : ""}`}
      onClick={onNavigate}
    >
      <span className="admin-nav-ico">
        <Icon name={item.icon} />
      </span>
      <span className="admin-nav-label">{item.label}</span>
    </Link>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const shop = useLiveShop(SHOP);
  const path = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [waitlistEnabled, setWaitlistEnabled] = useState(true);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    closeDrawer();
  }, [path, closeDrawer]);

  useEffect(() => {
    let cancelled = false;
    function loadWaitlistFlag() {
      fetch("/api/admin/settings")
        .then((r) => r.json())
        .then((data) => {
          if (cancelled || !data.settings) return;
          setWaitlistEnabled(!!data.settings.waitlist_enabled);
        })
        .catch(() => {
          /* keep default */
        });
    }
    loadWaitlistFlag();
    const onChanged = () => loadWaitlistFlag();
    window.addEventListener("admin-settings-changed", onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("admin-settings-changed", onChanged);
    };
  }, [path]);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen, closeDrawer]);

  if (path === "/admin/login") return <>{children}</>;

  const manage: NavItem[] = [
    ...MANAGE_BASE,
    ...(waitlistEnabled
      ? [{ href: "/admin/waitlist", label: "רשימת המתנה", icon: "list" as const }]
      : []),
  ];

  const nav = (
    <>
      <div className="admin-brand">
        <span className="admin-brand-mark" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
        </span>
        <div>
          <strong>{shop.name}</strong>
          <span>מספרה · יש תור</span>
        </div>
      </div>

      <nav className="admin-nav" aria-label="תפריט ניהול">
        {PRIMARY.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={closeDrawer} />
        ))}
        <div className="admin-nav-sep" />
        <p className="admin-nav-group">ניהול</p>
        {manage.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={closeDrawer} />
        ))}
        <div className="admin-nav-sep" />
        <p className="admin-nav-group">הגדרות</p>
        {SETTINGS_NAV.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={closeDrawer} />
        ))}
      </nav>
    </>
  );

  return (
    <div className={`admin-app${drawerOpen ? " drawer-open" : ""}`}>
      <aside className="admin-sidebar admin-sidebar--desktop" aria-label="ניווט">
        {nav}
      </aside>

      <div
        className={`admin-drawer-backdrop${drawerOpen ? " on" : ""}`}
        onClick={closeDrawer}
        aria-hidden={!drawerOpen}
      />
      <aside
        className={`admin-sidebar admin-sidebar--drawer${drawerOpen ? " on" : ""}`}
        aria-hidden={!drawerOpen}
        id="admin-mobile-nav"
      >
        <div className="admin-drawer-head">
          <span>תפריט</span>
          <button type="button" className="admin-drawer-close" onClick={closeDrawer} aria-label="סגור תפריט">
            ×
          </button>
        </div>
        {nav}
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-menu-btn"
            aria-label="פתח תפריט"
            aria-expanded={drawerOpen}
            aria-controls="admin-mobile-nav"
            onClick={() => setDrawerOpen(true)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <div className="admin-topbar-shop">{shop.name}</div>
        </header>
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
