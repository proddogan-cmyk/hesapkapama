"use client";

import * as React from "react";

function Arrow({ from, to }: { from: [number, number]; to: [number, number] }) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 520 360" aria-hidden="true">
      <defs>
        <marker id="arrowHeadAndroid" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="rgba(255,255,255,0.85)" />
        </marker>
      </defs>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.75)" strokeWidth="3" markerEnd="url(#arrowHeadAndroid)" />
    </svg>
  );
}

export function InstallAndroidIllustration({ highlight }: { highlight?: string }) {
  const showChrome = highlight === "chrome";
  const showMenu = highlight === "menu";
  const showInstall = highlight === "install";
  const showDone = highlight === "done";

  return (
    <div className="relative mx-auto w-full max-w-[360px] sm:max-w-[520px]" style={{ aspectRatio: "520 / 340" }}>
      <div className="absolute inset-0 rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-4">
        <div className="mx-auto h-full w-[200px] sm:w-[220px] rounded-[34px] border border-white/15 bg-slate-950/60 shadow-xl">
          <div className="mx-auto mt-4 flex h-8 w-[180px] sm:w-[190px] items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3">
            <div className={["h-4 w-14 rounded-md", showChrome ? "bg-white/40" : "bg-white/10"].join(" ")} />
            <div className={["h-4 w-2 rounded-full", showMenu ? "bg-white/40" : "bg-white/10"].join(" ")} />
          </div>
          <div className="mx-auto mt-4 h-[220px] sm:h-[230px] w-[180px] sm:w-[190px] rounded-2xl border border-white/10 bg-white/5" />
          <div className="mx-auto mt-3 flex h-10 w-[180px] sm:w-[190px] items-center justify-center rounded-xl border border-white/10 bg-white/5">
            <div className={["h-6 w-28 rounded-lg", showInstall ? "bg-white/35" : "bg-white/10"].join(" ")} />
          </div>
        </div>

        {showChrome && <Arrow from={[60, 78]} to={[210, 78]} />}
        {showMenu && <Arrow from={[450, 90]} to={[330, 85]} />}
        {showInstall && <Arrow from={[430, 290]} to={[310, 305]} />}
        {showDone && <Arrow from={[70, 210]} to={[260, 210]} />}

        {showChrome && (
          <div className="absolute left-4 top-4 sm:left-5 sm:top-6 max-w-[170px] text-xs text-slate-200">
            Chrome ile aç
            <div className="mt-1 text-[11px] text-slate-400">Android’de önerilen.</div>
          </div>
        )}
        {showMenu && (
          <div className="absolute right-4 top-4 sm:right-5 sm:top-6 max-w-[180px] text-xs text-slate-200 text-right">
            Menü (⋮)
            <div className="mt-1 text-[11px] text-slate-400">“Ana ekrana ekle” burada.</div>
          </div>
        )}
        {showInstall && (
          <div className="absolute right-4 bottom-4 sm:right-5 sm:bottom-6 max-w-[180px] text-xs text-slate-200 text-right">
            Yükle / Ekle
            <div className="mt-1 text-[11px] text-slate-400">Onay ver ve bitir.</div>
          </div>
        )}
        {showDone && (
          <div className="absolute left-4 top-24 sm:left-5 sm:top-28 max-w-[170px] text-xs text-slate-200">
            İkon hazır
            <div className="mt-1 text-[11px] text-slate-400">Ana ekrandan aç.</div>
          </div>
        )}
      </div>
    </div>
  );
}
