"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Camera, FileUp, Images, Sparkles, X } from "lucide-react";
import type { ReceiptMeta } from "@/lib/types";
import { parseReceiptText } from "@/lib/receiptParse";

type Parsed = ReturnType<typeof parseReceiptText>;

function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return m > 0 ? `${m}:${ss}` : `${s}s`;
}

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "-";
  const s = Math.ceil(seconds);
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return m > 0 ? `${m}:${ss}` : `${s}s`;
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = dataUrl;
  });
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/**
 * Free OCR accuracy boost:
 * - upscale to ~2000px width
 * - grayscale
 * - contrast + Otsu threshold (binary)
 * - trim borders by detecting dark pixels bbox
 *
 * This materially improves receipts shot on messy backgrounds.
 */
async function preprocessForOcr(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);

  const targetW = clamp(img.width < 900 ? img.width * 2 : img.width, 1200, 2200);
  const scale = targetW / img.width;
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return dataUrl;

  ctx.drawImage(img, 0, 0, w, h);

  const im = ctx.getImageData(0, 0, w, h);
  const d = im.data;

  // grayscale + build histogram
  const hist = new Array(256).fill(0);
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    d[i] = d[i + 1] = d[i + 2] = y;
    hist[y]++;
  }

  // Otsu threshold
  const total = w * h;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let varMax = 0;
  let threshold = 180; // reasonable default
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;

    sumB += t * hist[t];

    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) * (mB - mF);

    if (varBetween > varMax) {
      varMax = varBetween;
      threshold = t;
    }
  }

  // Binarize + mild contrast push
  for (let i = 0; i < d.length; i += 4) {
    const y = d[i];
    const v = y < threshold ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(im, 0, 0);

  // Trim bbox of "ink" pixels
  const im2 = ctx.getImageData(0, 0, w, h);
  const dd = im2.data;
  let minX = w, minY = h, maxX = 0, maxY = 0;
  const ink = (idx: number) => dd[idx] < 200;  // near-black
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (ink(i)) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  // If we couldn't detect content, return original binarized
  if (minX > maxX || minY > maxY) return canvas.toDataURL("image/png");

  const pad = Math.round(Math.min(w, h) * 0.02);
  minX = clamp(minX - pad, 0, w - 1);
  minY = clamp(minY - pad, 0, h - 1);
  maxX = clamp(maxX + pad, 0, w - 1);
  maxY = clamp(maxY + pad, 0, h - 1);

  const cw = Math.max(1, maxX - minX + 1);
  const ch = Math.max(1, maxY - minY + 1);

  const out = document.createElement("canvas");
  out.width = cw;
  out.height = ch;
  const octx = out.getContext("2d");
  if (!octx) return canvas.toDataURL("image/png");
  octx.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);

  return out.toDataURL("image/png");
}

async function createTurWorker(setProgress?: (p: number) => void) {
  const Tesseract = await import("tesseract.js");
  const worker = await (Tesseract as any).createWorker("tur", 1, {
    workerPath: "https://unpkg.com/tesseract.js@5.1.1/dist/worker.min.js",
    corePath: "https://unpkg.com/tesseract.js-core@5.0.0/tesseract-core.wasm.js",
    langPath: "https://tessdata.projectnaptha.com/4.0.0",
    logger: (m: any) => {
      if (!setProgress) return;
      if (m?.status === "recognizing text" && typeof m?.progress === "number") {
        setProgress(Math.max(0, Math.min(1, m.progress)));
      }
    },
  });

  // Helpful params for receipts
  try {
    await worker.setParameters({
      preserve_interword_spaces: "1",
      // Keep this broad; overly strict whitelist can hurt Turkish characters
      tessedit_pageseg_mode: "6",
    });
  } catch {}

  return worker;
}

