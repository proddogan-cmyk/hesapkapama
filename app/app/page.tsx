"use client";

import * as React from "react";
import Link from "next/link";
import clsx from "clsx";
import { Pencil, ReceiptText, Trash2 } from "lucide-react";
import ReceiptViewer from "@/components/ReceiptViewer";
import TransactionModal from "@/components/TransactionModal";
import { ProjectTabs } from "@/components/ProjectTabs";
import { useAppStore, useStoreActions } from "@/lib/store";
import type { Transaction } from "@/lib/types";
import { bySelectedProject, totals } from "@/lib/selectors";

function fmtDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString("tr-TR");
}

export default function AppPage() {
  const { selectProject, deleteTransaction } = useStoreActions();

  const projects = useAppStore((s) => s.projects);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const txs = useAppStore((s) => bySelectedProject(s));

  const t = totals(txs);

  const [modalKind, setModalKind] = React.useState<"income" | "expense">("income");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editTx, setEditTx] = React.useState<Transaction | null>(null);

  const [receiptOpen, setReceiptOpen] = React.useState(false);
  const [receiptSrc, setReceiptSrc] = React.useState<string | null>(null);

  // Auto select "Genel" if no selection, else first project
  React.useEffect(() => {
    if (!selectedProjectId) {
      if (projects.length > 0) selectProject(projects[0].id);
      else selectProject("__all__");
    }
  }, [projects, selectedProjectId, selectProject]);

  const openReceipt = (src: string) => {
    setReceiptSrc(src);
    setReceiptOpen(true);
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5">
        {/* watermark logo */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.06]">
          <img src="/brand/logo.png" alt="" className="h-56 w-56 object-contain" />
        </div>

        <div className="relative">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-100">Ana Sayfa</div>
              <div className="mt-1 text-xs text-slate-400">
                Proje seç → alt menünün üstündeki butonlarla gelir/gider ve fiş ekle.
              </div>
            </div>
            <Link
              href="/app/summary"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
            >
              Özet
            </Link>
          </div>

          <div className="mt-4">
            <ProjectTabs />
          </div>

          {/* Genel Durum Kartı */}
          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-100">Genel Durum</div>
                <div className="mt-1 text-xs text-slate-400">
                  {selectedProjectId === "__all__" ? "Genel görünüm (tüm projeler)" : "Seçili proje görünümü"}
                </div>
              </div>

              <div className="min-w-[220px]">
                <div className="text-[11px] font-semibold text-slate-400">Proje</div>
                <select
                  value={selectedProjectId || "__all__"}
                  onChange={(e) => selectProject(e.target.value)}
                  className="mt-1 h-11 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-white/10 [color-scheme:dark]"
                >
                  <option value="__all__" className="bg-slate-950 text-slate-100">
                    Genel
                  </option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-slate-950 text-slate-100">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-slate-400">Gelir</div>
                <div className="mt-2 text-2xl font-semibold tabular-nums text-emerald-200">
                  ₺{t.totalIn.toLocaleString("tr-TR")}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-slate-400">Gider</div>
                <div className="mt-2 text-2xl font-semibold tabular-nums text-rose-200">
                  ₺{t.totalOut.toLocaleString("tr-TR")}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-slate-400">Kalan</div>
                <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-50">
                  ₺{t.balance.toLocaleString("tr-TR")}
                </div>
              </div>
            </div>

            {selectedProjectId === "__all__" ? (
              <div className="mt-3 text-xs text-slate-400">
                Not: Genel görünümde işlem eklemek için önce bir proje seç (Genel yerine proje seç).
              </div>
            ) : null}
          </div>

          {/* İşlemler Kartı */}
          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40">
            <div className="grid grid-cols-[140px_90px_1fr_110px_80px] gap-2 border-b border-white/10 px-4 py-3 text-[11px] font-semibold text-slate-400">
              <div>Tarih</div>
              <div>Tür</div>
              <div>Kim / Açıklama</div>
              <div>Kategori</div>
              <div className="text-right">Tutar</div>
            </div>

            <div className="max-h-[54vh] overflow-auto">
              {txs.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-400">Henüz işlem yok.</div>
              ) : (
                txs.map((tx) => (
                  <div
                    key={tx.id}
                    className="grid grid-cols-[140px_90px_1fr_110px_80px] gap-2 border-b border-white/5 px-4 py-3 text-sm"
                  >
                    <div className="text-xs text-slate-300">{fmtDate(tx.ts)}</div>

                    <div
                      className={clsx(
                        "text-xs font-semibold",
                        tx.kind === "income" ? "text-emerald-300" : "text-rose-300"
                      )}
                    >
                      {tx.kind === "income" ? "Giriş" : "Harcama"}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-semibold text-slate-100">{tx.who || "-"}</div>

                        {tx.receipt?.imageDataUrl ? (
                          <button
                            type="button"
                            onClick={() => openReceipt(tx.receipt?.imageDataUrl as string)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                            aria-label="Fişi aç"
                          >
                            <ReceiptText className="h-4 w-4" />
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => {
                            setModalKind(tx.kind);
                            setEditTx(tx);
                            setModalOpen(true);
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                          aria-label="Düzenle"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const ok = confirm("Bu işlemi silmek istiyor musun?");
                            if (ok) deleteTransaction(tx.id);
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                          aria-label="Sil"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {tx.description ? (
                        <div className="mt-1 truncate text-xs text-slate-400">{tx.description}</div>
                      ) : null}
                    </div>

                    <div className="text-xs font-semibold text-slate-200">{tx.category}</div>
                    <div className="text-right text-xs font-semibold tabular-nums text-slate-100">
                      ₺{(tx.amount || 0).toLocaleString("tr-TR")}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <TransactionModal
        open={modalOpen}
        kind={modalKind}
        editTx={editTx}
        onClose={() => {
          setModalOpen(false);
          setEditTx(null);
        }}
      />
      <ReceiptViewer open={receiptOpen} src={receiptSrc} onClose={() => setReceiptOpen(false)} />
    </>
  );
}
