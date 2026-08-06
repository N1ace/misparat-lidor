"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveShop } from "@/hooks/useLiveShop";
import type { ShopPublic } from "@/lib/shop";

const LANDING_LINKS = [
  { href: "/#services", label: "מחירון" },
  { href: "/#our-shop", label: "המספרה" },
  { href: "/#gallery", label: "עבודות" },
  { href: "/#faq", label: "שאלות" },
  { href: "/#location", label: "איפה אנחנו" },
];

export function SiteHeader({
  solid = false,
  shop: shopProp,
}: {
  solid?: boolean;
  shop?: ShopPublic;
}) {
  const shop = useLiveShop(shopProp);
  const [scrolled, setScrolled] = useState(solid);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (solid) return;
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [solid]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className={`site${scrolled || solid ? " solid" : ""}`} id="top">
      <div className="wrap bar">
        <Link className="logo" href="/" aria-label={`${shop.name} — לדף הבית`}>
          <span className="icn i-pole" aria-hidden="true" />
          {shop.name}
        </Link>
        <nav className="main" aria-label="ניווט ראשי">
          {LANDING_LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
          <Link href="/booking">קביעת תור</Link>
        </nav>
        <div className="head-actions">
          <a className="head-phone phone-ltr" href={`tel:${shop.phoneE164}`}>
            <bdi>{shop.phoneDisplay}</bdi>
          </a>
          <Link className="btn btn-primary" href="/booking">
            קביעת תור
          </Link>
        </div>
        <button
          className="menu-btn"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? "סגירת תפריט" : "פתיחת תפריט"}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>
      <div id="mobile-menu" className={menuOpen ? "open" : undefined}>
        {LANDING_LINKS.map((l) => (
          <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}>
            {l.label}
          </a>
        ))}
        <Link href="/booking" onClick={() => setMenuOpen(false)}>
          קביעת תור
        </Link>
      </div>
    </header>
  );
}
