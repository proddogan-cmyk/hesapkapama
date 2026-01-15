"use client";

import * as React from "react";
import clsx from "clsx";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Onayla",
  cancelLabel = "Vazgeç",
  confirmDisabled = false,
  busy = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/90 p-5 shadow-2xl backdrop-blur">
        <div className="text-sm font-semibold text-slate-100">{title}</div>
        {description ? <div className="mt-2 text-xs text-slate-300">{description}</div> : null}
        {children ? <div className="mt-3">{children}</div> : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-semibold text-slate-200 hover:bg-white/10"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled || busy}
            className={clsx(
              "h-10 rounded-2xl px-4 text-xs font-semibold transition",
              confirmDisabled || busy
                ? "bg-white/10 text-slate-500"
                : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
            )}
          >
            {busy ? "İşleniyor..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
