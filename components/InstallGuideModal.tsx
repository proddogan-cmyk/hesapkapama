"use client";

import * as React from "react";
import { InstallGuideInline } from "@/components/InstallGuideInline";

const STORAGE_KEY = "hk_install_guide_seen_v6";

export function InstallGuideModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  // Lock page scroll while modal is open (prevents underlying landing content from sliding)
  React.useEffect(() => {
    if (!open) return;

    const html = document.documentElement;
    const body = document.body;

    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyPosition = body.style.position;
    const prevBodyWidth = body.style.width;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "relative";
    body.style.width = "100%";

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.position = prevBodyPosition;
      body.style.width = prevBodyWidth;
    };
  }, [open]);

  if (!mounted || !open) return null;

  function markSeen() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
  }

  function close() {
    markSeen();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[220]">
      <button aria-label="Kapat" onClick={close} className="absolute inset-0 bg-black/90" />

      <div className="absolute inset-0 flex items-stretch justify-center sm:items-center sm:p-6">
        <div
          className={[
            "relative w-full border border-white/10 bg-slate-950 shadow-2xl",
            // Mobile full screen
            "h-[100dvh] w-[100dvw] rounded-none",
            // Desktop modal
            "sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-3xl sm:rounded-3xl sm:overflow-hidden",
            // Flex layout to guarantee footer buttons are always reachable
            "flex flex-col",
          ].join(" ")}
        >
          {/* Header */}
          <div className="shrink-0 border-b border-white/10 px-5 py-4 pt-[calc(16px+env(safe-area-inset-top))]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-base font-semibold text-slate-100">Telefona Uygulama Gibi Ekle</div>
                <div className="mt-1 text-sm text-slate-300">
                  Ana ekrana ekleyince ikon oluşur ve tam ekran çalışır.
                </div>
              </div>
              <button
                onClick={close}
                className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10"
              >
                Geç
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain overflow-x-hidden">
            <InstallGuideInline onDone={close} />
          </div>

          {/* Footer (sticky, safe-area aware) */}
          <div className="shrink-0 border-t border-white/10 px-5 py-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem(STORAGE_KEY);
                  } catch {}
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
                title="Rehberi bir sonraki sefer tekrar gösterir"
              >
                Sıfırla
              </button>
              <button
                onClick={close}
                className="rounded-xl bg-emerald-500/90 px-4 py-2 text-xs font-semibold text-emerald-950 hover:bg-emerald-500"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
