"use client";

import * as React from "react";
import { InstallIOSIllustration } from "@/components/illustrations/InstallIOSIllustration";
import { InstallAndroidIllustration } from "@/components/illustrations/InstallAndroidIllustration";

type OS = "ios" | "android";

function detectOS(): OS {
  if (typeof navigator === "undefined") return "android";
  const ua = navigator.userAgent || "";
  const isApple =
    /iPhone|iPad|iPod/i.test(ua) ||
    ((navigator as any).platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
  return isApple ? "ios" : "android";
}

type Step = {
  title: string;
  body: string;
  highlight: string;
  Illustration: React.ComponentType<{ highlight?: string }>;
};

export function InstallGuideInline({ onDone }: { onDone: () => void }) {
  const [os, setOs] = React.useState<OS>("android");
  const [step, setStep] = React.useState(0);

  React.useEffect(() => setOs(detectOS()), []);

  const steps: Step[] = React.useMemo(() => {
    if (os === "ios") {
      return [
        { title: "1) Safari ile aç", body: "Uygulamayı iPhone/iPad’de Safari tarayıcısında aç.", highlight: "safari", Illustration: InstallIOSIllustration },
        { title: "2) Paylaş ikonuna dokun", body: "Ekranın altındaki Paylaş (⬆︎) ikonuna dokun.", highlight: "share", Illustration: InstallIOSIllustration },
        { title: "3) Ana Ekrana Ekle", body: "Listeden “Ana Ekrana Ekle”yi seç. İstersen isim düzenleyebilirsin.", highlight: "add", Illustration: InstallIOSIllustration },
        { title: "4) Ekle ve hazır", body: "“Ekle”ye bas. Artık ana ekranda bir ikon olur ve tam ekran açılır.", highlight: "done", Illustration: InstallIOSIllustration },
      ];
    }
    return [
      { title: "1) Chrome ile aç", body: "Android telefonda Chrome ile uygulamayı aç.", highlight: "chrome", Illustration: InstallAndroidIllustration },
      { title: "2) Menü (⋮) → Ana ekrana ekle", body: "Sağ üstteki üç nokta (⋮) menüsüne bas, “Ana ekrana ekle” veya “Uygulamayı yükle”yi seç.", highlight: "menu", Illustration: InstallAndroidIllustration },
      { title: "3) Yükle / Ekle", body: "Onay ekranında “Ekle / Yükle”ye bas.", highlight: "install", Illustration: InstallAndroidIllustration },
      { title: "4) Tam ekran kullan", body: "Ana ekrandaki ikon ile açınca uygulama gibi tam ekran çalışır.", highlight: "done", Illustration: InstallAndroidIllustration },
    ];
  }, [os]);

  const total = steps.length;
  const current = steps[step];
  const Illustration = current.Illustration;

  return (
    <div className="px-5 py-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setOs("ios"); setStep(0); }}
          className={[
            "rounded-xl border px-3 py-2 text-xs font-semibold",
            os === "ios" ? "border-white/20 bg-white/15 text-slate-100" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
          ].join(" ")}
        >
          iPhone / iPad (Safari)
        </button>
        <button
          onClick={() => { setOs("android"); setStep(0); }}
          className={[
            "rounded-xl border px-3 py-2 text-xs font-semibold",
            os === "android" ? "border-white/20 bg-white/15 text-slate-100" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
          ].join(" ")}
        >
          Android (Chrome)
        </button>

        <div className="ml-auto flex items-center gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={["h-1.5 w-7 rounded-full", i <= step ? "bg-white/60" : "bg-white/15"].join(" ")} />
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-100">{current.title}</div>
            <div className="mt-2 text-sm leading-6 text-slate-300">{current.body}</div>
          </div>
          <div className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-200">
            {step + 1}/{total}
          </div>
        </div>

        {/* Illustration: responsive; never exceeds screen width */}
        <div className="mt-5 overflow-hidden">
          <Illustration highlight={current.highlight} />
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className={[
              "h-11 rounded-2xl border px-4 text-sm font-semibold",
              step === 0 ? "cursor-not-allowed border-white/10 bg-white/5 text-slate-500" : "border-white/15 bg-white/10 text-slate-100 hover:bg-white/15",
            ].join(" ")}
          >
            Geri
          </button>

          <button
            onClick={step === total - 1 ? onDone : () => setStep((s) => Math.min(total - 1, s + 1))}
            className="h-11 rounded-2xl bg-emerald-500/90 px-5 text-sm font-semibold text-emerald-950 hover:bg-emerald-500"
          >
            {step === total - 1 ? "Bitti" : "Devam"}
          </button>
        </div>

        <div className="mt-3 text-xs text-slate-500">
          Not: Bazı Android cihazlarda “Uygulamayı yükle” seçeneği görünür. Bu seçenek de aynı işlemi yapar.
        </div>
      </div>
    </div>
  );
}
