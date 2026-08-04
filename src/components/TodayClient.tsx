"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { TimeSelect24 } from "@/components/TimeSelect24";

type Appt = {
  id: string;
  service_name: string;
  client_name: string;
  client_phone: string;
  status: string;
  start: string;
  end: string;
  notes: string | null;
};

type Service = { id: string; name: string; duration_minutes: number };

export function TodayClient({
  initial,
  services,
  todayYmd,
}: {
  initial: Appt[];
  services: Service[];
  todayYmd: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [showBlock, setShowBlock] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [blockStart, setBlockStart] = useState("12:00");
  const [blockEnd, setBlockEnd] = useState("13:00");
  const [blockReason, setBlockReason] = useState("");
  const [addService, setAddService] = useState(services[0]?.id ?? "");
  const [addTime, setAddTime] = useState("10:00");
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function setStatus(id: string, status: string) {
    const res = await fetch("/api/admin/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      router.refresh();
    }
  }

  async function createBlock() {
    setMsg(null);
    const res = await fetch("/api/admin/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dateYmd: todayYmd,
        startTime: blockStart,
        endTime: blockEnd,
        reason: blockReason,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "שגיאה");
      return;
    }
    setShowBlock(false);
    setMsg("הזמן נחסם");
    router.refresh();
  }

  async function addWalkIn() {
    setMsg(null);
    const res = await fetch("/api/admin/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: addService,
        dateYmd: todayYmd,
        startTime: addTime,
        name: addName,
        phone: addPhone,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "שגיאה");
      return;
    }
    setShowAdd(false);
    setAddName("");
    setAddPhone("");
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowBlock((v) => !v)}
          className="rounded-xl border border-[var(--line)] px-4 py-3 font-semibold"
        >
          חסימת זמן
        </button>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="rounded-xl bg-[var(--accent)] px-4 py-3 font-bold text-[#1a0f0a]"
        >
          הוספת תור
        </button>
      </div>

      {msg && <p className="text-sm text-[var(--muted)]">{msg}</p>}

      {showBlock && (
        <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
          <div className="flex gap-2">
            <TimeSelect24 value={blockStart} onChange={setBlockStart} className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2" />
            <TimeSelect24 value={blockEnd} onChange={setBlockEnd} className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2" />
          </div>
          <input
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="סיבה (אופציונלי)"
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
          />
          <button type="button" onClick={createBlock} className="rounded-xl bg-[var(--accent)] px-4 py-2 font-bold text-[#1a0f0a]">
            חסום
          </button>
        </div>
      )}

      {showAdd && (
        <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
          <select value={addService} onChange={(e) => setAddService(e.target.value)} className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2">
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <TimeSelect24 value={addTime} onChange={setAddTime} className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 w-full" />
          <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="שם" className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2" />
          <input value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="טלפון" className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2" />
          <button type="button" onClick={addWalkIn} className="rounded-xl bg-[var(--accent)] px-4 py-2 font-bold text-[#1a0f0a]">
            שמור תור
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6 text-[var(--muted)]">אין תורים היום</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((a) => {
            const time = formatInTimeZone(a.start, "Asia/Jerusalem", "HH:mm");
            const end = formatInTimeZone(a.end, "Asia/Jerusalem", "HH:mm");
            return (
              <li key={a.id} className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="display text-2xl leading-none">
                      {time}
                      <span className="text-base font-medium text-[var(--muted)]">–{end}</span>
                    </p>
                    <p className="mt-2 text-lg font-bold">{a.client_name}</p>
                    <p className="text-[var(--muted)]">{a.service_name}</p>
                    <a className="mt-1 inline-block text-[var(--accent)]" href={`tel:${a.client_phone}`}>
                      {a.client_phone}
                    </a>
                    {a.status !== "confirmed" && (
                      <p className="mt-1 text-sm text-[var(--muted)]">{a.status === "done" ? "בוצע" : a.status === "no_show" ? "לא הגיע" : a.status}</p>
                    )}
                  </div>
                  {a.status === "confirmed" && (
                    <div className="flex flex-col gap-2">
                      <button type="button" onClick={() => setStatus(a.id, "done")} className="rounded-xl bg-[var(--ok)] px-4 py-3 font-bold text-[#071a0e]">
                        בוצע
                      </button>
                      <button type="button" onClick={() => setStatus(a.id, "no_show")} className="rounded-xl border border-[var(--line)] px-4 py-3">
                        לא הגיע
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
