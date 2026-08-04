import { AdminNav } from "@/components/AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-20 pt-6">
      <AdminNav />
      {children}
    </div>
  );
}
