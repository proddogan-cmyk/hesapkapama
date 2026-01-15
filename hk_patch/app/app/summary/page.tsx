"use client";

import * as React from "react";
import Link from "next/link";
import { Download, ArrowLeft } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { ProjectTabs } from "@/components/ProjectTabs";
import { bySelectedProject, totals, categoryTotals, advanceByPerson } from "@/lib/selectors";


function getLocalUserId(): string {
  try {
    const key = "hk_local_user_id_v1";
    const existing = window.localStorage.getItem(key);
    if (existing && existing.trim()) return existing.trim();
    const id = `local_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
    window.localStorage.setItem(key, id);
    return id;
  } catch {
    return "";
  }
}

export default function SummaryPage() {
  const profile = useAppStore((s) => s.profile);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const projects = useAppStore((s) => s.projects);
  const txs = useAppStore((s) => bySelectedProject(s));

  const t = totals(txs);
  const cats = categoryTotals(txs);
  const adv = advanceByPerson(txs);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const onExport = async () => {
    if (!selectedProjectId) return;

    const projectName = String(selectedProject?.name || "Proje").trim();
    const safeProject = projectName
      .toLocaleLowerCase("tr-TR")
      .replace(/[^\p{L}\p{N}]+/gu, "_")
      .replace(/^_+|_+$/g, "");

    const fname = `HesapKapama_${safeProject || "Proje"}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    const localUserId = getLocalUserId();
    const cost = 200;

    // Best-effort balance check
    try {
      const balRes = await fetch("/api/credits/balance", {
        method: "GET",
        headers: localUserId ? { "x-local-user-id": localUserId } : {},
        cache: "no-store",
      });
      if (balRes.ok) {
        const data = await balRes.json().catch(() => null);
        const balance = Number((data as any)?.balance ?? 0);
        if (balance < cost) {
          alert(`Yetersiz kredi. Mevcut: ${balance}, Gerekli: ${cost}`);
          return;
        }
      }
    } catch {
      // ignore
    }

    const ok = window.confirm(`Excel çıktısı almak ${cost} kredi harcar. Onaylıyor musun?`);
    if (!ok) return;

    const requestId = `x_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const res = await fetch("/api/export/excel", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(localUserId ? { "x-local-user-id": localUserId } : {}),
      },
      body: JSON.stringify({
        localUserId,
        requestId,
        fileName: fname,
        projectName: selectedProject?.name || "",
        profile: { firstName: profile?.firstName || "", lastName: profile?.lastName || "" },
        transactions: txs,
      }),
    });

    if (!res.ok) {
      let msg = "Excel çıktısı alınamadı.";
      try {
        const data = await res.json();
        if ((data as any)?.error === "insufficient_credits") {
          msg = `Yetersiz kredi. Mevcut: ${(data as any)?.balance}, Gerekli: ${(data as any)?.required}`;
        } else if ((data as any)?.error) {
          msg = `Excel çıktısı alınamadı: ${(data as any)?.error}`;
        }
      } catch {
        // ignore
      }
      alert(msg);
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    // refresh badge
    window.dispatchEvent(new Event("hk_credits_refresh"));
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div>
            <div className="text-lg font-semibold text-slate-100">Özet</div>
            <div className="mt-1 text-xs text-slate-400">Kategori ve avans toplamlara hızlı bakış.</div>
            <div className="mt-1 text-xs text-slate-500">
              {selectedProjectId ? (projects.find((p) => p.id === selectedProjectId)?.name ?? "") : "Proje seçiniz"}
            </div>
          </div>

          <ProjectTabs allowAdd={false} />
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold text-slate-200 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Geri
          </Link>

          <button
            type="button"
            onClick={onExport}
            disabled={!selectedProjectId}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-emerald-500 px-4 py-3 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            Excel Çıktı Al (200 kredi)
          </button>
        </div>
      </div>


      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <div className="text-xs text-slate-400">Bakiye</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-50">₺{t.balance.toLocaleString("tr-TR")}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <div className="text-xs text-slate-400">Toplam Giriş</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-emerald-200">₺{t.totalIn.toLocaleString("tr-TR")}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <div className="text-xs text-slate-400">Toplam Çıkış</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-rose-200">₺{t.totalOut.toLocaleString("tr-TR")}</div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <div className="text-sm font-semibold text-slate-100">Kategori Toplamları</div>
          <div className="mt-3 space-y-2">
            {cats.length === 0 ? (
              <div className="text-xs text-slate-400">Henüz harcama yok.</div>
            ) : (
              cats.map(([cat, val]) => (
                <div key={cat} className="flex items-center justify-between text-xs text-slate-300">
                  <div className="font-semibold">{cat}</div>
                  <div className="tabular-nums">₺{val.toLocaleString("tr-TR")}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <div className="text-sm font-semibold text-slate-100">Avans Toplamları</div>

          <div className="mt-3">
            <div className="text-xs font-semibold text-slate-300">Avans Aldık (Kimden)</div>
            <div className="mt-2 space-y-2">
              {adv.inArr.length === 0 ? (
                <div className="text-xs text-slate-400">Kayıt yok.</div>
              ) : (
                adv.inArr.map((r) => (
                  <div key={r.label} className="flex items-center justify-between text-xs text-slate-300">
                    <div className="truncate font-semibold">{r.label}</div>
                    <div className="tabular-nums">₺{r.amount.toLocaleString("tr-TR")}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-5">
            <div className="text-xs font-semibold text-slate-300">Avans Verdik (Kime)</div>
            <div className="mt-2 space-y-2">
              {adv.outArr.length === 0 ? (
                <div className="text-xs text-slate-400">Kayıt yok.</div>
              ) : (
                adv.outArr.map((r) => (
                  <div key={r.label} className="flex items-center justify-between text-xs text-slate-300">
                    <div className="truncate font-semibold">{r.label}</div>
                    <div className="tabular-nums">₺{r.amount.toLocaleString("tr-TR")}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 text-xs text-slate-500">
        Excel çıktısı; senin şablon dosyanın tablarına (kategori isimlerine göre) satır ekler. Excel açılınca formüller otomatik hesaplanacaktır.
      </div>
    </div>
  );
}
