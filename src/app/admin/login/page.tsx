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
    <main
      className="flex min-h-dvh items-center justify-center overflow-y-auto"
      style={{
        background: "#f4f5f7",
        color: "#1f2933",
        padding:
          "max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))",
      }}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-[#e8eaed] bg-white p-6 shadow-sm sm:p-8"
        style={{ minWidth: 0 }}
      >
        <h1 className="text-center text-2xl font-extrabold">כניסת מנהל</h1>
        <p className="mt-2 text-center text-sm text-[#6b7280]">מספרת לידור</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-8 w-full rounded-xl border border-[#e8eaed] bg-[#f9fafb] px-4 py-3 outline-none focus:border-[#ef7a3d]"
          placeholder="סיסמה"
          autoFocus
        />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-4 w-full rounded-xl bg-[#ef7a3d] py-3 font-bold text-white disabled:opacity-50"
        >
          {loading ? "נכנס…" : "כניסה"}
        </button>
      </form>
    </main>
  );
}
