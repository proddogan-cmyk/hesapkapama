"use client";

import * as React from "react";
import { InstallGuideModal } from "@/components/InstallGuideModal";

export function InstallLandingCard() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <div className="w-full rounded-2xl border border-white/10 bg-slate-950/40 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-100">Telefona “Uygulama” gibi ekle</div>
            <div className="mt-1 text-xs leading-5 text-slate-300">
              Ana ekrana ekleyince ikon oluşur ve HesapKapama tam ekran çalışır. iPhone ve Android adımlarını 30 saniyede gösterelim.
            </div>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-100 hover:bg-white/10"
          >
            Nasıl eklerim?
          </button>
        </div>
      </div>

      <InstallGuideModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
