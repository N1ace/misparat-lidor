"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NAME_LIMITS, truncateLabel } from "@/lib/name-limits";
import { formatIsraeliPhone } from "@/lib/phone";

export type ClientHint = { id: string; name: string; phone: string };

type Props = {
  phone: string;
  name: string;
  onPhoneChange: (phone: string) => void;
  onNameChange: (name: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
};

type ListBox = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const EDGE = 8;
const GAP = 4;
const MIN_WIDTH = 220;
const EST_ITEM = 48;
const EST_PAD = 12;

function viewportSize() {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  return {
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
    offsetTop: vv?.offsetTop ?? 0,
    offsetLeft: vv?.offsetLeft ?? 0,
  };
}

function placeList(input: DOMRect, listHeight: number): ListBox {
  const vp = viewportSize();
  const width = Math.min(Math.max(input.width, MIN_WIDTH), vp.width - EDGE * 2);

  let left = input.left + vp.offsetLeft;
  // Prefer aligning to the input; clamp so the full width stays on-screen
  if (left + width > vp.offsetLeft + vp.width - EDGE) {
    left = vp.offsetLeft + vp.width - EDGE - width;
  }
  if (left < vp.offsetLeft + EDGE) {
    left = vp.offsetLeft + EDGE;
  }

  const spaceBelow = vp.offsetTop + vp.height - input.bottom - GAP - EDGE;
  const spaceAbove = input.top - vp.offsetTop - GAP - EDGE;
  const placeBelow = spaceBelow >= Math.min(listHeight, 120) || spaceBelow >= spaceAbove;
  const available = Math.max(96, placeBelow ? spaceBelow : spaceAbove);
  const maxHeight = Math.min(listHeight, available, vp.height - EDGE * 2);

  let top: number;
  if (placeBelow) {
    top = input.bottom + GAP;
  } else {
    top = input.top - GAP - maxHeight;
  }
  // Final vertical clamp (keyboard / odd viewports)
  const minTop = vp.offsetTop + EDGE;
  const maxTop = vp.offsetTop + vp.height - EDGE - Math.min(maxHeight, 96);
  top = Math.min(Math.max(top, minTop), Math.max(minTop, maxTop));

  return { top, left, width, maxHeight };
}

export function ClientPhoneSuggest({
  phone,
  name,
  onPhoneChange,
  onNameChange,
  required,
  disabled,
  className,
  inputClassName,
  placeholder = "05X-XXX-XXXX",
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [hints, setHints] = useState<ClientHint[]>([]);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<ListBox | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const updateBox = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const measured = listRef.current?.scrollHeight;
    const estimated = hints.length * EST_ITEM + EST_PAD;
    const listHeight = measured && measured > 0 ? measured : estimated;
    setBox(placeList(r, listHeight));
  }, [hints.length]);

  useLayoutEffect(() => {
    if (!open || !hints.length) return;
    updateBox();
    // Re-measure after paint so real list height is used
    const raf = requestAnimationFrame(() => updateBox());
    const onMove = () => updateBox();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    window.visualViewport?.addEventListener("resize", onMove);
    window.visualViewport?.addEventListener("scroll", onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      window.visualViewport?.removeEventListener("resize", onMove);
      window.visualViewport?.removeEventListener("scroll", onMove);
    };
  }, [open, hints.length, updateBox]);

  useEffect(() => {
    const q = phone.trim();
    if (q.length < 2) {
      setHints([]);
      setOpen(false);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      fetch(`/api/admin/clients?suggest=1&q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          const list = ((data.clients || []) as ClientHint[])
            .slice(0, 8)
            .map((c) => ({ id: c.id, name: c.name, phone: c.phone }));
          setHints(list);
          if (list.length) {
            setOpen(true);
          } else {
            setOpen(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setHints([]);
            setOpen(false);
          }
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [phone]);

  function pick(c: ClientHint) {
    onPhoneChange(c.phone);
    onNameChange(c.name.slice(0, NAME_LIMITS.person));
    setOpen(false);
    setHints([]);
  }

  const list =
    mounted && open && hints.length && box
      ? createPortal(
          <ul
            ref={listRef}
            className="cal-suggest-list cal-suggest-list--portal"
            role="listbox"
            aria-label="לקוחות מהמערכת"
            style={{
              position: "fixed",
              top: box.top,
              left: box.left,
              width: box.width,
              maxHeight: box.maxHeight,
              zIndex: 10000,
              overflowY: "auto",
              overscrollBehavior: "contain",
            }}
          >
            {hints.map((c) => (
              <li key={c.id} role="option">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(c);
                  }}
                >
                  <strong title={c.name}>{truncateLabel(c.name, NAME_LIMITS.person)}</strong>
                  <span dir="ltr">{formatIsraeliPhone(c.phone)}</span>
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div className={className ? `cal-suggest-wrap ${className}` : "cal-suggest-wrap"}>
      <label htmlFor={inputId}>
        <span>טלפון</span>
        <input
          id={inputId}
          ref={inputRef}
          className={inputClassName}
          required={required}
          disabled={disabled}
          value={phone}
          onChange={(e) => {
            onPhoneChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (hints.length) {
              setOpen(true);
              updateBox();
            }
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 180)}
          inputMode="tel"
          placeholder={placeholder}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
        />
      </label>
      <span className="sr-only" aria-live="polite">
        {name ? `שם: ${name}` : ""}
      </span>
      {list}
    </div>
  );
}
