"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { StoreProvider, useAppStore, useStoreActions } from "@/lib/store";
import { Logo } from "@/components/Logo";
import { MobileNav } from "@/components/MobileNav";
import { BottomActionBar } from "@/components/BottomActionBar";
import { AppGate } from "@/components/AppGate";
import { Fade } from "@/components/Fade";
import { PageTransition } from "@/components/PageTransition";
import { CloudSync } from "@/components/CloudSync";
import { useCreditBalance, formatCredits } from "@/lib/creditsClient";

/**
 * NOTE:
 * Bu layout, Clerk yüklenemediği (veya dev ortamında auth devre dışı kaldığı) senaryolarda
 * uygulamanın "boş ekran" kalmaması için NO-AUTH (local userId) modunda çalışır.
 * İleride tekrar Clerk entegrasyonuna dönebiliriz; şu an öncelik UI'nin ayağa kalkması.
 */

function getOrCreateLocalUserId() {
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

function Header() {
  const profile = useAppStore((s) => s.profile);
  const { balance } = useCreditBalance(15000);

  const headerText = profile
    ? profile.bizType === "company"
      ? profile.companyName || "Şirket"
      : `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "Hesap Kapama"
    : "Hesap Kapama";

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/app" className="inline-flex items-center gap-3">
            <Logo />
            <div className="text-sm font-semibold text-slate-100">{headerText}</div>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200">
            Kredi: {balance == null ? "…" : formatCredits(balance)}
          </div>
          <Link
            href="/app/account"
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
          >
            Hesabım
          </Link>
        </div>
      </div>
    </header>
  );
}

function AdvanceSync() {
  const profile = useAppStore((s) => s.profile);
  const projects = useAppStore((s) => s.projects);
  const { addTransaction, addProject } = useStoreActions();

  const inFlight = React.useRef(false);

  const userName = React.useMemo(() => {
    const fn = String((profile as any)?.firstName ?? "").trim();
    const ln = String((profile as any)?.lastName ?? "").trim();
    return `${fn} ${ln}`.trim();
  }, [profile]);

  const norm = React.useCallback((s: string) => String(s || "").trim().toLowerCase(), []);

  const ensureProjectId = React.useCallback(
    (projectName: string) => {
      const name = String(projectName || "").trim();
      if (!name) return "";

      const found = projects.find((p) => String(p?.name ?? "").trim().toLowerCase() === name.toLowerCase());
      if (found?.id) return found.id;

      const id = (addProject as any)(name);
      return String(id || "");
    },
    [projects, addProject]
  );

  const sync = React.useCallback(async () => {
    if (!userName) return;
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      const qs = new URLSearchParams({ userName });
      const res = await fetch(`/api/advance/sync?${qs.toString()}`, { method: "GET", cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) return;

      const items = Array.isArray(data.items) ? data.items : [];
      if (!items.length) return;

      const appliedIds: string[] = [];

      for (const it of items) {
        const projectName = String(it?.projectName ?? "").trim() || "Genel";
        const amount = Number(it?.amount ?? 0);
        if (!Number.isFinite(amount) || amount <= 0) continue;

        const projectId = ensureProjectId(projectName);
        if (!projectId) continue;

        const fromName = String(it?.fromName ?? "").trim();
        const toName = String(it?.toName ?? "").trim();

        const isSender = norm(userName) === norm(fromName);
        const isReceiver = norm(userName) === norm(toName);
        if (!isSender && !isReceiver) continue;

        (addTransaction as any)({
          projectId,
          ts: Number(it?.acceptedAt ?? Date.now()),
          kind: isSender ? "expense" : "income",
          subtype: isSender ? "advance_out" : "advance_in",
          category: "AVANS",
          who: isSender ? toName : fromName,
          description: String(it?.note ?? "").trim() || (isSender ? "Avans verdim" : "Avans aldım"),
          amount,
        });

        appliedIds.push(String(it?.id ?? ""));
      }

      if (appliedIds.length) {
        await fetch("/api/advance/mark", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userName, ids: appliedIds }),
        }).catch(() => null);
      }
    } finally {
      inFlight.current = false;
    }
  }, [userName, norm, ensureProjectId, addTransaction]);

  React.useEffect(() => {
    sync();
    const onFocus = () => sync();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [sync]);

  return null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [fallbackId, setFallbackId] = React.useState<string>("");

  React.useEffect(() => {
    setFallbackId(getOrCreateLocalUserId());
  }, []);

  // Prefer Clerk user when available; otherwise fallback to local user
  const userId = auth.isLoaded && auth.userId ? auth.userId : fallbackId;

  if (!userId) return <div className="min-h-screen bg-slate-950" />;

  return (
    <StoreProvider userId={userId}>
      <div className="min-h-screen bg-slate-950">
        <CloudSync userId={userId} />
        <Header />
        <AdvanceSync />
        <main className="mx-auto max-w-3xl px-6 pb-32 pt-6">
          <AppGate>
            <PageTransition>
              <Fade>{children}</Fade>
            </PageTransition>
          </AppGate>
        </main>
        <BottomActionBar />
        <MobileNav />
      </div>
    </StoreProvider>
  );
}
