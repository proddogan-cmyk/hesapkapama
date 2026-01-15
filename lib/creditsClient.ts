"use client";

import * as React from "react";

export function getOrCreateLocalUserId(): string {
  try {
    const key = "hk_local_user_id_v1";
    const existing = window.localStorage.getItem(key);
    if (existing && existing.trim()) return existing.trim();
    const id = `local_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
    window.localStorage.setItem(key, id);
    return id;
  } catch {
    return `local_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  }
}

export function formatCredits(n: number): string {
  const v = Math.max(0, Math.floor(Number(n || 0)));
  return v.toLocaleString("tr-TR");
}

export function useCreditBalance(pollMs = 15000) {
  const [balance, setBalance] = React.useState<number | null>(null);

  const refresh = React.useCallback(async () => {
    const localUserId = getOrCreateLocalUserId();
    const res = await fetch("/api/credits/balance", {
      method: "GET",
      headers: localUserId ? { "x-local-user-id": localUserId } : {},
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    setBalance(Number((data as any)?.balance ?? 0));
  }, []);

  React.useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, pollMs);

    const onRefresh = () => refresh();
    window.addEventListener("hk_credits_refresh", onRefresh);

    return () => {
      window.clearInterval(t);
      window.removeEventListener("hk_credits_refresh", onRefresh);
    };
  }, [refresh, pollMs]);

  return { balance, refresh };
}
