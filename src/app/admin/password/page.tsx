"use client";

import { useState } from "react";

export default function AdminPasswordPage() {
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestOtp() {
    setLoading(true);
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
      setStep("confirm");
      setMsg("נשלח קוד למייל הבעלים");
    } catch {
      setError("שגיאת רשת");
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    setLoading(true);
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
      setStep("request");
      setCode("");
      setPassword("");
    } catch {
      setError("שגיאת רשת");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="display text-3xl">שינוי סיסמה</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">נשלח קוד OTP למייל הבעלים (Resend)</p>

      {step === "request" ? (
        <button
          type="button"
          onClick={requestOtp}
          disabled={loading}
          className="mt-6 rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-[#1a0f0a]"
        >
          {loading ? "שולח…" : "שלחו קוד למייל"}
        </button>
      ) : (
        <div className="mt-6 max-w-sm space-y-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="קוד בן 6 ספרות"
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3"
            inputMode="numeric"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="סיסמה חדשה (8+)"
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3"
          />
          <button
            type="button"
            onClick={confirm}
            disabled={loading}
            className="w-full rounded-xl bg-[var(--accent)] py-3 font-bold text-[#1a0f0a]"
          >
            {loading ? "מעדכן…" : "עדכנו סיסמה"}
          </button>
        </div>
      )}

      {msg && <p className="mt-4 text-[var(--ok)]">{msg}</p>}
      {error && <p className="mt-4 text-red-300">{error}</p>}
    </div>
  );
}
