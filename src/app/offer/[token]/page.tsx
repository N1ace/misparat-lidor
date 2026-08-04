import { SHOP } from "@/lib/shop";
import { OfferClient } from "./OfferClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: `הצעת תור · ${SHOP.name}`,
};

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
