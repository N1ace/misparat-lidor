"use client";

import { useState } from "react";

export function CancelActions({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function cancel() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cancel/${token}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "שגיאה");
        return;
      }
      setDone(true);
    } catch {
      setError("שגיאת רשת");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return <p className="mt-6 font-semibold text-[var(--ok)]">התור בוטל</p>;
  }

  return (
    <div className="mt-6 space-y-3">
      {error && <p className="text-red-300">{error}</p>}
      <button
        type="button"
        onClick={cancel}
        disabled={loading}
        className="w-full rounded-xl bg-[var(--accent)] py-3 font-bold text-[#1a0f0a] disabled:opacity-50"
      >
        {loading ? "מבטל…" : "אשרו ביטול"}
      </button>
    </div>
  );
}