export function ReceiptUpload({
  onMeta,
  onAmount,
  onParsed,
  onBulkParsed,
}: {
  onMeta: (m: ReceiptMeta, previewUrl?: string) => void;
  onAmount: (a?: number) => void;
  onParsed?: (p: Parsed) => void;
  onBulkParsed?: (items: Array<Parsed & { imageDataUrl: string }>) => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [preview, setPreview] = React.useState("");
  const [bulkMsg, setBulkMsg] = React.useState("");

  // Overlay UI (portal to <body> so it can't be clipped by modal transforms)
  const [overlayOpen, setOverlayOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<"single" | "bulk">("single");
  const [stage, setStage] = React.useState("Hazırlanıyor…");
  const [current, setCurrent] = React.useState(0);
  const [total, setTotal] = React.useState(1);
  const [fileProgress, setFileProgress] = React.useState(0);
  const [startAt, setStartAt] = React.useState<number>(0);
  const [nowTs, setNowTs] = React.useState<number>(0);

  React.useEffect(() => {
    if (!overlayOpen) return;
    const t = setInterval(() => setNowTs(Date.now()), 250);
    return () => clearInterval(t);
  }, [overlayOpen]);

  const elapsedMs = overlayOpen ? nowTs - startAt : 0;
  const elapsed = formatElapsed(elapsedMs);
  const overall = phase === "bulk" ? Math.min(1, (current + fileProgress) / Math.max(1, total)) : fileProgress;

  const etaSeconds =
    phase === "bulk" && current > 0 ? ((elapsedMs / 1000) / current) * (total - current) : NaN;

  function openOverlay(nextPhase: "single" | "bulk", nextTotal: number) {
    setPhase(nextPhase);
    setStage("Hazırlanıyor…");
    setCurrent(0);
    setTotal(Math.max(1, nextTotal));
    setFileProgress(0);
    setStartAt(Date.now());
    setNowTs(Date.now());
    setOverlayOpen(true);
  }

  async function recognizeWithFallback(worker: any, dataUrl: string): Promise<{ text: string; used: "processed" | "raw" }> {
    // pass 1: preprocessed
    setStage("Ön işleme…");
    const processed = await preprocessForOcr(dataUrl);
    // let UI paint (important for bulk)
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    setStage("OCR (1/2)…");
    const r1 = await worker.recognize(processed);
    const t1 = String(r1?.data?.text ?? "").trim();
    const p1 = parseReceiptText(t1);
    if (p1.amount || (p1.meta.merchant && p1.category)) {
      return { text: t1, used: "processed" };
    }

    // pass 2: raw (sometimes binarization hurts)
    setFileProgress(0);
    setStage("OCR (2/2)…");
    const r2 = await worker.recognize(dataUrl);
    const t2 = String(r2?.data?.text ?? "").trim();

    // Choose whichever gives a confident total
    const p2 = parseReceiptText(t2);
    if (p2.amount && !p1.amount) return { text: t2, used: "raw" };

    // Prefer longer text if both are low
    return { text: t2.length >= t1.length ? t2 : t1, used: t2.length >= t1.length ? "raw" : "processed" };
  }

  async function runSingle(dataUrl: string) {
    setBusy(true);
    setErr("");
    setBulkMsg("");
    openOverlay("single", 1);

    let worker: any = null;
    try {
      worker = await createTurWorker((p) => setFileProgress(p));
      const { text } = await recognizeWithFallback(worker, dataUrl);

      if (!text) throw new Error("empty");
      const parsed = parseReceiptText(text);

      // Always persist the image, even if parsing is weak.
      onMeta({ ...parsed.meta, imageDataUrl: dataUrl, ocrText: text }, dataUrl);
      onParsed?.(parsed);

      // Only auto-fill safe amount
      if (parsed.amount && parsed.amount > 0) onAmount(parsed.amount);
      else onAmount(undefined);

      setStage("Tamamlandı");
      await new Promise((r) => setTimeout(r, 200)); // show completion briefly
    } catch {
      setErr("Fiş okunamadı veya güvenilir veri çıkarılamadı. Foto eklendi; alanları manuel doldurabilirsin.");
      onMeta({ imageDataUrl: dataUrl }, dataUrl);
      onAmount(undefined);
    } finally {
      try { await worker?.terminate?.(); } catch {}
      setBusy(false);
      setOverlayOpen(false);
      setFileProgress(0);
    }
  }

  async function runBulk(files: FileList) {
    const list = Array.from(files).slice(0, 50);
    if (list.length === 0) return;

    setBusy(true);
    setErr("");
    setBulkMsg("");
    openOverlay("bulk", list.length);

    const out: Array<Parsed & { imageDataUrl: string }> = [];
    let worker: any = null;

    try {
      worker = await createTurWorker((p) => setFileProgress(p));

      for (let i = 0; i < list.length; i++) {
        setCurrent(i);
        setFileProgress(0);

        // allow UI to update timers/progress
        await new Promise((r) => requestAnimationFrame(() => r(null)));

        const f = list[i];
        const dataUrl = await fileToDataUrl(f);

        try {
          const { text } = await recognizeWithFallback(worker, dataUrl);
          const parsed = parseReceiptText(text || "");

          out.push({
            ...parsed,
            imageDataUrl: dataUrl,
            meta: { ...parsed.meta, imageDataUrl: dataUrl, ocrText: text || parsed.meta.ocrText },
          } as any);
        } catch {
          out.push({
            meta: { imageDataUrl: dataUrl, ocrText: "" },
            amount: undefined,
            category: undefined,
            merchantLabel: undefined,
            note: "Tutar/alanlar okunamadı — kontrol et",
            confidence: "low",
            imageDataUrl: dataUrl,
          } as any);
        }
      }

      setCurrent(list.length);
      setStage("Tamamlandı");
      await new Promise((r) => setTimeout(r, 250));
    } catch {
      setErr("Toplu OCR başarısız oldu. Tekli fiş ile deneyebilirsin.");
      setBusy(false);
      setOverlayOpen(false);
      return;
    } finally {
      try { await worker?.terminate?.(); } catch {}
      setBusy(false);
      setOverlayOpen(false);
      setFileProgress(0);
      setCurrent(0);
    }

    const okAmount = out.filter((x) => typeof x.amount === "number" && (x.amount as number) > 0).length;
    const missing = out.length - okAmount;

    setBulkMsg(
      `${out.length} fiş işlendi. ${okAmount} fişte tutar bulundu, ${missing} fişte tutar bulunamadı (Düzenle ile tamamlayabilirsin).`
    );
    onBulkParsed?.(out);
  }

  const overlay = overlayOpen ? (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="text-sm font-semibold text-slate-100">
            {phase === "bulk" ? "Fişler işleniyor" : "Fiş işleniyor"}
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
            onClick={() => setOverlayOpen(false)}
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          <div className="text-xs text-slate-300">
            Aşama: <span className="font-semibold text-slate-100">{stage}</span>
          </div>

          <div className="mt-1 text-xs text-slate-300">
            Süre: <span className="font-semibold text-slate-100">{elapsed}</span>
            {phase === "bulk" ? (
              <>
                {" "}
                • {current + 1}/{total} • Kalan tahmini:{" "}
                <span className="font-semibold text-slate-100">{formatEta(etaSeconds)}</span>
              </>
            ) : null}
          </div>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-white/40" style={{ width: `${Math.round(overall * 100)}%` }} />
          </div>

          <div className="mt-2 text-xs text-slate-400">{Math.round(overall * 100)}%</div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-[12px] text-slate-300">
            Not: Ücretsiz (tarayıcı içi) OCR’da en iyi sonuç için fişi düz, net ve gölge olmadan çek. Yine de
            bazı fişlerde “Düzenle” ile küçük düzeltme gerekebilir.
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-3">
      {typeof document !== "undefined" ? createPortal(overlay, document.body) : null}

      <div className="flex flex-wrap items-center gap-2">
        <label className="btn btn-ghost h-11 cursor-pointer gap-2">
          <FileUp className="h-4 w-4" />
          Foto yükle
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const dataUrl = await fileToDataUrl(f);
              setPreview(dataUrl);
              await runSingle(dataUrl);
              e.target.value = "";
            }}
          />
        </label>

        <label className="btn btn-ghost h-11 cursor-pointer gap-2">
          <Camera className="h-4 w-4" />
          Kamera
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const dataUrl = await fileToDataUrl(f);
              setPreview(dataUrl);
              await runSingle(dataUrl);
              e.target.value = "";
            }}
          />
        </label>

        <label className="btn btn-ghost h-11 cursor-pointer gap-2">
          <Images className="h-4 w-4" />
          Toplu (≤50)
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={async (e) => {
              const fs = e.target.files;
              if (!fs || fs.length === 0) return;
              await runBulk(fs);
              e.target.value = "";
            }}
          />
        </label>

        <div className="ml-auto inline-flex items-center gap-2 text-xs text-slate-400">
          <Sparkles className="h-4 w-4" />
          {busy ? "OCR çalışıyor…" : "Foto/Kamera → OCR → otomatik doldur. Toplu yükleme destekli."}
        </div>
      </div>

      {preview ? (
        <img src={preview} alt="Fiş önizleme" className="max-h-48 w-auto rounded-2xl border border-white/10" />
      ) : null}

      {bulkMsg ? <div className="text-xs text-slate-300">{bulkMsg}</div> : null}
      {err ? <div className="text-xs text-amber-300">{err}</div> : null}
    </div>
  );
}
