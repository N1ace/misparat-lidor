"use client";

import { useCallback, useEffect, useState } from "react";
import { TimeSelect24 } from "@/components/TimeSelect24";
import { ClientPhoneSuggest } from "@/components/ClientPhoneSuggest";
import { IconPhone, IconTrash } from "@/components/icons";
import { NAME_LIMITS, truncateLabel } from "@/lib/name-limits";
import { formatInTimeZone } from "date-fns-tz";

type Service = { id: string; name: string };

type Entry = {
  id: string;
  client_name: string;
  client_phone: string;
  service_id: string | null;
  service_name: string | null;
  target_date: string | null;
  any_time?: boolean;
  windows?: { start: string; end: string }[];
  status: string;
  seq?: number;
  created_at: string;
};

function formatPreferredDate(value: string | null) {
  if (!value) return "";
  const raw = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const [y, m, d] = raw.split("-");
  return `${d}/${m}/${y}`;
}

const emptyForm = {
  name: "",
  phone: "",
  serviceId: "",
  preferredDate: "",
  notes: "",
  anyTime: true,
  prefStart: "10:00",
  prefEnd: "14:00",
};

function slotLabel(iso: string) {
  try {
    return formatInTimeZone(iso, "Asia/Jerusalem", "HH:mm");
  } catch {
    return iso;
  }
}

