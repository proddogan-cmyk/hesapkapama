"use client";

import * as React from "react";
import Link from "next/link";

type OS = "ios" | "android";

function detectOS(): OS {
  if (typeof navigator === "undefined") return "android";
  const ua = navigator.userAgent || "";
  const isApple =
    /iPhone|iPad|iPod/i.test(ua) ||
    // iPadOS 13+ may report as Mac; use touch heuristic
    ((navigator as any).platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
  return isApple ? "ios" : "android";
}

const STORAGE_KEY = "hk_install_guide_seen_v1";

type Step = {
  title: string;
  body: string;
  highlight: string;
  Illustration: React.ComponentType<{ highlight?: string }>;
};

import { InstallIOSIllustration } from "@/components/illustrations/InstallIOSIllustration";
import { InstallAndroidIllustration } from "@/components/illustrations/InstallAndroidIllustration";

export function InstallGuide() {
  const [os, setOs] = React.useState<OS>("android");
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    setOs(detectOS());
  }, []);

  const steps: Step[] = React.useMemo(() => {
    if (os === "ios") {
      return [
        {
          title: "1) Safari ile aç",
          body: "Uygulamayı iPhone/iPad’de Safari tarayıcısında aç. (iOS’ta Ana Ekrana Ekle seçeneği Safari’de en sorunsuz çalışır.)",
          highlight: "safari",
          Illustration: InstallIOSIllustration,
        },
        {
          title: "2) Paylaş ikonuna dokun",
          body: "Ekranın altındaki Paylaş (⬆︎) ikonuna dokun.",
          highlight: "share",
          Illustration: InstallIOSIllustration,
        },
        {
          title: "3) Ana Ekrana Ekle",
          body: "Listeden “Ana Ekrana Ekle”yi seç. İstersen isim düzenleyebilirsin.",
          highlight: "add",
          Illustration: InstallIOSIllustration,
        },
        {
          title: "4) Ekle ve hazır",
          body: "“Ekle”ye bas. Artık ana ekranda bir ikon olur ve uygulama gibi tam ekran açılır.",
          highlight: "done",
          Illustration: InstallIOSIllustration,
        },
      ];
    }

    return [
      {
        title: "1) Chrome ile aç",
        body: "Android telefonda Chrome ile uygulamayı aç.",
        highlight: "chrome",
        Illustration: InstallAndroidIllustration,
      },
      {
        title: "2) Menü (⋮) → Ana ekrana ekle",
        body: "Sağ üstteki üç nokta (⋮) menüsüne bas, “Ana ekrana ekle” veya “Uygulamayı yükle” seçeneğini seç.",
        highlight: "menu",
        Illustration: InstallAndroidIllustration,
      },
      {
        title: "3) Yükle / Ekle",
        body: "Onay ekranında “Ekle / Yükle”ye bas. İstersen ismi düzenle.",
        highlight: "install",
        Illustration: InstallAndroidIllustration,
      },
      {
        title: "4) Tam ekran kullan",
        body: "Ana ekrandaki ikon ile açınca uygulama gibi tam ekran çalışır.",
        highlight: "done",
        Illustration: InstallAndroidIllustration,
      },
    ];
  }, [os]);

  const total = steps.length;
  const current = steps[step];
  const Illustration = current.Illustration;

  function markSeen() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
  }

  function onSkip() {
    markSeen();
    window.location.href = "/app";
  }

  function next() {
    setStep((s) => {
      const n = Math.min(s + 1, total - 1);
      if (n === total - 1) markSeen();
      return n;
    });
  }

  function prev() {
    setStep((s) => Math.max(0, s - 1));
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-10 pt-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Telefona Uygulama Gibi Ekle</h1>
          <p className="mt-2 text-sm text-slate-300">
            Ana ekrana ekleyince ikon oluşur ve HesapKapama tam ekran uygulama gibi açılır.
          </p>
        </div>

        <button
          onClick={onSkip}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10"
        >
          Geç
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            setOs("ios");
            setStep(0);
          }}
          className={[
            "rounded-xl border px-3 py-2 text-xs font-semibold",
            os === "ios"
              ? "border-white/20 bg-white/15 text-slate-100"
              : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
          ].join(" ")}
        >
          iPhone / iPad (Safari)
        </button>

        <button
          onClick={() => {
            setOs("android");
            setStep(0);
          }}
          className={[
            "rounded-xl border px-3 py-2 text-xs font-semibold",
            os === "android"
              ? "border-white/20 bg-white/15 text-slate-100"
              : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
          ].join(" ")}
        >
          Android (Chrome)
        </button>

        <div className="ml-auto flex items-center gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={[
                "h-1.5 w-7 rounded-full transition-all",
                i <= step ? "bg-white/60" : "bg-white/15",
              ].join(" ")}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40">
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-100">{current.title}</div>
              <div className="mt-2 text-sm leading-6 text-slate-300">{current.body}</div>
            </div>
            <div className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-200">
              {step + 1}/{total}
            </div>
          </div>

          <div className="mt-5">
            <Illustration highlight={current.highlight} />
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              onClick={prev}
              disabled={step === 0}
              className={[
                "h-11 rounded-2xl border px-4 text-sm font-semibold",
                step === 0
                  ? "cursor-not-allowed border-white/10 bg-white/5 text-slate-500"
                  : "border-white/15 bg-white/10 text-slate-100 hover:bg-white/15",
              ].join(" ")}
            >
              Geri
            </button>

            <div className="flex items-center gap-2">
              <Link
                href="/app"
                className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-200 hover:bg-white/10"
              >
                Ana Sayfaya Dön
              </Link>

              <button
                onClick={step === total - 1 ? onSkip : next}
                className="h-11 rounded-2xl bg-emerald-500/90 px-5 text-sm font-semibold text-emerald-950 hover:bg-emerald-500"
              >
                {step === total - 1 ? "Bitti" : "Devam"}
              </button>
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-500">
            Not: Bazı Android cihazlarda “Uygulamayı yükle” seçeneği görünür. Bu seçenek de aynı işlemi yapar.
          </div>
        </div>
      </div>
    </div>
  );
}
