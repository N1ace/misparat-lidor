"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ShopSettings } from "@/lib/settings-shared";
import { DEFAULT_SETTINGS } from "@/lib/settings-shared";
import { formatIsraeliPhone } from "@/lib/phone";

const DEFAULTS: ShopSettings = { ...DEFAULT_SETTINGS };

type Tab = "business" | "booking" | "notifications" | "password" | "data";

const TABS: { id: Tab; label: string }[] = [
  { id: "business", label: "עסק" },
  { id: "booking", label: "כללי הזמנה" },
  { id: "notifications", label: "התראות" },
  { id: "password", label: "סיסמה" },
  { id: "data", label: "ניהול נתונים" },
];

const TAB_HEAD: Record<Tab, { title: string; subtitle: string }> = {
  business: {
    title: "עסק",
    subtitle: "שם העסק, טלפון, כתובת ואימייל בעלים.",
  },
  booking: {
    title: "כללי הזמנה",
    subtitle: "קביעת תורים, ביטולים, מבנה היומן ורשימת המתנה.",
  },
  notifications: {
    title: "התראות",
    subtitle: "הודעות ללקוח ותזכורות לפני התור.",
  },
  password: {
    title: "סיסמה",
    subtitle: "שינוי סיסמת מנהל והתנתקות מהמערכת.",
  },
  data: {
    title: "ניהול נתונים",
    subtitle: "מחיקת היסטוריית תורים, רשימת המתנה ובסיס לקוחות.",
  },
};

type PurgeMode = "client_history" | "date_range" | "all_history" | "all_clients" | "all_both";

type PurgeDraft = {
  mode: PurgeMode;
  title: string;
  summary: string;
  clientId?: string;
  from?: string;
  to?: string;
};

type ClientHint = { id: string; name: string; phone: string };

function parseTab(raw: string | null): Tab {
  if (
    raw === "booking" ||
    raw === "notifications" ||
    raw === "password" ||
    raw === "data"
  ) {
    return raw;
  }
  return "business";
}

function SettingField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="admin-setting-field">
      <span className="admin-setting-label">{label}</span>
      {hint ? <span className="admin-setting-hint">{hint}</span> : null}
      {children}
    </label>
  );
}