export function WaitlistPanel({ services }: { services: Service[] }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [modal, setModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    const [w, s] = await Promise.all([fetch("/api/admin/waitlist"), fetch("/api/admin/settings")]);
    const wd = await w.json();
    const sd = await s.json();
    setEntries(wd.entries || []);
    if (sd.settings) setEnabled(!!sd.settings.waitlist_enabled);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

  function openAdd() {
    setForm(emptyForm);
    setError(null);
    setModal(true);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const windows = form.anyTime
        ? undefined
        : [{ start: form.prefStart, end: form.prefEnd }];
      const payload = {
        client_name: form.name,
        client_phone: form.phone,
        service_id: form.serviceId,
        target_date: form.preferredDate,
        any_time: form.anyTime,
        windows,
        notes: form.notes || undefined,
      };
      let res = await fetch("/api/admin/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let data = await res.json();
      if (res.status === 409 && (data.code === "open_slots" || data.code === "has_slots")) {
        const times = (data.slots as string[] | undefined)?.map(slotLabel).join(", ") || "";
        const ok = window.confirm(
          `${data.error || "יש תור פנוי"}${times ? `\nשעות פנויות: ${times}` : ""}\n\nלהוסיף לרשימת ההמתנה בכל זאת?`,
        );
        if (!ok) {
          setError(data.error || "יש תור פנוי בחלון שבחרתם");
          return;
        }
        res = await fetch("/api/admin/waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, force: true }),
        });
        data = await res.json();
      }
      if (!res.ok) {
        setError(data.error || "שגיאה בהוספה");
        return;
      }
      setModal(false);
      setMsg("נוסף לרשימת ההמתנה");
      await load();
    } catch {
      setError("שגיאת רשת");
    } finally {
      setSaving(false);
    }
  }

  async function remove(entry: Entry) {
    if (!confirm(`להסיר את ${entry.client_name} מרשימת ההמתנה?`)) return;
    setError(null);
    setMsg(null);
    const res = await fetch(`/api/admin/waitlist?id=${entry.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "שגיאה בהסרה");
      return;
    }
    setMsg("הוסר מרשימת ההמתנה");
    await load();
  }

  async function manualOffer(entry: Entry) {
    const raw = prompt("שעת הצעה (HH:MM) בתאריך היעד — למשל 17:00");
    if (!raw) return;
    const hm = raw.trim();
    if (!/^\d{1,2}:\d{2}$/.test(hm) || !entry.target_date) {
      setError("שעה או תאריך לא תקינים");
      return;
    }
    const [h, m] = hm.split(":").map(Number);
    const isoGuess = `${entry.target_date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+03:00`;
    setError(null);
    const res = await fetch("/api/admin/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry.id, offer_start: isoGuess }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "הצעה נכשלה");
      return;
    }
    setMsg("הצעה נשלחה");
    await load();
  }

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>רשימת המתנה</h1>
          <p>FIFO אוטומטי כשמתפנה תור · הצעה ידנית ללקוח ספציפי.</p>
        </div>
        {enabled ? (
          <button type="button" className="admin-btn-primary" onClick={openAdd}>
            + הוסף לרשימה
          </button>
        ) : null}
      </div>

      {!enabled ? (
        <div className="admin-card admin-form">
          <p className="admin-hint" style={{ marginTop: 0 }}>
            רשימת ההמתנה כבויה. אפשר להפעיל אותה מחדש ב־
            <a href="/admin/settings?tab=booking">כללי הזמנה</a>.
          </p>
        </div>
      ) : null}
      {msg ? <p className="admin-ok">{msg}</p> : null}
      {error && !modal ? <p className="cal-error">{error}</p> : null}

      {enabled ? (
        <div className="admin-entity-grid">
          {entries.map((e) => (
            <article key={e.id} className="admin-entity-card">
              <div className="admin-entity-main" style={{ cursor: "default" }}>
                <strong title={e.client_name}>
                  {truncateLabel(e.client_name, NAME_LIMITS.person)}
                </strong>
                <span className="admin-entity-meta" dir="ltr">
                  {e.client_phone}
                </span>
                {e.service_name ? (
                  <span className="admin-entity-meta" title={e.service_name}>
                    {truncateLabel(e.service_name, NAME_LIMITS.service)}
                  </span>
                ) : null}
                {e.target_date ? (
                  <span className="admin-entity-meta">
                    יעד: {formatPreferredDate(e.target_date)}
                    {e.any_time
                      ? " · כל היום"
                      : e.windows?.length
                        ? ` · ${e.windows.map((w) => `${w.start}–${w.end}`).join(", ")}`
                        : ""}
                  </span>
                ) : null}
                <span className="admin-badge">
                  {e.status === "waiting" ? "ממתין" : e.status === "offered" ? "הוצע תור" : e.status}
                </span>
              </div>
              <div className="admin-entity-actions admin-entity-actions-wrap">
                {e.status === "waiting" ? (
                  <button type="button" className="cal-chip" onClick={() => void manualOffer(e)}>
                    הצע תור
                  </button>
                ) : null}
                <a
                  className="admin-action-icon"
                  href={`tel:${e.client_phone}`}
                  title="חיוג"
                  aria-label="חיוג"
                >
                  <IconPhone />
                </a>
                <button
                  type="button"
                  className="admin-action-icon danger"
                  title="הסרה"
                  aria-label="הסרה"
                  onClick={() => void remove(e)}
                >
                  <IconTrash />
                </button>
              </div>
            </article>
          ))}
          {!entries.length ? <p className="admin-muted">אין אנשים ברשימת ההמתנה</p> : null}
        </div>
      ) : null}

      {modal && enabled ? (
        <div
          className="cal-modal"
          role="dialog"
          aria-modal="true"
          aria-label="הוספה לרשימת המתנה"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) setModal(false);
          }}
        >
          <form className="cal-modal-card" onSubmit={(ev) => void add(ev)}>
            <div className="cal-modal-head">
              <h2>הוספה לרשימת המתנה</h2>
              <button type="button" className="cal-chip" onClick={() => setModal(false)}>
                סגור
              </button>
            </div>
            <div className="cal-modal-body">
              <ClientPhoneSuggest
                phone={form.phone}
                name={form.name}
                onPhoneChange={(phone) => setForm((f) => ({ ...f, phone }))}
                onNameChange={(name) => setForm((f) => ({ ...f, name }))}
                required
              />
              <label>
                <span>שם</span>
                <input
                  required
                  value={form.name}
                  maxLength={NAME_LIMITS.person}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value.slice(0, NAME_LIMITS.person) })
                  }
                />
              </label>
              <label>
                <span>שירות</span>
                <select
                  required
                  value={form.serviceId}
                  onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
                >
                  <option value="">בחרו שירות</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>תאריך יעד</span>
                <input
                  required
                  type="date"
                  value={form.preferredDate}
                  onChange={(e) => setForm({ ...form, preferredDate: e.target.value })}
                />
              </label>
              <label className="admin-check-row">
                <input
                  type="checkbox"
                  checked={form.anyTime}
                  onChange={(e) => setForm({ ...form, anyTime: e.target.checked })}
                />
                <span>כל שעות היום</span>
              </label>
              {!form.anyTime ? (
                <div className="admin-row">
                  <label>
                    <span>משעה מועדפת</span>
                    <TimeSelect24
                      value={form.prefStart}
                      onChange={(v) => setForm({ ...form, prefStart: v })}
                    />
                  </label>
                  <label>
                    <span>עד שעה</span>
                    <TimeSelect24
                      value={form.prefEnd}
                      onChange={(v) => setForm({ ...form, prefEnd: v })}
                    />
                  </label>
                </div>
              ) : null}
              <label>
                <span>הערות</span>
                <textarea
                  value={form.notes}
                  maxLength={NAME_LIMITS.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value.slice(0, NAME_LIMITS.notes) })
                  }
                />
              </label>
              {error ? <p className="cal-error">{error}</p> : null}
            </div>
            <div className="cal-modal-actions">
              <button type="submit" className="admin-btn-primary" disabled={saving}>
                {saving ? "שומר…" : "שמירה"}
              </button>
              <button type="button" className="admin-btn-secondary" onClick={() => setModal(false)}>
                ביטול
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
