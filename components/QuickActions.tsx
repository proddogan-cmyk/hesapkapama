"use client";

import { Plus, Minus } from "lucide-react";

export function QuickActions({ onPlus, onMinus }: { onPlus: () => void; onMinus: () => void }) {
  return (
    <div className="fixed bottom-[78px] left-1/2 z-[65] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-full border border-white/10 bg-slate-950/75 p-2 shadow-2xl backdrop-blur">
        <button
          type="button"
          onClick={onPlus}
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-sm hover:bg-emerald-400"
          aria-label="Giriş ekle"
        >
          <Plus className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onMinus}
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-500 text-slate-950 shadow-sm hover:bg-rose-400"
          aria-label="Çıkış ekle"
        >
          <Minus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
