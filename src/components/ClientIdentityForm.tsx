"use client";

import { useState } from "react";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { NAME_LIMITS } from "@/lib/name-limits";

export type ClientInfo = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notify_channel: "sms" | "email";
};

type Props = {
  onAuthenticated: (client: ClientInfo) => void;
  title?: string;
  submitLabel?: string;
};

export function ClientIdentityForm({
  onAuthenticated,
  title = "פרטי הזיהוי",
  submitLabel = "המשך",
}: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [testCode, setTestCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function identify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const deviceId = getOrCreateDeviceId();
      const res = await fetch("/api/client/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, deviceId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "שגיאה");
        return;
      }
      if (data.loggedIn && data.client) {
        onAuthenticated(data.client as ClientInfo);
        return;
      }
      if (data.needsOtp) {
        const otpRes = await fetch("/api/client/otp/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            phone,
            channel,
            email: channel === "email" || email ? email : undefined,
          }),
        });
        const otpData = await otpRes.json();
        if (!otpRes.ok) {
          setError(otpData.error || "שליחת הקוד נכשלה");
          return;
        }
        setOtpSent(true);
        if (typeof otpData.testCode === "string") {
          setTestCode(otpData.testCode);
          setCode(otpData.testCode);
        }
        return;
      }
      setError("לא ניתן להמשיך");
    } catch {
      setError("שגיאת רשת");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const deviceId = getOrCreateDeviceId();
      const res = await fetch("/api/client/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, deviceId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "קוד שגוי");
        return;
      }
      if (data.client) onAuthenticated(data.client as ClientInfo);
      else setError("התחברות נכשלה");
    } catch {
      setError("שגיאת רשת");
    } finally {
      setBusy(false);
    }
  }

  if (otpSent) {
    return (
      <form onSubmit={verifyOtp} className="bf-identity">
        <h2>{title}</h2>
        <p className="bf-muted">
          נשלח קוד אימות ל{channel === "sms" ? "טלפון" : "אימייל"}. הזינו אותו כאן.
        </p>
        {testCode ? (
          <p className="account-ok" style={{ margin: 0 }}>
            מצב בדיקה — הקוד הוא <strong dir="ltr">{testCode}</strong>
          </p>
        ) : null}
        <label>
          <span>קוד אימות</span>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            placeholder="000000"
          />
        </label>
        {error && <p className="err">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: "100%" }}>
          {busy ? "מאמת…" : "אמת והמשך"}
        </button>
        <button
          type="button"
          className="bf-link-btn"
          onClick={() => {
            setOtpSent(false);
            setTestCode(null);
            setCode("");
            setError(null);
          }}
        >
          חזרה
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={identify} className="bf-identity">
      <h2>{title}</h2>
      <label>
        <span>שם מלא</span>
        <input
          required
          value={name}
          maxLength={NAME_LIMITS.person}
          onChange={(e) => setName(e.target.value.slice(0, NAME_LIMITS.person))}
          autoComplete="name"
        />
      </label>
      <label>
        <span>טלפון</span>
        <input
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          autoComplete="tel"
          placeholder="05X-XXX-XXXX"
        />
      </label>
      <fieldset className="bf-channel">
        <legend>איך לקבל קוד ואישורים</legend>
        <label className="bf-radio">
          <input
            type="radio"
            name="channel"
            checked={channel === "sms"}
            onChange={() => setChannel("sms")}
          />
          SMS
        </label>
        <label className="bf-radio">
          <input
            type="radio"
            name="channel"
            checked={channel === "email"}
            onChange={() => setChannel("email")}
          />
          אימייל
        </label>
      </fieldset>
      <label>
        <span>{channel === "email" ? "אימייל (חובה)" : "אימייל (אופציונלי)"}</span>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="email"
          dir="ltr"
          required={channel === "email"}
        />
      </label>
      {error && <p className="err">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: "100%" }}>
        {busy ? "בודק…" : submitLabel}
      </button>
    </form>
  );
}
