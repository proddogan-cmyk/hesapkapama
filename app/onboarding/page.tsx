"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Fade } from "@/components/Fade";
import { Logo } from "@/components/Logo";
import { StoreProvider, useAppStore, useStoreActions } from "@/lib/store";
import type { BizType } from "@/lib/types";

/**
 * Onboarding (Profilini tamamla)
 * - Bu sayfa /app layout'undan bağımsız çalışır.
 * - Bu yüzden StoreProvider'ı burada da kuruyoruz.
 * - Auth/Clerk devre dışı (veya kararsız) olduğunda dahi çalışması için local userId kullanır.
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

export default function OnboardingPage() {
  const [userId, setUserId] = React.useState<string>("");

  React.useEffect(() => {
    setUserId(getOrCreateLocalUserId());
  }, []);

  if (!userId) return <main className="min-h-screen bg-slate-950" />;

  return (
    <StoreProvider userId={userId}>
      <OnboardingInner />
    </StoreProvider>
  );
}

function OnboardingInner() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const { setProfile } = useStoreActions();

  const [firstName, setFirstName] = React.useState(profile?.firstName ?? "");
  const [lastName, setLastName] = React.useState(profile?.lastName ?? "");
  const [title, setTitle] = React.useState(profile?.title ?? "");
  const [bizType, setBizType] = React.useState<BizType>(profile?.bizType ?? "freelance");
  const [companyName, setCompanyName] = React.useState(profile?.companyName ?? "");
  const [busy, setBusy] = React.useState(false);

  const canSubmit = Boolean(firstName.trim() && lastName.trim() && title.trim());

  const submit = async () => {
    if (!canSubmit) return;

    setBusy(true);
    try {
      setProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        title: title.trim(),
        bizType,
        companyName: bizType === "company" ? companyName.trim() : undefined,
      });

      // Persist hemen yazılıyor (store persist) ama yönlendirme için bir tick bekletmek daha stabil.
      await new Promise((r) => setTimeout(r, 10));
      router.replace("/app");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10">
      <Fade className="mx-auto max-w-xl">
        <div className="flex items-center justify-center">
          <Logo variant="full" />
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
          <div className="text-lg font-semibold text-slate-100">Profilini tamamla</div>
          <div className="mt-1 text-sm text-slate-400">
            Bu bilgiler sağ üstte görünecek ve ekip/avans akışlarında kullanılacak.
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-xs text-slate-300">
              Ad
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="h-11 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-slate-100 outline-none"
              />
            </label>
            <label className="grid gap-2 text-xs text-slate-300">
              Soyad
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="h-11 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-slate-100 outline-none"
              />
            </label>

            <label className="grid gap-2 text-xs text-slate-300 md:col-span-2">
              Ünvan (Sektördeki rol)
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Örn: Yapımcı / Yapım Amiri / Reji 1"
                className="h-11 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
            </label>

            <label className="grid gap-2 text-xs text-slate-300">
              Çalışma tipi
              <select
                value={bizType}
                onChange={(e) => setBizType(e.target.value as BizType)}
                className="h-11 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-slate-100 outline-none"
              >
                <option value="freelance" className="bg-slate-950">
                  Freelance
                </option>
                <option value="company" className="bg-slate-950">
                  Şirket
                </option>
              </select>
            </label>

            <label className="grid gap-2 text-xs text-slate-300">
              Şirket adı
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={bizType !== "company"}
                placeholder="Örn: Kraft Film"
                className="h-11 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 disabled:opacity-60"
              />
            </label>
          </div>

          <div className="mt-6 flex items-center justify-end">
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit || busy}
              className="h-11 rounded-2xl bg-emerald-500 px-5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Kaydediliyor…" : "Kaydet ve Devam Et"}
            </button>
          </div>
        </div>
      </Fade>
    </main>
  );
}
