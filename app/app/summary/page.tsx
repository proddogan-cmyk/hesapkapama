"use client";

import * as React from "react";
import Link from "next/link";
import { Download, ArrowLeft } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { ProjectTabs } from "@/components/ProjectTabs";
import { bySelectedProject, totals, categoryTotals, advanceByPerson } from "@/lib/selectors";
import { ConfirmModal } from "@/components/ConfirmModal";
import { formatCredits, getOrCreateLocalUserId } from "@/lib/creditsClient";

export default function SummaryPage() {
  const profile = useAppStore((s) => s.profile);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const projects = useAppStore((s) => s.projects);
  const txs = useAppStore((s) => bySelectedProject(s));

  const t = totals(txs);
  const cats = categoryTotals(txs);
  const adv = advanceByPerson(txs);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const EXPORT_COST = 200;
  const [exportOpen, setExportOpen] = React.useState(false);
  const [exportBusy, setExportBusy] = React.useState(false);
  const [exportChecking, setExportChecking] = React.useState(false);
  const [exportBalance, setExportBalance] = React.useState<number | null>(null);
  const [exportError, setExportError] = React.useState<string>("");

  const refreshExportBalance = React.useCallback(async () => {
    setExportChecking(true);
    setExportError("");
    try {
      const localUserId = getOrCreateLocalUserId();
      const balRes = await fetch("/api/credits/balance", {
        method: "GET",
        headers: localUserId ? { "x-local-user-id": localUserId } : {},
        cache: "no-store",
      });
      if (!balRes.ok) return;
      const data = await balRes.json().catch(() => null);
      setExportBalance(Number((data as any)?.balance ?? 0));
    } catch {
      setExportError("Kredi bakiyesi alınamadı.");
    } finally {
      setExportChecking(false);
    }
  }, []);

  const openExportModal = async () => {
    if (!selectedProjectId) return;
    setExportOpen(true);
    setExportBalance(null);
    setExportError("");
    refreshExportBalance();
  };

  const onExport = async (): Promise<boolean> => {
    if (!selectedProjectId) return false;

    const projectName = String(selectedProject?.name || "Proje").trim();
    const safeProject = projectName
      .toLocaleLowerCase("tr-TR")
      .replace(/[^\p{L}\p{N}]+/gu, "_")
      .replace(/^_+|_+$/g, "");

    const fname = `HesapKapama_${safeProject || "Proje"}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    const localUserId = getOrCreateLocalUserId();

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
          const bal = Number((data as any)?.balance ?? 0);
          setExportBalance(bal);
          msg = `Yetersiz kredi. Mevcut: ${formatCredits(bal)}, Gerekli: ${formatCredits(Number((data as any)?.required ?? EXPORT_COST))}`;
        } else if ((data as any)?.error) {
          msg = `Excel çıktısı alınamadı: ${(data as any)?.error}`;
        }
      } catch {
        // ignore
      }
      setExportError(msg);
      return false;
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
    return true;
  };

  const exportInsufficient =
    exportBalance != null && Number.isFinite(exportBalance) && exportBalance < EXPORT_COST;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <ConfirmModal
        open={exportOpen}
        title="Excel çıktısı için onay"
        description={`Excel çıktısı için ${formatCredits(EXPORT_COST)} kredi kullanılacak. Onaylıyor musun?`}
        confirmLabel="Onayla"
        cancelLabel="Vazgeç"
        confirmDisabled={exportChecking || exportBusy || exportInsufficient}
        busy={exportBusy}
        onCancel={() => setExportOpen(false)}
        onConfirm={async () => {
          setExportBusy(true);
          setExportError("");
          const ok = await onExport();
          setExportBusy(false);
          if (ok) setExportOpen(false);
        }}
      >
        {exportChecking ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
            Kredi bakiyesi kontrol ediliyor...
          </div>
        ) : exportInsufficient ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            Yetersiz kredi. Mevcut: {formatCredits(exportBalance || 0)} kredi, Gerekli: {formatCredits(EXPORT_COST)} kredi.
            <div className="mt-2">
              <Link
                href="/app/account/buy"
                className="inline-flex h-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-slate-100 hover:bg-white/10"
              >
                Kredi Satın Al
              </Link>
            </div>
          </div>
        ) : null}
        {exportError ? (
          <div className="mt-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-200">
            {exportError}
          </div>
        ) : null}
      </ConfirmModal>

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
            onClick={openExportModal}
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