export function SettingsPanel() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = parseTab(searchParams.get("tab"));

  const [settings, setSettings] = useState<ShopSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pwStep, setPwStep] = useState<"request" | "confirm">("request");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const [purgeClientQ, setPurgeClientQ] = useState("");
  const [purgeHints, setPurgeHints] = useState<ClientHint[]>([]);
  const [purgeClient, setPurgeClient] = useState<ClientHint | null>(null);
  const [purgeFrom, setPurgeFrom] = useState("");
  const [purgeTo, setPurgeTo] = useState("");
  const [purgeDraft, setPurgeDraft] = useState<PurgeDraft | null>(null);
  const [purgeConfirm, setPurgeConfirm] = useState("");
  const [purging, setPurging] = useState(false);

  const head = TAB_HEAD[tab];

  function setTab(next: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "business") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(qs ? `/admin/settings?${qs}` : "/admin/settings");
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      if (res.ok && data.settings) setSettings(data.settings);
    } catch {
      setError("שגיאת טעינה");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setMsg(null);
    setError(null);
  }, [tab]);

  useEffect(() => {
    const q = purgeClientQ.trim();
    if (q.length < 2) {
      setPurgeHints([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      fetch(`/api/admin/clients?suggest=1&q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled) setPurgeHints((data.clients || []) as ClientHint[]);
        })
        .catch(() => {
          if (!cancelled) setPurgeHints([]);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [purgeClientQ]);

  async function save(patch: Partial<ShopSettings>) {
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "שגיאת שמירה");
        return;
      }
      setSettings(data.settings);
      setMsg("נשמר");
      router.refresh();
      window.dispatchEvent(new Event("lidor:shop-changed"));
      window.dispatchEvent(new Event("admin-settings-changed"));
      window.dispatchEvent(new Event("lidor:hours-changed"));
    } catch {
      setError("שגיאת רשת");
    } finally {
      setSaving(false);
    }
  }

  async function requestOtp() {
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "שגיאה");
        return;
      }
      setPwStep("confirm");
      setMsg("נשלח קוד למייל הבעלים");
    } catch {
      setError("שגיאת רשת");
    } finally {
      setSaving(false);
    }
  }

  async function confirmPassword() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", code, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "שגיאה");
        return;
      }
      setMsg("הסיסמה עודכנה");
      setPwStep("request");
      setCode("");
      setPassword("");
    } catch {
      setError("שגיאת רשת");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      await fetch("/api/admin/login", { method: "DELETE" });
      router.replace("/admin/login");
    } catch {
      setError("שגיאת רשת");
    } finally {
      setSaving(false);
    }
  }

  function openPurge(draft: PurgeDraft) {
    setError(null);
    setMsg(null);
    setPurgeConfirm("");
    setPurgeDraft(draft);
  }

  async function runPurge() {
    if (!purgeDraft || purgeConfirm !== "מחק") return;
    setPurging(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/data-purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: purgeDraft.mode,
          confirm: "מחק",
          clientId: purgeDraft.clientId,
          from: purgeDraft.from,
          to: purgeDraft.to,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "שגיאה במחיקה");
        return;
      }
      setMsg(
        `נמחק: ${data.deletedAppointments || 0} תורים, ${data.deletedWaitlist || 0} המתנה, ${data.deletedClients || 0} לקוחות`,
      );
      setPurgeDraft(null);
      setPurgeConfirm("");
      if (purgeDraft.mode === "client_history") {
        setPurgeClient(null);
        setPurgeClientQ("");
      }
    } catch {
      setError("שגיאת רשת");
    } finally {
      setPurging(false);
    }
  }

  if (loading) return <p className="admin-muted">טוען הגדרות…</p>;

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>הגדרות</h1>
          <p>{head.subtitle}</p>
        </div>
      </div>

      <div className="admin-settings-tabs" role="tablist" aria-label="סעיפי הגדרות">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`admin-settings-tab${tab === t.id ? " on" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg ? <p className="admin-ok">{msg}</p> : null}
      {error ? <p className="cal-error">{error}</p> : null}

      {tab === "business" ? (
        <form
          className="admin-card admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save({
              business_name: settings.business_name,
              business_phone: settings.business_phone,
              business_address: settings.business_address,
              owner_email: settings.owner_email,
            });
          }}
        >
          <label>
            <span>שם העסק</span>
            <input
              value={settings.business_name}
              onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
            />
          </label>
          <label>
            <span>טלפון</span>
            <input
              value={settings.business_phone}
              onChange={(e) => setSettings({ ...settings, business_phone: e.target.value })}
            />
          </label>
          <label>
            <span>כתובת</span>
            <input
              value={settings.business_address}
              onChange={(e) => setSettings({ ...settings, business_address: e.target.value })}
            />
          </label>
          <label>
            <span>אימייל בעלים (OTP / התראות)</span>
            <input
              type="email"
              value={settings.owner_email || ""}
              onChange={(e) => setSettings({ ...settings, owner_email: e.target.value || null })}
            />
          </label>
          <button type="submit" className="admin-btn-primary" disabled={saving}>
            {saving ? "שומר…" : "שמור"}
          </button>
        </form>
      ) : null}

      {tab === "booking" ? (
        <form
          className="admin-card admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save({
              online_booking_horizon_days: settings.online_booking_horizon_days,
              manual_booking_horizon_days: settings.manual_booking_horizon_days,
              min_client_cancel_minutes: settings.min_client_cancel_minutes,
              lead_minutes: settings.lead_minutes,
              slot_step_minutes: settings.slot_step_minutes,
              slot_step_by_duration: settings.slot_step_by_duration,
              buffer_minutes: settings.buffer_minutes,
              waitlist_enabled: settings.waitlist_enabled,
            });
          }}
        >
          <section className="admin-settings-section">
            <h2>קביעת תורים</h2>
            <SettingField
              label="עד כמה קדימה לקוח יכול לקבוע (ימים)"
              hint="תאריכים רחוקים יותר לא יופיעו ביומן הציבורי."
            >
              <input
                type="number"
                min={1}
                max={365}
                value={settings.online_booking_horizon_days}
                onChange={(e) =>
                  setSettings({ ...settings, online_booking_horizon_days: Number(e.target.value) })
                }
              />
            </SettingField>
            <SettingField
              label="עד כמה קדימה אתה יכול לקבוע (ימים)"
              hint="חל רק על קביעה ידנית מהניהול."
            >
              <input
                type="number"
                min={1}
                max={730}
                value={settings.manual_booking_horizon_days}
                onChange={(e) =>
                  setSettings({ ...settings, manual_booking_horizon_days: Number(e.target.value) })
                }
              />
            </SettingField>
            <SettingField
              label="זמן מינימלי לפני התור לקביעה (דקות)"
              hint="לקוח לא יוכל לתפוס תור שמתחיל בעוד פחות מזה. קביעה ידנית שלך תמיד עוקפת."
            >
              <input
                type="number"
                min={0}
                max={1440}
                value={settings.lead_minutes}
                onChange={(e) => setSettings({ ...settings, lead_minutes: Number(e.target.value) })}
              />
            </SettingField>
          </section>

          <section className="admin-settings-section">
            <h2>ביטולים</h2>
            <SettingField
              label="עד מתי לקוח יכול לבטל (דקות לפני התור)"
              hint="אחרי זה קישור הביטול מציג את מספר הטלפון שלך במקום כפתור."
            >
              <input
                type="number"
                min={0}
                max={10080}
                value={settings.min_client_cancel_minutes}
                onChange={(e) =>
                  setSettings({ ...settings, min_client_cancel_minutes: Number(e.target.value) })
                }
              />
            </SettingField>
          </section>

          <section className="admin-settings-section">
            <h2>מבנה היומן</h2>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={settings.slot_step_by_duration}
                onChange={(e) =>
                  setSettings({ ...settings, slot_step_by_duration: e.target.checked })
                }
              />
              <span>מרווח תורים לפי משך השירות</span>
            </label>
            <p className="admin-hint">
              כשפעיל — שירות של 30 דק׳ מציע 9:00, 9:30, 10:00 (לא 9:15). אחרי תור ב־9:00, הפנוי
              הבא הוא 9:30.
            </p>
            <SettingField
              label="כל כמה זמן מוצע תור (דקות)"
              hint={
                settings.slot_step_by_duration
                  ? "בשימוש רק כש״לפי משך השירות״ כבוי. קובע מרווח קבוע: 15 → 9:00, 9:15, 9:30."
                  : "קובע את השעות שהלקוח רואה: 15 → 9:00, 9:15, 9:30. לא משך התור."
              }
            >
              <select
                value={settings.slot_step_minutes}
                disabled={settings.slot_step_by_duration}
                onChange={(e) =>
                  setSettings({ ...settings, slot_step_minutes: Number(e.target.value) })
                }
              >
                {[5, 10, 15, 20, 30, 60].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </SettingField>
            <SettingField
              label="זמן ניקיון בין תורים (דקות)"
              hint="נוסף אחרי כל תור וחוסם את היומן."
            >
              <input
                type="number"
                min={0}
                max={120}
                value={settings.buffer_minutes}
                onChange={(e) =>
                  setSettings({ ...settings, buffer_minutes: Number(e.target.value) })
                }
              />
            </SettingField>
          </section>

          <section className="admin-settings-section">
            <h2>רשימת המתנה</h2>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={settings.waitlist_enabled}
                onChange={(e) => setSettings({ ...settings, waitlist_enabled: e.target.checked })}
              />
              <span>רשימת המתנה פעילה</span>
            </label>
            <p className="admin-hint">
              כשהרשימה כבויה — הטאב &quot;רשימת המתנה&quot; מוסתר מהתפריט.
              {settings.waitlist_enabled ? (
                <>
                  {" "}
                  <a href="/admin/waitlist">ניהול רשימת המתנה</a>
                </>
              ) : null}
            </p>
          </section>

          <button type="submit" className="admin-btn-primary" disabled={saving}>
            {saving ? "שומר…" : "שמור"}
          </button>
        </form>
      ) : null}

      {tab === "notifications" ? (
        <div className="admin-settings-stack">
          <form
            className="admin-card admin-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save({
                notify_confirmation: settings.notify_confirmation,
                notify_reminder: settings.notify_reminder,
                notify_cancellation: settings.notify_cancellation,
              });
            }}
          >
            <h2 className="admin-settings-card-title">הודעות ללקוח</h2>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={settings.notify_confirmation}
                onChange={(e) =>
                  setSettings({ ...settings, notify_confirmation: e.target.checked })
                }
              />
              <span>אישור תור</span>
            </label>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={settings.notify_reminder}
                onChange={(e) => setSettings({ ...settings, notify_reminder: e.target.checked })}
              />
              <span>תזכורת</span>
            </label>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={settings.notify_cancellation}
                onChange={(e) =>
                  setSettings({ ...settings, notify_cancellation: e.target.checked })
                }
              />
              <span>ביטול (התראות מערכת / מנהל)</span>
            </label>
            <p className="admin-hint">
              ערוץ ההתראה (SMS או אימייל) נקבע לכל לקוח בנפרד באזור האישי שלו. ביטול מצד הלקוח אינו
              שולח הודעת ביטול; שינוי מועד מצד המנהל כן שולח עדכון.
            </p>
            <p className="admin-hint">
              תבניות ההודעות ניתנות לעריכה ב־
              <a href="/admin/messages">הודעות</a>.
            </p>
            <button type="submit" className="admin-btn-primary" disabled={saving}>
              {saving ? "שומר…" : "שמור הודעות"}
            </button>
          </form>

          <form
            className="admin-card admin-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save({ reminder_hours_before: settings.reminder_hours_before });
            }}
          >
            <h2 className="admin-settings-card-title">תזכורות</h2>
            <SettingField
              label="מתי לשלוח תזכורת (שעות לפני התור)"
              hint="אם התזכורת מופעלת למעלה — תישלח לפי הערוץ המועדף של הלקוח."
            >
              <input
                type="number"
                min={1}
                max={168}
                value={settings.reminder_hours_before}
                onChange={(e) =>
                  setSettings({ ...settings, reminder_hours_before: Number(e.target.value) })
                }
              />
            </SettingField>
            <button type="submit" className="admin-btn-primary" disabled={saving}>
              {saving ? "שומר…" : "שמור תזכורות"}
            </button>
          </form>
        </div>
      ) : null}

      {tab === "password" ? (
        <div className="admin-settings-stack">
          <div className="admin-card admin-form">
            <h2 className="admin-settings-card-title">שינוי סיסמה</h2>
            <p className="admin-hint">שינוי סיסמת מנהל באמצעות קוד OTP למייל הבעלים.</p>
            {pwStep === "request" ? (
              <button
                type="button"
                className="admin-btn-primary"
                disabled={saving}
                onClick={() => void requestOtp()}
              >
                {saving ? "שולח…" : "שלחו קוד למייל"}
              </button>
            ) : (
              <>
                <label>
                  <span>קוד בן 6 ספרות</span>
                  <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" />
                </label>
                <label>
                  <span>סיסמה חדשה (8+)</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="admin-btn-primary"
                  disabled={saving}
                  onClick={() => void confirmPassword()}
                >
                  {saving ? "מעדכן…" : "עדכנו סיסמה"}
                </button>
              </>
            )}
          </div>

          <div className="admin-card admin-form">
            <h2 className="admin-settings-card-title">התנתקות</h2>
            <p className="admin-hint">סיום הסשן הנוכחי וחזרה לדף הכניסה.</p>
            <button
              type="button"
              className="admin-btn-danger"
              disabled={saving}
              onClick={() => void logout()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              התנתקות
            </button>
          </div>
        </div>
      ) : null}

      {tab === "data" ? (
        <div className="admin-settings-stack">
          <div className="admin-card admin-form">
            <h2 className="admin-settings-card-title">מחיקת היסטוריה לפי לקוח</h2>
            <p className="admin-hint">
              מוחק תורים ורשימת המתנה של הלקוח. כרטיס הלקוח נשאר במערכת.
            </p>
            <label>
              <span>חיפוש לקוח</span>
              <input
                value={purgeClientQ}
                onChange={(e) => {
                  setPurgeClientQ(e.target.value);
                  setPurgeClient(null);
                }}
                placeholder="שם או טלפון"
              />
            </label>
            {purgeHints.length ? (
              <ul className="admin-purge-hints">
                {purgeHints.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={purgeClient?.id === c.id ? "on" : ""}
                      onClick={() => {
                        setPurgeClient(c);
                        setPurgeClientQ(c.name);
                        setPurgeHints([]);
                      }}
                    >
                      <strong>{c.name}</strong>
                      <span dir="ltr">{formatIsraeliPhone(c.phone)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {purgeClient ? (
              <p className="admin-hint">
                נבחר: {purgeClient.name} ·{" "}
                <bdi dir="ltr">{formatIsraeliPhone(purgeClient.phone)}</bdi>
              </p>
            ) : null}
            <button
              type="button"
              className="admin-btn-danger"
              disabled={!purgeClient || purging}
              onClick={() =>
                purgeClient &&
                openPurge({
                  mode: "client_history",
                  title: "מחיקת היסטוריית לקוח",
                  summary: `יימחקו כל התורים ורשימת ההמתנה של ${purgeClient.name}. כרטיס הלקוח יישאר.`,
                  clientId: purgeClient.id,
                })
              }
            >
              מחק היסטוריה ללקוח
            </button>
          </div>

          <div className="admin-card admin-form">
            <h2 className="admin-settings-card-title">מחיקת היסטוריה בין תאריכים</h2>
            <p className="admin-hint">
              מוחק תורים החופפים לטווח ורשומות המתנה שתאריך היעד שלהן בטווח.
            </p>
            <div className="admin-row">
              <label>
                <span>מתאריך</span>
                <input type="date" value={purgeFrom} onChange={(e) => setPurgeFrom(e.target.value)} />
              </label>
              <label>
                <span>עד תאריך</span>
                <input type="date" value={purgeTo} onChange={(e) => setPurgeTo(e.target.value)} />
              </label>
            </div>
            <button
              type="button"
              className="admin-btn-danger"
              disabled={!purgeFrom || !purgeTo || purging}
              onClick={() =>
                openPurge({
                  mode: "date_range",
                  title: "מחיקת היסטוריה לפי תאריכים",
                  summary: `יימחקו תורים ורשימת המתנה בין ${purgeFrom} ל־${purgeTo}.`,
                  from: purgeFrom,
                  to: purgeTo,
                })
              }
            >
              מחק היסטוריה בטווח
            </button>
          </div>

          <div className="admin-card admin-form">
            <h2 className="admin-settings-card-title">מחיקה גורפת</h2>
            <p className="admin-hint">פעולות בלתי הפיכות. הקלידו &quot;מחק&quot; בחלון האישור.</p>
            <button
              type="button"
              className="admin-btn-danger"
              disabled={purging}
              onClick={() =>
                openPurge({
                  mode: "all_history",
                  title: "מחיקת כל ההיסטוריה",
                  summary: "יימחקו כל התורים וכל רשומות רשימת ההמתנה. בסיס הלקוחות יישאר.",
                })
              }
            >
              מחק את כל ההיסטוריה
            </button>
            <button
              type="button"
              className="admin-btn-danger"
              disabled={purging}
              onClick={() =>
                openPurge({
                  mode: "all_clients",
                  title: "מחיקת כל הלקוחות",
                  summary: "יימחק כל בסיס הלקוחות. היסטוריית תורים תישאר במערכת.",
                })
              }
            >
              מחק את כל בסיס הלקוחות
            </button>
            <button
              type="button"
              className="admin-btn-danger"
              disabled={purging}
              onClick={() =>
                openPurge({
                  mode: "all_both",
                  title: "מחיקת הכל",
                  summary: "יימחקו כל התורים, רשימת ההמתנה וכל בסיס הלקוחות.",
                })
              }
            >
              מחק היסטוריה ולקוחות
            </button>
          </div>
        </div>
      ) : null}

      {purgeDraft ? (
        <div
          className="cal-modal"
          role="dialog"
          aria-modal="true"
          aria-label={purgeDraft.title}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !purging) {
              setPurgeDraft(null);
              setPurgeConfirm("");
            }
          }}
        >
          <div className="cal-modal-card">
            <div className="cal-modal-head">
              <h2>{purgeDraft.title}</h2>
              <button
                type="button"
                className="cal-icon-btn"
                disabled={purging}
                aria-label="סגור"
                onClick={() => {
                  setPurgeDraft(null);
                  setPurgeConfirm("");
                }}
              >
                ×
              </button>
            </div>
            <div className="cal-modal-body">
              <p className="admin-hint">{purgeDraft.summary}</p>
              <label>
                <span>
                  הקלידו <strong>מחק</strong> לאישור
                </span>
                <input
                  value={purgeConfirm}
                  onChange={(e) => setPurgeConfirm(e.target.value)}
                  autoFocus
                  autoComplete="off"
                />
              </label>
            </div>
            <div className="cal-modal-actions">
              <button
                type="button"
                className="admin-btn-danger"
                disabled={purging || purgeConfirm !== "מחק"}
                onClick={() => void runPurge()}
              >
                {purging ? "מוחק…" : "אישור מחיקה"}
              </button>
              <button
                type="button"
                className="admin-btn-secondary"
                disabled={purging}
                onClick={() => {
                  setPurgeDraft(null);
                  setPurgeConfirm("");
                }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
