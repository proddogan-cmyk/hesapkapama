"use client";

import * as React from "react";
import { InstallGuideModal } from "@/components/InstallGuideModal";

export function InstallCTA({ autoShow = true }: { autoShow?: boolean }) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!autoShow) return;
    // Auto-open on first visit to /app
    setOpen(true);
  }, [autoShow]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10"
        title="Telefona uygulama gibi ekle"
      >
        Telefona Ekle
      </button>

      <InstallGuideModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
