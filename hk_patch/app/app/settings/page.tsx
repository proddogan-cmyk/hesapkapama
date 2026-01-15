"use client";

import * as React from "react";
import { Upload, Download, Trash2 } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useAppStore, useStoreActions } from "@/lib/store";

export default function SettingsPage() {
  const { user } = useUser();
  const state = useAppStore((s) => s);
  const { setProfile } = useStoreActions();

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hesapkapama_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    try {
      const obj = JSON.parse(text);
      alert("Yedek içe aktarma bu sürümde güvenlik için kapalı. İstersen açabilirim.");
    } catch {
      alert("JSON okunamadı.");
    }
  };

  const clearProfileOnly = () => {
    const ok = confirm("Profil bilgilerini sıfırlamak istiyor musun? (İşlemler kalır)");
    if (!ok) return;
    setProfile({
      firstName: "",
      lastName: "",
      title: "",
      bizType: "freelance",
    });
    alert("Profil boşlandı. Onboarding sayfasına yönlenebilirsin.");
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="text-lg font-semibold text-slate-100">Ayarlar</div>
      <div className="mt-1 text-xs text-slate-400">Yedekleme ve temel ayarlar.</div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={exportJson}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10"
        >
          <Download className="h-4 w-4" />
          JSON Yedek Al
        </button>

        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10">
          <Upload className="h-4 w-4" />
          JSON Yedek Yükle
          <input type="file" accept="application/json" className="hidden" onChange={(e) => importJson(e.target.files?.[0] ?? null)} />
        </label>

        <button
          type="button"
          onClick={clearProfileOnly}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10"
        >
          <Trash2 className="h-4 w-4" />
          Profil Sıfırla
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-xs text-slate-400">
        Not: Bu sürüm verileri tarayıcıda (localStorage) tutar. Çok fazla fiş görseli eklersen depolama dolabilir. Prod kullanım için buluta taşıma önerilir.
      </div>
    </div>
  );
}
