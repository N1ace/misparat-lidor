import { getLiveShop } from "@/lib/settings";
import { OfferClient } from "./OfferClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getLiveShop();
  return { title: `הצעת תור · ${shop.name}` };
}

export default async function OfferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="client-portal-page">
      <div className="wrap client-portal-shell">
        <OfferClient token={token} />
      </div>
    </main>
  );
}
