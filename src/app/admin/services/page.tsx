"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { compressImageFile } from "@/lib/compress-image";
import { NAME_LIMITS, truncateLabel } from "@/lib/name-limits";
import {
  SERVICE_COLORS,
  normalizeServiceColor,
  pickServiceColor,
} from "@/lib/service-colors";
import { IconTrash } from "@/components/icons";

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_agorot: number;
  sort_order: number;
  active: boolean;
  image_path: string | null;
  color: string | null;
};

const emptyForm = {
  name: "",
  duration_minutes: 30,
  price_ils: 80,
  sort_order: 0,
  active: true,
  image_path: "",
  color: SERVICE_COLORS[0] as string,
};

const DURATION_CHIPS = [15, 30, 45, 60] as const;

const PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="112" viewBox="0 0 112 112">
      <rect width="112" height="112" rx="14" fill="#eef1f4"/>
      <rect x="34" y="38" width="44" height="36" rx="6" fill="none" stroke="#94a3b8" stroke-width="2.2"/>
      <circle cx="46" cy="50" r="4" fill="#94a3b8"/>
      <path d="M38 68l12-12 8 8 6-6 10 10" fill="none" stroke="#94a3b8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  );

function IconUpload({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 16V5m0 0l-4 4m4-4l4 4M5 19h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function priceILS(agorot: number) {
  return `₪${(agorot / 100).toFixed(agorot % 100 === 0 ? 0 : 2)}`;
}

function IconEyeOff({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c5 0 9.3 3.1 11 7.5a11.7 11.7 0 01-4.2 5.1M6.1 6.1A11.6 11.6 0 001 12.5C2.7 16.9 7 20 12 20c1.7 0 3.3-.4 4.7-1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconEye({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M1 12.5C2.7 8.1 7 5 12 5s9.3 3.1 11 7.5C21.3 16.9 17 20 12 20S2.7 16.9 1 12.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconPencil({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}



export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/services");
    const data = await res.json();
    setServices(data.services || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return services;
    return services.filter((s) => s.name.toLowerCase().includes(needle));
  }, [services, q]);

  function openAdd() {
    setEditId(null);
    setForm({
      ...emptyForm,
      color: pickServiceColor(services.length),
      sort_order: services.length,
    });
    setLocalPreview(null);
    setError(null);
    setModal("add");
  }

  function openEdit(s: Service) {
    setEditId(s.id);
    setForm({
      name: s.name,
      duration_minutes: s.duration_minutes,
      price_ils: s.price_agorot / 100,
      sort_order: s.sort_order,
      active: s.active,
      image_path: s.image_path || "",
      color: normalizeServiceColor(s.color),
    });
    setLocalPreview(null);
    setError(null);
    setModal("edit");
  }

  async function onPickImage(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("פורמט לא נתמך. השתמשו ב-JPG, PNG או WEBP.");
      return;
    }
    setError(null);
    setUploading(true);
    let previewObjectUrl: string | null = null;
    try {
      let picked = file;
      try {
        picked = await compressImageFile(file);
      } catch {
        picked = file;
      }
      if (picked.size > 5 * 1024 * 1024) {
        setError("הקובץ גדול מדי. עד 5 מגה.");
        return;
      }
      previewObjectUrl = URL.createObjectURL(picked);
      setLocalPreview(previewObjectUrl);

      const body = new FormData();
      body.append("file", picked);
      const res = await fetch("/api/admin/upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "העלאה נכשלה");
        // Keep local preview so the owner can retry / still see the pick
        return;
      }
      setForm((f) => ({ ...f, image_path: data.url as string }));
      // Keep blob preview until server URL is in form; revoke previous only
    } catch {
      setError("שגיאת רשת בהעלאה");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function clearImage() {
    setForm((f) => ({ ...f, image_path: "" }));
    setLocalPreview(null);
  }

  async function toggleActive(s: Service) {
    setMsg(null);
    const res = await fetch("/api/admin/services", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id, active: !s.active }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg(data.error || "שגיאה בעדכון");
      return;
    }
    setMsg(s.active ? "השירות הושבת" : "השירות הופעל");
    await load();
  }

  async function submitModal(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("שם חובה");
      return;
    }
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const payload = {
        name: form.name.trim(),
        duration_minutes: Number(form.duration_minutes) || 30,
        price_agorot: Math.round(Number(form.price_ils) * 100),
        sort_order: Number(form.sort_order) || 0,
        active: form.active,
        image_path: form.image_path.trim() || null,
        color: form.color,
      };
      if (modal === "add") {
        const res = await fetch("/api/admin/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "שגיאה");
          return;
        }
        setMsg("השירות נוסף — יופיע באתר אם הוא פעיל");
      } else if (editId) {
        const res = await fetch("/api/admin/services", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editId, ...payload }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "שגיאה");
          return;
        }
        setMsg("נשמר — המחירון והיומן מתעדכנים מיד");
      }
      setModal(null);
      await load();
    } catch {
      setError("שגיאת רשת");
    } finally {
      setSaving(false);
    }
  }

  async function remove(s: Service) {
    if (!confirm(`למחוק את השירות "${s.name}"?`)) return;
    setMsg(null);
    const res = await fetch(`/api/admin/services?id=${s.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error || "שגיאה במחיקה");
      return;
    }
    setMsg(data.soft ? data.message || "סומן כלא פעיל" : "נמחק מהאתר");
    if (editId === s.id) setModal(null);
    await load();
  }

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>סוגי שירות</h1>
          <p>ניהול שירותים, מחירים, תמונות וצבע ביומן.</p>
        </div>
        <button type="button" className="admin-btn-primary" onClick={openAdd}>
          + שירות חדש
        </button>
      </div>
      {msg ? <p className="admin-ok">{msg}</p> : null}

      <div className="admin-search admin-card" style={{ marginBottom: "1rem" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש לפי שם"
          aria-label="חיפוש לפי שם"
        />
      </div>

      <div className="admin-svc-list">
        {filtered.map((s, idx) => {
          const color = normalizeServiceColor(s.color, idx);
          return (
            <article
              key={s.id}
              className={`admin-svc-row${!s.active ? " inactive" : ""}`}
            >
              <div className="admin-svc-row-stripe" style={{ backgroundColor: color }} aria-hidden />
              <button type="button" className="admin-svc-row-main" onClick={() => openEdit(s)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.image_path || PLACEHOLDER} alt="" className="admin-svc-row-thumb" />
                <div className="admin-svc-row-meta">
                  <div className="admin-svc-row-title">
                    <strong title={s.name}>{truncateLabel(s.name, NAME_LIMITS.service)}</strong>
                    {!s.active ? <span className="admin-svc-badge">מושבת</span> : null}
                  </div>
                  <span>
                    {s.duration_minutes} דק׳ · {priceILS(s.price_agorot)}
                  </span>
                </div>
              </button>
              <div className="admin-svc-row-actions">
                <button
                  type="button"
                  className="admin-icon-btn"
                  title={s.active ? "השבתה" : "הפעלה"}
                  aria-label={s.active ? "השבתה" : "הפעלה"}
                  onClick={() => void toggleActive(s)}
                >
                  {s.active ? <IconEyeOff /> : <IconEye />}
                </button>
                <button
                  type="button"
                  className="admin-icon-btn"
                  title="עריכה"
                  aria-label="עריכה"
                  onClick={() => openEdit(s)}
                >
                  <IconPencil />
                </button>
                <button
                  type="button"
                  className="admin-icon-btn danger"
                  title="מחיקה"
                  aria-label="מחיקה"
                  onClick={() => void remove(s)}
                >
                  <IconTrash size={18} />
                </button>
              </div>
            </article>
          );
        })}
        {!filtered.length ? (
          <p className="admin-muted">{q.trim() ? "אין תוצאות" : "אין שירותים"}</p>
        ) : null}
      </div>

      {modal ? (
        <div
          className="cal-modal"
          role="dialog"
          aria-modal="true"
          aria-label={modal === "add" ? "שירות חדש" : "עריכת שירות"}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <form className="cal-modal-card admin-svc-modal" onSubmit={(e) => void submitModal(e)}>
            <div className="cal-modal-head">
              <h2>{modal === "add" ? "שירות חדש" : "עריכת שירות"}</h2>
              <button type="button" className="cal-icon-btn" onClick={() => setModal(null)} aria-label="סגור">
                ×
              </button>
            </div>
            <div className="cal-modal-body">
              <label>
                <span>שם</span>
                <input
                  required
                  autoFocus={modal === "add"}
                  value={form.name}
                  maxLength={NAME_LIMITS.service}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value.slice(0, NAME_LIMITS.service) })
                  }
                />
              </label>
              <div>
                <span className="admin-field-label">צבע לזיהוי ביומן</span>
                <div className="admin-color-swatches" role="group" aria-label="בחירת צבע">
                  {SERVICE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`admin-color-swatch${form.color === c ? " on" : ""}`}
                      style={{ backgroundColor: c }}
                      aria-label={`צבע ${c}`}
                      aria-pressed={form.color === c}
                      onClick={() => setForm({ ...form, color: c })}
                    />
                  ))}
                </div>
              </div>
              <div className="admin-row admin-svc-metrics">
                <div className="admin-svc-duration">
                  <label>
                    <span>משך (דקות)</span>
                    <input
                      type="number"
                      min={5}
                      required
                      value={form.duration_minutes}
                      onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                    />
                  </label>
                  <div className="admin-duration-chips" role="group" aria-label="משך מהיר">
                    {DURATION_CHIPS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={`admin-duration-chip${form.duration_minutes === m ? " on" : ""}`}
                        onClick={() => setForm({ ...form, duration_minutes: m })}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="admin-svc-price">
                  <span>מחיר (₪)</span>
                  <div className="admin-price-wrap">
                    <span className="admin-price-currency" aria-hidden>
                      ₪
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      required
                      value={form.price_ils}
                      onChange={(e) => setForm({ ...form, price_ils: Number(e.target.value) })}
                    />
                  </div>
                </label>
              </div>
              <div>
                <span className="admin-field-label">תמונה</span>
                <div className="admin-svc-upload">
                  <div className="admin-svc-upload-actions">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="sr-only"
                      id="svc-image-upload"
                      disabled={uploading || saving}
                      onChange={(e) => void onPickImage(e.target.files?.[0] ?? null)}
                    />
                    <label
                      htmlFor="svc-image-upload"
                      className={`admin-upload-pick${uploading || saving ? " is-disabled" : ""}`}
                    >
                      <IconUpload />
                      <span>{uploading ? "מעלה…" : "בחר תמונה"}</span>
                    </label>
                    {form.image_path || localPreview ? (
                      <button
                        type="button"
                        className="admin-danger-link admin-upload-clear"
                        disabled={uploading || saving}
                        onClick={clearImage}
                      >
                        הסרת תמונה
                      </button>
                    ) : null}
                    <p className="admin-muted admin-upload-hint">JPG, PNG או WEBP • עד 5 מגה</p>
                  </div>
                  <div className="admin-svc-modal-preview">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={localPreview || form.image_path.trim() || PLACEHOLDER} alt="" />
                    {uploading ? <div className="admin-svc-upload-busy">מעלה…</div> : null}
                  </div>
                </div>
              </div>
              <label>
                <span>סדר תצוגה</span>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                />
              </label>
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                <span>פעיל באתר ובקביעת תור</span>
              </label>
              {error ? <p className="cal-error">{error}</p> : null}
            </div>
            <div className="cal-modal-actions">
              <button type="submit" className="admin-btn-primary" disabled={saving || uploading}>
                {saving ? "שומר…" : uploading ? "מעלה תמונה…" : modal === "add" ? "הוסף שירות" : "שמירה"}
              </button>
              <button type="button" className="admin-btn-secondary" onClick={() => setModal(null)}>
                ביטול
              </button>
              {modal === "edit" && editId ? (
                <button
                  type="button"
                  className="admin-danger-link"
                  onClick={() => {
                    const s = services.find((x) => x.id === editId);
                    if (s) void remove(s);
                  }}
                >
                  מחק שירות
                </button>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
