"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "שגיאה");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("שגיאת רשת");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="display text-center text-3xl">כניסת מנהל</h1>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3"
          placeholder="סיסמה"
          autoFocus
        />
        {error && <p className="text-red-300">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[var(--accent)] py-3 font-bold text-[#1a0f0a]"
        >
          {loading ? "נכנס…" : "כניסה"}
        </button>
      </form>
    </main>
  );
}
