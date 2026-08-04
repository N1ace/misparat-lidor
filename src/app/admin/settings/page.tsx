import { Suspense } from "react";
import { SettingsPanel } from "@/components/SettingsPanel";

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<p className="admin-muted">טוען הגדרות…</p>}>
      <SettingsPanel />
    </Suspense>
  );
}
