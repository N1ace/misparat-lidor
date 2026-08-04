import { Suspense } from "react";
import { AdminShell } from "@/components/AdminShell";
import "@/styles/admin.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="admin-app admin-app--loading">טוען…</div>}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
