"use client";

import { useCallback, useEffect, useState } from "react";
import { SHOP, type ShopPublic } from "@/lib/shop";

/** Live shop profile from admin business settings; falls back to SHOP defaults. */
export function useLiveShop(initial?: ShopPublic) {
  const [shop, setShop] = useState<ShopPublic>(initial || SHOP);

  const reload = useCallback(() => {
    fetch("/api/shop")
      .then((r) => r.json())
      .then((data) => {
        if (data?.shop) setShop(data.shop as ShopPublic);
      })
      .catch(() => {
        /* keep current */
      });
  }, []);

  useEffect(() => {
    if (!initial) reload();
    const onChange = () => reload();
    window.addEventListener("lidor:shop-changed", onChange);
    window.addEventListener("focus", onChange);
    return () => {
      window.removeEventListener("lidor:shop-changed", onChange);
      window.removeEventListener("focus", onChange);
    };
  }, [initial, reload]);

  useEffect(() => {
    if (initial) setShop(initial);
  }, [initial]);

  return shop;
}
