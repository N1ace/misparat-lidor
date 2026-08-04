"use client";

import { useEffect } from "react";
import { DAY_NAMES, HOURS } from "@/lib/shop";

function fmtTime(m: number) {
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

type DayWin = { openMins: number; closeMins: number };
type ByDay = Record<number, DayWin[]>;

function fallbackByDay(): ByDay {
  const out: ByDay = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (let d = 0; d <= 6; d++) {
    const h = HOURS[d];
    if (h) out[d] = [{ openMins: h[0], closeMins: h[1] }];
  }
  return out;
}

function applyOpenChip(byDay: ByDay) {
  const chip = document.getElementById("openChip");
  const txt = document.getElementById("openChipText");
  if (!chip || !txt) return;

  const now = new Date();
  const d = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  const today = byDay[d] || [];
  const openWin = today.find((w) => mins >= w.openMins && mins < w.closeMins);

  chip.classList.remove("closed");
  if (openWin) {
    txt.innerHTML = `פתוח עכשיו · עד <bdi>${fmtTime(openWin.closeMins)}</bdi>`;
    return;
  }

  chip.classList.add("closed");
  const laterToday = today.find((w) => mins < w.openMins);
  if (laterToday) {
    txt.innerHTML = `סגור · נפתח היום ב־<bdi>${fmtTime(laterToday.openMins)}</bdi>`;
    return;
  }

  for (let i = 1; i <= 7; i++) {
    const nd = (d + i) % 7;
    const h = (byDay[nd] || [])[0];
    if (h) {
      const when = i === 1 ? "מחר" : `ביום ${DAY_NAMES[nd]}`;
      txt.innerHTML = `סגור · נפתח ${when} ב־<bdi>${fmtTime(h.openMins)}</bdi>`;
      break;
    }
  }
}

export function LandingEffects() {
  useEffect(() => {
    document.documentElement.classList.add("js");

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting || e.boundingClientRect.top < 0) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.25, rootMargin: "0px 0px -8% 0px" },
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));

    let sweep: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(sweep);
      sweep = setTimeout(() => {
        document.querySelectorAll("[data-reveal]:not(.in)").forEach((el) => {
          if (el.getBoundingClientRect().top < 0) {
            el.classList.add("in");
            io.unobserve(el);
          }
        });
      }, 120);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const mobile = document.querySelector<HTMLVideoElement>(".hero .bg-mobile");
    const desktop = document.querySelector<HTMLVideoElement>(".hero .bg-desktop");
    const mq = window.matchMedia("(min-width:900px)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncVideo = () => {
      if (!mobile || !desktop) return;
      if (reduce.matches) {
        mobile.pause();
        desktop.pause();
        mobile.removeAttribute("src");
        desktop.removeAttribute("src");
        mobile.load();
        desktop.load();
        return;
      }
      if (mq.matches) {
        mobile.pause();
        if (mobile.getAttribute("src")) {
          mobile.removeAttribute("src");
          mobile.load();
        }
        const src = desktop.dataset.src;
        if (src && desktop.getAttribute("src") !== src) desktop.src = src;
        desktop.play().catch(() => {});
      } else {
        desktop.pause();
        if (desktop.getAttribute("src")) {
          desktop.removeAttribute("src");
          desktop.load();
        }
        const src = mobile.dataset.src;
        if (src && mobile.getAttribute("src") !== src) mobile.src = src;
        mobile.play().catch(() => {});
      }
    };
    syncVideo();
    mq.addEventListener("change", syncVideo);
    reduce.addEventListener("change", syncVideo);

    applyOpenChip(fallbackByDay());
    fetch("/api/hours")
      .then((r) => r.json())
      .then((data) => {
        if (data?.byDay) applyOpenChip(data.byDay);
      })
      .catch(() => {
        /* keep fallback */
      });

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      mq.removeEventListener("change", syncVideo);
      reduce.removeEventListener("change", syncVideo);
      clearTimeout(sweep);
    };
  }, []);

  return null;
}
