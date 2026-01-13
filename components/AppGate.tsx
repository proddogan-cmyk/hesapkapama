"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAppStore, useStoreActions } from "@/lib/store";

export function AppGate({ children }: { children: React.ReactNode }) {
  const profile = useAppStore((s) => s.profile);
  const router = useRouter();
  const { setProfile } = useStoreActions();

  const [checkedServer, setCheckedServer] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      if (profile) return;
      try {
        const res = await fetch("/api/user/profile", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data?.profile) {
          setProfile(data.profile);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setCheckedServer(true);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [profile, setProfile]);

  React.useEffect(() => {
    if (profile) return;
    if (!checkedServer) return;
    router.replace("/onboarding");
  }, [profile, checkedServer, router]);

  if (!profile) {
    return (
      <div className="mx-auto mt-10 max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
        Profil yükleniyor… {checkedServer ? "Yönlendiriliyorsun." : "Kontrol ediliyor."}
      </div>
    );
  }

  return <>{children}</>;
}
