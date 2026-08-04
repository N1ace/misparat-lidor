"use client";

import { useEffect, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";

type Msg = {
  id: string;
  kind: string;
  channel: string;
  recipient: string;
  status: string;
  attempts: number;
  send_after: string;
  sent_at: string | null;
  last_error: string | null;
  client_name: string | null;
  service_name: string | null;
};

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState<Msg[]>([]);

  useEffect(() => {
    fetch("/api/admin/messages")
      .then((r) => r.json())
      .then((d) => setMessages(d.messages || []));
  }, []);

  return (
    <div>
      <h1 className="display text-3xl">הודעות</h1>
      <ul className="mt-6 space-y-3">
        {messages.length === 0 && <p className="text-[var(--muted)]">אין הודעות</p>}
        {messages.map((m) => (
          <li key={m.id} className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-bold">
                {m.kind} · {m.channel} · {m.status}
              </span>
              <span className="text-[var(--muted)]" dir="ltr">
                {formatInTimeZone(m.send_after, "Asia/Jerusalem", "dd/MM HH:mm")}
              </span>
            </div>
            <p className="mt-1">
              {m.client_name || "—"} · {m.service_name || ""}
            </p>
            <p className="mt-1 text-[var(--muted)]" dir="ltr">
              {m.recipient}
            </p>
            {m.last_error && <p className="mt-1 text-red-300">{m.last_error}</p>}
            <p className="mt-1 text-[var(--muted)]">ניסיונות: {m.attempts}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
