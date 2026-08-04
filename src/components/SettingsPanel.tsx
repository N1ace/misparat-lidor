"use client";

import { useCallback, useEffect, useState } from "react";
import type { ShopSettings } from "@/lib/settings";

const DEFAULTS: ShopSettings = {
  business_name: "מספרת לידור",
  business_phone: "053-530-1669",
  business_address: "אבנר בן נר 1, אשדוד",
  owner_email: null,
  online_booking_horizon_days: 30,
  manual_booking_horizon_days: 90,
  min_client_cancel_minutes: 60,
  lead_minutes: 30,
  slot_step_minutes: 15,
  buffer_minutes: 0,
  notify_confirmation: true,
  notify_reminder: true,
  notify_cancellation: true,
  waitlist_enabled: true,
};

type Tab = "business" | "booking" | "notifications" | "password";

const TABS: { id: Tab; label: string }[] = [
  { id: "business", label: "עסק" },
  { id: "booking", label: "כללי הזמנה" },
  { id: "notifications", label: "התראות" },
  { id: "password", label: "סיסמה" },
];

export function SettingsPanel() {
  const [tab, setTab] = useState<Tab>("business");
  const [settings, setSettings] = useState<ShopSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pwStep, setPwStep] = useState<"request" | "confirm">("request");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

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

  if (loading) return <p className="admin-muted">טוען הגדרות…</p>;

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>הגדרות</h1>
          <p>פרטי עסק, כללי הזמנה, התראות וחשבון.</p>
        </div>
        <a href="/admin/hours" className="cal-chip">
          שעות פתיחה
        </a>
      </div>

      <div className="admin-tabs cal-seg" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "on" : undefined}
            onClick={() => {
              setTab(t.id);
              setMsg(null);
              setError(null);
            }}
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
              buffer_minutes: settings.buffer_minutes,
              waitlist_enabled: settings.waitlist_enabled,
            });
          }}
        >
          <label>
            <span>אופק הזמנה אונליין (ימים)</span>
            <input
              type="number"
              min={1}
              max={365}
              value={settings.online_booking_horizon_days}
              onChange={(e) =>
                setSettings({ ...settings, online_booking_horizon_days: Number(e.target.value) })
              }
            />
          </label>
          <label>
            <span>אופק הזמנה ידנית (ימים)</span>
            <input
              type="number"
              min={1}
              max={730}
              value={settings.manual_booking_horizon_days}
              onChange={(e) =>
                setSettings({ ...settings, manual_booking_horizon_days: Number(e.target.value) })
              }
            />
          </label>
          <label>
            <span>חלון ביטול מינימלי ללקוח (דקות)</span>
            <input
              type="number"
              min={0}
              max={10080}
              value={settings.min_client_cancel_minutes}
              onChange={(e) =>
                setSettings({ ...settings, min_client_cancel_minutes: Number(e.target.value) })
              }
            />
          </label>
          <label>
            <span>זמן הובלה (דקות לפני תור)</span>
            <input
              type="number"
              min={0}
              max={1440}
              value={settings.lead_minutes}
              onChange={(e) => setSettings({ ...settings, lead_minutes: Number(e.target.value) })}
            />
          </label>
          <label>
            <span>מרווח סלוטים (דקות)</span>
            <select
              value={settings.slot_step_minutes}
              onChange={(e) => setSettings({ ...settings, slot_step_minutes: Number(e.target.value) })}
            >
              {[5, 10, 15, 20, 30, 60].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>באפר בין תורים (דקות)</span>
            <input
              type="number"
              min={0}
              max={120}
              value={settings.buffer_minutes}
              onChange={(e) => setSettings({ ...settings, buffer_minutes: Number(e.target.value) })}
            />
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={settings.waitlist_enabled}
              onChange={(e) => setSettings({ ...settings, waitlist_enabled: e.target.checked })}
            />
            <span>רשימת המתנה פעילה</span>
          </label>
          <button type="submit" className="admin-btn-primary" disabled={saving}>
            {saving ? "שומר…" : "שמור"}
          </button>
        </form>
      ) : null}

      {tab === "notifications" ? (
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
          <label className="admin-check">
            <input
              type="checkbox"
              checked={settings.notify_confirmation}
              onChange={(e) => setSettings({ ...settings, notify_confirmation: e.target.checked })}
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
              onChange={(e) => setSettings({ ...settings, notify_cancellation: e.target.checked })}
            />
            <span>ביטול</span>
          </label>
          <p className="admin-hint">
            ערוץ ההתראה (SMS או אימייל) נקבע לכל לקוח בנפרד באזור האישי שלו.
            ביטול מצד הלקוח אינו שולח הודעת ביטול; שינוי מועד מצד המנהל כן שולח עדכון.
          </p>
          <p className="admin-hint">
            תבניות ההודעות ניתנות לעריכה ב־
            <a href="/admin/messages">הודעות</a>.
          </p>
          <button type="submit" className="admin-btn-primary" disabled={saving}>
            {saving ? "שומר…" : "שמור"}
          </button>
        </form>
      ) : null}

      {tab === "password" ? (
        <div className="admin-card admin-form">
          <p className="admin-hint">שינוי סיסמת מנהל באמצעות קוד OTP למייל הבעלים.</p>
          {pwStep === "request" ? (
            <button type="button" className="admin-btn-primary" disabled={saving} onClick={() => void requestOtp()}>
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
      ) : null}
    </div>
  );
}
