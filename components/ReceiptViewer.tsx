"use client";

import * as React from "react";
import { X } from "lucide-react";

export default function ReceiptViewer({ open, src, onClose }: { open: boolean; src?: string | null; onClose: () => void }) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[94vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="text-sm font-semibold text-slate-100">Fiş Görseli</div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-auto p-4">
          {src ? (
            <img
              src={src}
              alt="Fiş"
              className="mx-auto h-auto w-full max-w-3xl rounded-xl border border-white/10 bg-black object-contain"
            />
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              Bu işlemde kayıtlı fiş görseli bulunamadı.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
