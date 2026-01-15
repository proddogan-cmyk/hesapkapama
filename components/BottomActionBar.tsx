"use client";

import * as React from "react";
import { Plus, Minus, ReceiptText, X } from "lucide-react";
import TransactionModal from "@/components/TransactionModal";
import ReceiptApprovalModal from "@/components/ReceiptApprovalModal";
import { useAppStore } from "@/lib/store";

type Kind = "income" | "expense";

export function BottomActionBar() {
  const projects = useAppStore((s) => s.projects);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);

  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<Kind>("expense");

  // Receipt approval flow (camera/gallery -> AI parse -> confirm -> add to project)
  const [receiptMenuOpen, setReceiptMenuOpen] = React.useState(false);
  const [receiptOpen, setReceiptOpen] = React.useState(false);
  const [receiptFiles, setReceiptFiles] = React.useState<File[]>([]);
  const [receiptProjectId, setReceiptProjectId] = React.useState<string | null>(null);

  const receiptCamRef = React.useRef<HTMLInputElement | null>(null);
  const receiptGalleryRef = React.useRef<HTMLInputElement | null>(null);

  // remember last real project selection
  React.useEffect(() => {
    if (!selectedProjectId) return;
    if (selectedProjectId === "__all__") return;
    try {
      window.localStorage.setItem("hk_last_project_v1", selectedProjectId);
    } catch {}
  }, [selectedProjectId]);

  const ensureWritableProject = React.useCallback((): string | null => {
    const current = selectedProjectId;
    if (current && current !== "__all__") return current;

    if (projects.length === 0) {
      alert("Önce bir proje eklemen gerekiyor.");
      return null;
    }

    // Try last saved project
    let last = "";
    try {
      last = window.localStorage.getItem("hk_last_project_v1") || "";
    } catch {}

    const fallback =
      (last && projects.find((p) => p.id === last)?.id) ||
      projects[0]?.id ||
      null;

    if (!fallback) return null;

    alert("Fiş eklemek için bir proje seçmen gerekiyor. Varsayılan proje kullanılacak.");
    return fallback;
  }, [projects, selectedProjectId]);

  const openTx = (k: Kind) => {
    setKind(k);
    setOpen(true);
  };

  const openReceiptPicker = (mode: "camera" | "gallery") => {
    const pid = ensureWritableProject();
    if (!pid) return;

    setReceiptProjectId(pid);
    setReceiptMenuOpen(false);

    if (mode === "camera") receiptCamRef.current?.click();
    else receiptGalleryRef.current?.click();
  };

  const onReceiptFilesPicked = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const pid = ensureWritableProject();
    if (!pid) return;

    setReceiptProjectId(pid);
    setReceiptFiles(Array.from(files).slice(0, 50));
    setReceiptOpen(true);
  };

  return (
    <>
      {/* Hidden inputs */}
      <input
        ref={receiptCamRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onReceiptFilesPicked(e.target.files);
          e.currentTarget.value = "";
        }}
      />
      <input
        ref={receiptGalleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onReceiptFilesPicked(e.target.files);
          e.currentTarget.value = "";
        }}
      />

      {/* Bottom bar */}
      <div className="fixed bottom-[72px] left-1/2 z-[65] -translate-x-1/2">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/75 p-2 shadow-2xl backdrop-blur">
          <button
            type="button"
            onClick={() => openTx("income")}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950 shadow-sm hover:bg-emerald-400"
            aria-label="Gelir ekle"
            title="Gelir ekle"
          >
            <Plus className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => openTx("expense")}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500 text-slate-950 shadow-sm hover:bg-rose-400"
            aria-label="Gider ekle"
            title="Gider ekle"
          >
            <Minus className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => setReceiptMenuOpen(true)}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
            aria-label="Fiş ekle"
            title="Fiş ekle"
          >
            <ReceiptText className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Receipt picker modal */}
      {receiptMenuOpen ? (
        <div className="fixed inset-0 z-[80]">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setReceiptMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-xl">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="text-sm font-semibold text-slate-100">Fiş Ekle</div>
              <button
                type="button"
                onClick={() => setReceiptMenuOpen(false)}
                className="rounded-xl p-2 text-slate-300 hover:bg-white/10"
                aria-label="Kapat"
                title="Kapat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 px-4 pb-4">
              <button
                type="button"
                onClick={() => openReceiptPicker("camera")}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-slate-100 hover:bg-white/10"
              >
                Kamera ile çek
                <div className="mt-1 text-xs font-normal text-slate-400">Tek fiş</div>
              </button>

              <button
                type="button"
                onClick={() => openReceiptPicker("gallery")}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-slate-100 hover:bg-white/10"
              >
                Galeriden seç
                <div className="mt-1 text-xs font-normal text-slate-400">Tekli veya çoklu (en fazla 50)</div>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <TransactionModal
        open={open}
        kind={kind}
        onClose={() => {
          setOpen(false);
        }}
      />

      <ReceiptApprovalModal
        open={receiptOpen}
        projectId={receiptProjectId}
        files={receiptFiles}
        onClose={() => {
          setReceiptOpen(false);
          setReceiptFiles([]);
          setReceiptProjectId(null);
        }}
      />
    </>
  );
}
