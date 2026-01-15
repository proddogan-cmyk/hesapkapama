"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Onboarding redirect hotfix
 * - Ensures that after "Kaydet" succeeds, user is navigated to /app immediately.
 * - Uses a robust save routine that tries /api/user/profile and /api/profile.
 * - Prevents "Kaydediliyor" state from getting stuck due to navigation/cache issues.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  const localUserId = React.useMemo(() => {
    try {
      return window.localStorage.getItem("hk_local_user_id_v1") || "";
    } catch {
      return "";
    }
  }, []);

  async function postJson(url: string, body: any): Promise<Response> {
    return fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  }

  async function saveProfile() {
    const requestId = `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const payload = {
      name: name.trim(),
      company: company.trim(),
      phone: phone.trim(),
      localUserId,
      requestId,
    };

    // Always keep a local fallback for UX (does not replace server DB)
    try {
      window.localStorage.setItem("hk_profile_fallback_v1", JSON.stringify(payload));
      window.localStorage.setItem("hk_onboarding_done_v1", "1");
    } catch {}

    const endpoints = ["/api/user/profile", "/api/profile"];
    let lastRes: Response | null = null;

    for (const url of endpoints) {
      try {
        const res = await postJson(url, payload);
        lastRes = res;
        if (res.ok) return { ok: true, url };
      } catch (e) {
        // ignore and try next
      }
    }

    const msg = lastRes ? await lastRes.text().catch(() => "") : "";
    return { ok: false, url: endpoints.join(" | "), msg };
  }

  function hardRedirect() {
    // Soft navigation first
    try {
      router.replace("/app");
      router.refresh();
    } catch {}
    // Hard navigation as a guaranteed fallback
    setTimeout(() => {
      if (typeof window !== "undefined") window.location.assign("/app");
    }, 150);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    setError(null);
    setOk(null);
    setSaving(true);

    try {
      if (!name.trim()) {
        setError("İsim zorunlu.");
        return;
      }

      const result = await saveProfile();
      if (!result.ok) {
        setError(
          "Profil sunucuya kaydedilemedi. Lütfen .env / Clerk ayarlarını ve API route'larını kontrol et. " +
            (result.msg ? `Detay: ${result.msg}` : "")
        );
        return;
      }

      setOk("Kaydedildi. Uygulamaya yönlendiriliyorsun...");
      hardRedirect();
    } finally {
      // If redirect is blocked for any reason, don't stay stuck in loading state.
      setSaving(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-xl px-6 py-10">
        <h1 className="text-xl font-semibold">Profil Oluştur</h1>
        <p className="mt-2 text-sm text-slate-300">
          Bu bilgiler cihazlar arasında eşleşme ve raporlama için kullanılır.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300">Ad Soyad</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm outline-none"
              placeholder="Örn: Doğan Bayındır"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Şirket / Ekip</label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="mt-1 h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm outline-none"
              placeholder="Örn: kraft. production company"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Telefon</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm outline-none"
              placeholder="05xx xxx xx xx"
            />
          </div>

          {error ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              {error}
            </div>
          ) : null}

          {ok ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
              {ok}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className={[
              "h-11 w-full rounded-2xl px-4 text-sm font-semibold",
              saving ? "cursor-not-allowed bg-white/10 text-slate-400" : "bg-emerald-500/90 text-emerald-950 hover:bg-emerald-500",
            ].join(" ")}
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </form>

        <div className="mt-6 text-xs text-slate-500">
          Not: Eğer kaydettikten sonra tekrar onboarding'e dönüyorsa, API tarafında profil GET kontrolü farklı userId (Clerk vs local)
          ile bakıyor olabilir. Bu patch, yönlendirmeyi garanti eder; bounce devam ederse next adım: kontrol endpoint'ini tekilleştirmek.
        </div>
      </div>
    </div>
  );
}
