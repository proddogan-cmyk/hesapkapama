"use client";

import * as React from "react";

function Arrow({ from, to }: { from: [number, number]; to: [number, number] }) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 520 360" aria-hidden="true">
      <defs>
        <marker id="arrowHeadIOS" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="rgba(255,255,255,0.85)" />
        </marker>
      </defs>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.75)" strokeWidth="3" markerEnd="url(#arrowHeadIOS)" />
    </svg>
  );
}

export function InstallIOSIllustration({ highlight }: { highlight?: string }) {
  const showSafari = highlight === "safari";
  const showShare = highlight === "share";
  const showAdd = highlight === "add";
  const showDone = highlight === "done";

  return (
    <div className="relative mx-auto w-full max-w-[360px] sm:max-w-[520px]" style={{ aspectRatio: "520 / 340" }}>
      <div className="absolute inset-0 rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-4">
        <div className="mx-auto h-full w-[200px] sm:w-[220px] rounded-[34px] border border-white/15 bg-slate-950/60 shadow-xl">
          <div className="mx-auto mt-3 h-1.5 w-16 rounded-full bg-white/10" />
          <div className="mx-auto mt-3 h-6 w-[170px] sm:w-[180px] rounded-lg border border-white/10 bg-white/5" />
          <div className="mx-auto mt-3 h-[200px] sm:h-[210px] w-[180px] sm:w-[190px] rounded-2xl border border-white/10 bg-white/5" />
          <div className="mx-auto mt-3 flex h-10 w-[180px] sm:w-[190px] items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4">
            <div className="h-5 w-5 rounded-md bg-white/10" />
            <div className={["h-6 w-6 rounded-full", showShare ? "bg-white/40" : "bg-white/10"].join(" ")} />
            <div className="h-5 w-5 rounded-md bg-white/10" />
          </div>
        </div>

        {showSafari && <Arrow from={[60, 75]} to={[260, 78]} />}
        {showShare && <Arrow from={[70, 300]} to={[282, 300]} />}
        {showAdd && <Arrow from={[430, 180]} to={[260, 190]} />}
        {showDone && <Arrow from={[430, 220]} to={[260, 250]} />}

        {showSafari && (
          <div className="absolute left-4 top-4 sm:left-5 sm:top-6 max-w-[170px] text-xs text-slate-200">
            Safari ile aç
            <div className="mt-1 text-[11px] text-slate-400">iOS’ta en stabil yöntem.</div>
          </div>
        )}
        {showShare && (
          <div className="absolute left-4 bottom-4 sm:left-5 sm:bottom-6 max-w-[170px] text-xs text-slate-200">
            Paylaş ikonuna bas
            <div className="mt-1 text-[11px] text-slate-400">Alt bardaki ⬆︎ ikon.</div>
          </div>
        )}
        {showAdd && (
          <div className="absolute right-4 top-16 sm:right-5 sm:top-20 max-w-[180px] text-xs text-slate-200 text-right">
            “Ana Ekrana Ekle”
            <div className="mt-1 text-[11px] text-slate-400">Açılan listeden seç.</div>
          </div>
        )}
        {showDone && (
          <div className="absolute right-4 top-28 sm:right-5 sm:top-36 max-w-[180px] text-xs text-slate-200 text-right">
            Ekle ve bitir
            <div className="mt-1 text-[11px] text-slate-400">İkon ana ekrana gelir.</div>
          </div>
        )}
      </div>
    </div>
  );
}
