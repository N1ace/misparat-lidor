import { redirect } from "next/navigation";

/** Legacy URL — client area now lives at /booking */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; service?: string }>;
}) {
  const { tab, service } = await searchParams;
  const params = new URLSearchParams();
  if (tab) params.set("tab", tab);
  if (service) params.set("service", service);
  const q = params.toString();
  redirect(q ? `/booking?${q}` : "/booking");
}
