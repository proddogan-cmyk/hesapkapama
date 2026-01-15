"use client";

import * as React from "react";
import clsx from "clsx";
import { Loader2, X, CheckCircle2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import type { Category, ReceiptMeta, Transaction } from "@/lib/types";
import { CATEGORIES, defaultCategoryForKind, useAppStore, useStoreActions } from "@/lib/store";
import ReceiptViewer from "@/components/ReceiptViewer";
import { runVisionReceipt, resizeDataUrlForVision } from "@/lib/receipt/vision";
import { ConfirmModal } from "@/components/ConfirmModal";
import { formatCredits, getOrCreateLocalUserId } from "@/lib/creditsClient";

type Props = {
  open: boolean;
  projectId: string | null;
  files: File[];
  onClose: () => void;
};

type RowStatus = "idle" | "processing" | "done" | "error";

type ReviewLevel = "none" | "warn" | "error";

type Row = {
  id: string;
  file: File;
  thumbUrl: string;

  imageDataUrl?: string;

  approved: boolean;
  status: RowStatus;
  error?: string;

  category: Category;
  total: string;
  receiptNo: string;
  description: string;

  merchant: string;
  rawText: string;
  aiExtracted?: any;

  aiConfidence?: number | null;
  reviewLevel?: ReviewLevel;
  reviewMessage?: string;
  reviewed?: boolean;

  dateMs?: number;
  dateISO?: string;
};

function safeId(): string {
  try {
    // @ts-ignore
    return crypto?.randomUUID?.() || String(Date.now() + Math.random());
  } catch {
    return String(Date.now() + Math.random());
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Dosya okunamadı"));
    r.readAsDataURL(file);
  });
}

function toTryNumber(v: any): number | null {
  if (v == null) return null;
  const s = String(v).replace(/[^0-9,\.]/g, "").trim();
  if (!s) return null;
  // "1.234,56" or "1234.56" etc.
  const normalized =
    s.includes(",") && s.includes(".")
      ? s.lastIndexOf(",") > s.lastIndexOf(".")
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "")
      : s.includes(",")
        ? s.replace(",", ".")
        : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function parseDateMs(dateISO?: string, timeHHMM?: string): number | undefined {
  if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return undefined;
  const [y, m, d] = dateISO.split("-").map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return undefined;

  let hh = 12;
  let mm = 0;
  if (timeHHMM && /^\d{1,2}:\d{2}$/.test(timeHHMM)) {
    const [h1, m1] = timeHHMM.split(":").map((x) => Number(x));
    if (Number.isFinite(h1)) hh = Math.max(0, Math.min(23, h1));
    if (Number.isFinite(m1)) mm = Math.max(0, Math.min(59, m1));
  }
  // Local time is fine (stored as ms)
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

function inferCategoryFromText(t: string): Category {
  const s = t.toLowerCase();

  const has = (...xs: string[]) => xs.some((x) => s.includes(x));

  if (has("taksi", "taxi")) return "TAKSİ";
  if (has("opet", "shell", "bp", "petrol", "akaryak", "fuel", "totalenergies", "po/")) return "ULAŞIM";
  if (has("yemek", "restaurant", "restoran", "cafe", "kahve", "burger", "pizza", "lokanta", "yemeksepeti", "getir")) return "YEMEK";
  if (has("otel", "hotel", "konaklama", "pansiyon", "booking")) return "KONAKLAMA";
  if (has("vodafone", "turkcell", "türk telekom", "turktelekom", "internet", "fatura", "gsm")) return "İLETİŞİM";
  if (has("kırtasiye", "kirtasiye", "ofis", "stationery")) return "OFİS-KIRTASİYE";
  if (has("kiralama", "mekan", "venue", "salon")) return "MEKAN";

  return "DİĞER";
}

function inferCategory(extracted: any, merchant: string, rawText: string): Category {
  const hint = String(extracted?.note || extracted?.category || "").trim();
  const combo = [merchant, hint, rawText].filter(Boolean).join("\n");
  return inferCategoryFromText(combo);
}

function computeReview(extracted: any, row: { category: Category; total: string; receiptNo: string; description: string }) {
  const confidence = typeof extracted?.confidence === "number" ? extracted.confidence : null;
  const amount = toTryNumber(row.total);
  const missing: string[] = [];
  if (!amount || amount <= 0) missing.push("tutar");
  if (!String(row.category || "").trim()) missing.push("kategori");
  if (!String(row.description || "").trim()) missing.push("açıklama");

  if (missing.length) {
    return {
      level: "error" as const,
      message: `Eksik alan: ${missing.join(", ")}. Fiş tahrip/okunmamış olabilir; lütfen düzelt.`,
      confidence,
    };
  }

  // Low confidence -> require user review
  if (confidence != null && confidence < 0.45) {
    return {
      level: "error" as const,
      message: "AI düşük güven verdi. Fiş tahrip/okunması zor görünüyor; kaydetmeden önce mutlaka kontrol et.",
      confidence,
    };
  }
  if (confidence != null && confidence < 0.65) {
    return {
      level: "warn" as const,
      message: "AI orta/düşük güven verdi. Kaydetmeden önce alanları kontrol et.",
      confidence,
    };
  }

  // Category is DİĞER but looks like a structured receipt -> warn
  if (row.category === "DİĞER") {
    return {
      level: "warn" as const,
      message: "Kategori DİĞER kaldı. Fişin türünü kontrol et (benzin/taksi vb.).",
      confidence,
    };
  }

  return { level: "none" as const, message: "", confidence };
}

function evaluateReview(args: {
  receiptType: string;
  plate: string;
  category: Category;
  totalText: string;
  description: string;
  confidence: number | null | undefined;
  error?: string;
}): { level: ReviewLevel; message: string } {
  const conf = typeof args.confidence === "number" && Number.isFinite(args.confidence) ? args.confidence : null;
  const amountOk = toTryNumber(args.totalText) != null && (toTryNumber(args.totalText) as number) > 0;
  const descOk = String(args.description || "").trim().length > 1;

  if (args.error) return { level: "error", message: "Okuma hatası: tekrar dene veya manuel düzelt." };
  if (!amountOk) return { level: "error", message: "Tutar okunamadı. Lütfen kontrol et." };
  if (!descOk) return { level: "warn", message: "Açıklama zayıf/boş. Merchant veya fiş türünü doğrula." };

  const rt = String(args.receiptType || "").toLowerCase();
  if (rt === "fuel" && args.category === "DİĞER") {
    return { level: "warn", message: "Benzin fişi görünüyor. Kategoriyi kontrol et." };
  }
  if (rt === "taxi" && args.category !== "TAKSİ") {
    return { level: "warn", message: "Taksi fişi görünüyor. Kategoriyi kontrol et." };
  }
  if (rt === "fuel" && !String(args.plate || "").trim()) {
    return { level: "warn", message: "Plaka okunamadı. Fişten kontrol edip açıklamaya ekle." };
  }

  if (conf != null && conf < 0.45) {
    return { level: "error", message: "Fiş çok tahrip/okunaksız. Kaydetmeden önce mutlaka kontrol et." };
  }
  if (conf != null && conf < 0.65) {
    return { level: "warn", message: "Okuma güveni düşük. Kaydetmeden önce kontrol et." };
  }

  return { level: "none", message: "" };
}

export default function ReceiptApprovalModal({ open, projectId, files, onClose }: Props) {
  const projects = useAppStore((s) => s.projects);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const { addTransactionsBulk } = useStoreActions();

  const effectiveProjectId =
    projectId ||
    (selectedProjectId && selectedProjectId !== "__all__" ? selectedProjectId : null);

  const [rows, setRows] = React.useState<Row[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmed, setConfirmed] = React.useState(false);
  const [creditBalance, setCreditBalance] = React.useState<number | null>(null);
  const [creditChecking, setCreditChecking] = React.useState(false);
  const [creditCheckError, setCreditCheckError] = React.useState<string>("");
  const [creditError, setCreditError] = React.useState<string>("");

  const stopRef = React.useRef(false);

  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [viewerSrc, setViewerSrc] = React.useState("");
  const receiptCount = Math.min(files.length, 50);
  const creditInsufficient =
    creditBalance != null && Number.isFinite(creditBalance) && creditBalance < receiptCount;

  // Keep latest rows in a ref so the Vision loop always reads current state.
  const rowsRef = React.useRef<Row[]>([]);
  const cooldownUntilRef = React.useRef<number>(0);
  React.useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // Ensure we start the vision pipeline only once per modal open.
  const startedRef = React.useRef(false);

  // init rows when opened
  React.useEffect(() => {
    if (!open) return;

    stopRef.current = false;
    startedRef.current = false;
    setConfirmed(false);
    setConfirmOpen(files.length > 0);
    setCreditBalance(null);
    setCreditCheckError("");
    setCreditError("");

    const init: Row[] = (files || []).slice(0, 50).map((file) => {
      const thumbUrl = URL.createObjectURL(file);
      return {
        id: safeId(),
        file,
        thumbUrl,
        approved: true,
        status: "idle",
        category: defaultCategoryForKind("expense"),
        total: "",
        receiptNo: "",
        description: "",
        merchant: "",
        rawText: "",
        aiConfidence: null,
        reviewLevel: "none",
        reviewMessage: "",
        reviewed: false,
      };
    });

    setRows(init);
    setBusy(false);
    setProgress({ done: 0, total: init.length });

    if (files.length > 0) {
      setCreditChecking(true);
      (async () => {
        try {
          const localUserId = getOrCreateLocalUserId();
          const res = await fetch("/api/credits/balance", {
            method: "GET",
            headers: localUserId ? { "x-local-user-id": localUserId } : {},
            cache: "no-store",
          });
          if (!res.ok) return;
          const data = await res.json().catch(() => null);
          setCreditBalance(Number((data as any)?.balance ?? 0));
        } catch {
          setCreditCheckError("Kredi bakiyesi alınamadı.");
        } finally {
          setCreditChecking(false);
        }
      })();
    }

    return () => {
      init.forEach((r) => {
        try { URL.revokeObjectURL(r.thumbUrl); } catch {}
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, files]);

  // Process queue sequentially
  React.useEffect(() => {
    if (!open) return;
    if (!confirmed) return;
    if (rows.length === 0) return;
    if (startedRef.current) return;

    startedRef.current = true;

    let cancelled = false;

    const run = async () => {
      setBusy(true);
      const total = rowsRef.current.length;
      setProgress({ done: 0, total });

      // A bit of concurrency to speed up bulk reads; we still back off on 429.
      const concurrency = 3;
      let cursor = 0;

      const worker = async () => {
        while (true) {
          if (stopRef.current) return;
          const i = cursor++;
          if (i >= total) return;

          const current = rowsRef.current[i];
          if (!current) {
            setProgress((p) => ({ ...p, done: Math.min(total, p.done + 1) }));
            continue;
          }

          setRows((prev) =>
            prev.map((r, idx) => (idx === i ? { ...r, status: "processing", error: undefined } : r))
          );

          try {
            const rawDataUrl = await fileToDataUrl(current.file);
            const resized = await resizeDataUrlForVision(rawDataUrl, 1024, 0.72);

            // If another worker recently hit a rate limit, wait for the cooldown window.
            const now = Date.now();
            if (cooldownUntilRef.current > now) {
              await new Promise((r) => setTimeout(r, cooldownUntilRef.current - now));
            }

            const res = await runVisionReceipt(resized);

            if (!res.ok && (res.status === 429 || /rate limit/i.test(String(res.error || "")))) {
              const waitMs = res.retryAfterMs ?? 1200;
              cooldownUntilRef.current = Date.now() + waitMs;
            }
            if (!res?.ok || !res.extracted) {
              if (res?.error === "insufficient_credits" || res?.status === 402) {
                stopRef.current = true;
                setCreditError("Yetersiz kredi. İşlem durduruldu.");
                throw new Error("Yetersiz kredi.");
              }
              throw new Error(res?.error ? String(res.error) : "Fiş okunamadı");
            }

            const extracted = res.extracted || {};
            const merchant = String(extracted.merchant || "").trim() || String(extracted.description || "").trim();
            const receiptType = String(extracted.receiptType || "").trim().toLowerCase();
            const plate = String(extracted.plate || "").trim();
            const seq = String(extracted.sequenceNo || "").trim();
            const receiptNo = String(extracted.receiptNo || "").trim() || seq;

            const amountNum = extracted.amount != null ? Number(extracted.amount) : Number.NaN;
            const amountText = Number.isFinite(amountNum) && amountNum > 0 ? String(amountNum) : "";

            const rawText = String(extracted.rawText || "").trim();
            const dateISO = String(extracted.dateISO || "").trim() || undefined;
            const timeHHMM = String(extracted.timeHHMM || "").trim() || undefined;
            const dateMs = parseDateMs(dateISO, timeHHMM);

            const inferred = String(extracted.category || "").trim();
            let cat = (CATEGORIES as readonly string[]).includes(inferred) ? (inferred as any) : inferCategory(extracted, merchant, rawText);

            // Hard business rules (to fix "benzin fişi DİĞER" edge cases)
            if (receiptType === "fuel" || (plate && plate.length >= 5)) {
              cat = "ULAŞIM";
            }
            if (receiptType === "taxi") {
              cat = "TAKSİ";
            }

            let description = String(extracted.description || "").trim() || merchant || "";
            // Enforce business rules:
            if (receiptType === "fuel" && plate && !description.toLowerCase().includes("plaka")) {
              description = description ? `${description} | Plaka: ${plate}` : `Plaka: ${plate}`;
            }
            if (receiptType === "taxi") {
              // Taxi: açıklamada isim + plaka (varsa) olsun
              const base = merchant || description || "Taksi";
              if (plate && !base.toLowerCase().includes("plaka")) {
                description = `${base} | Plaka: ${plate}`;
              } else {
                description = base;
              }
            }

            const aiConfidence = typeof extracted.confidence === "number" ? extracted.confidence : null;
            const ev = evaluateReview({
              receiptType,
              plate,
              category: cat,
              totalText: amountText || "",
              description: description || "",
              confidence: aiConfidence,
            });

            setRows((prev) =>
              prev.map((r, idx) =>
                idx === i
                  ? {
                      ...r,
                      status: "done",
                      imageDataUrl: resized,
                      merchant,
                      receiptNo,
                      description: description || r.description || merchant || "",
                      total: amountText || r.total,
                      category: cat || r.category,
                      rawText,
                      aiExtracted: extracted,
                      aiConfidence,
                      reviewLevel: ev.level,
                      reviewMessage: ev.message,
                      reviewed: ev.level === "none",
                      dateISO,
                      dateMs,
                    }
                  : r
              )
            );

            setProgress((p) => ({ ...p, done: Math.min(total, p.done + 1) }));
          } catch (e: any) {
            const msg = e?.message ? String(e.message) : "Fiş okunamadı";
            setRows((prev) =>
              prev.map((r, idx) => (idx === i ? { ...r, status: "error", error: msg } : r))
            );
            setProgress((p) => ({ ...p, done: Math.min(total, p.done + 1) }));
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(concurrency, total) }, () => worker()));

      setBusy(false);
    };

    // start once per open
    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rows.length, confirmed]);

  const setAllApproved = (v: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, approved: v })));
  };

  const updateRow = (id: string, patch: Partial<Row>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };

        // If user touches any AI-filled field, treat it as reviewed.
        const touches =
          Object.prototype.hasOwnProperty.call(patch, "category") ||
          Object.prototype.hasOwnProperty.call(patch, "total") ||
          Object.prototype.hasOwnProperty.call(patch, "receiptNo") ||
          Object.prototype.hasOwnProperty.call(patch, "description");
        if (touches) next.reviewed = true;

        // Re-evaluate warning state based on current values (lightweight).
        const ev = evaluateReview({
          receiptType: String((next.aiExtracted?.receiptType || "") ?? ""),
          plate: String((next.aiExtracted?.plate || "") ?? ""),
          category: next.category,
          totalText: next.total,
          description: next.description,
          confidence: next.aiConfidence,
          error: next.status === "error" ? next.error : undefined,
        });
        next.reviewLevel = ev.level;
        next.reviewMessage = ev.message;

        return next;
      })
    );
  };

  const approvedRows = rows.filter((r) => r.approved);

  const hasBlockingReview = approvedRows.some((r) => {
    const amount = toTryNumber(r.total);
    if (r.status === "error") return true;
    if (amount == null || amount <= 0) return true;
    if (!String(r.category || "").trim()) return true;
    if (!String(r.description || "").trim()) return true;
    // If AI flagged it (yellow/red) user must confirm by touching any field (reviewed)
    if (r.reviewLevel && r.reviewLevel !== "none" && !r.reviewed) return true;
    return false;
  });

  const canSave = !busy && !!effectiveProjectId && approvedRows.length > 0 && !hasBlockingReview;

  const onSave = () => {
    if (!effectiveProjectId) {
      alert("Önce proje seçmen gerekiyor.");
      return;
    }

    const approved = rows.filter((r) => r.approved);

    const txs: Array<Omit<Transaction, "id">> = [];
    for (const r of approved) {
      const amount = toTryNumber(r.total);
      if (amount == null || amount <= 0) continue;

      const who = String(r.merchant || "").trim() || "Fiş";

      const receiptMeta: ReceiptMeta = {
        imageDataUrl: r.imageDataUrl || r.thumbUrl,
        ocrText: r.rawText || undefined,
        merchant: who || undefined,
        receiptNo: r.receiptNo || undefined,
        dateISO: r.dateISO || undefined,
        inferredCategory: r.category,
      };

      const ts = r.dateMs || Date.now();

      txs.push({
        projectId: effectiveProjectId,
        ts,
        kind: "expense",
        subtype: "generic",
        category: r.category,
        who,
        description: String(r.description || "").trim(),
        amount,
        receipt: receiptMeta,
      });
    }

    if (txs.length === 0) {
      alert("En az 1 fişte Tutar dolu olmalı.");
      return;
    }

    // sort oldest->newest
    txs.sort((a, b) => a.ts - b.ts);

    addTransactionsBulk(txs);
    onClose();
  };

  if (!open) return null;

  const projectName = effectiveProjectId
    ? projects.find((p) => p.id === effectiveProjectId)?.name || ""
    : "";

  return (
    <>
      <ConfirmModal
        open={confirmOpen}
        title="Toplu fiş okuma onayı"
        description={`Seçilen ${receiptCount} fiş için ${receiptCount} kredi kullanılacak. Onaylıyor musun?`}
        confirmLabel="Onayla"
        cancelLabel="Vazgeç"
        confirmDisabled={creditChecking || creditInsufficient || receiptCount === 0}
        onCancel={() => {
          stopRef.current = true;
          onClose();
        }}
        onConfirm={() => {
          setConfirmOpen(false);
          setConfirmed(true);
        }}
      >
        {creditChecking ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
            Kredi bakiyesi kontrol ediliyor...
          </div>
        ) : creditInsufficient ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            Yetersiz kredi. Mevcut: {formatCredits(creditBalance || 0)} kredi, Gerekli: {formatCredits(receiptCount)} kredi.
            <div className="mt-2">
              <Link
                href="/app/account/buy"
                className="inline-flex h-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-slate-100 hover:bg-white/10"
              >
                Kredi Satın Al
              </Link>
            </div>
          </div>
        ) : null}
        {creditCheckError ? (
          <div className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            {creditCheckError}
          </div>
        ) : null}
      </ConfirmModal>

      <div className="fixed inset-0 z-[75]">
        <div className="absolute inset-0 bg-black/60" onClick={() => onClose()} aria-hidden="true" />

        <div className="absolute left-1/2 top-1/2 flex h-[86vh] w-[96vw] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-100">Fiş Onay</div>
              <div className="mt-1 text-xs text-slate-400">
                {effectiveProjectId ? (
                  <>
                    Proje: <span className="text-slate-200">{projectName || effectiveProjectId}</span>
                  </>
                ) : (
                  <>Proje seçmeden devam edemezsin.</>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {busy ? (
                <div className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-xs text-slate-200">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Okunuyor… {progress.done}/{progress.total}
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-xs text-slate-200">
                  Hazır
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  stopRef.current = true;
                  onClose();
                }}
                className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-slate-100 hover:bg-white/10"
              >
                <X className="mr-2 h-4 w-4" />
                Kapat
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-slate-950/60 px-5 py-3">
            {creditError ? (
              <div className="w-full rounded-2xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {creditError}{" "}
                <Link href="/app/account/buy" className="text-rose-100 underline hover:text-rose-50">
                  Kredi Satın Al
                </Link>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAllApproved(true)}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10"
              >
                Tümünü seç
              </button>
              <button
                type="button"
                onClick={() => setAllApproved(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10"
              >
                Tümünü kaldır
              </button>
            </div>

            <div className="text-xs text-slate-400">
              {rows.length} fiş (en fazla 50). Her fişi kontrol edip kaydedebilirsin.
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-auto px-5 py-4">
            <div className="space-y-3">
              {rows.map((r, idx) => (
                <div key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex flex-col gap-3 md:flex-row">
                    {/* Left: preview */}
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setViewerSrc(r.imageDataUrl || r.thumbUrl);
                          setViewerOpen(true);
                        }}
                        className="overflow-hidden rounded-2xl border border-white/10 bg-black/40"
                        title="Büyüt"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={r.imageDataUrl || r.thumbUrl} alt="Fiş" className="h-28 w-20 object-cover" />
                      </button>

                      <div className="min-w-[140px]">
                        <label className="flex items-center gap-2 text-sm text-slate-100">
                          <input
                            type="checkbox"
                            checked={r.approved}
                            onChange={(e) => updateRow(r.id, { approved: e.target.checked })}
                            className="h-4 w-4"
                          />
                          Kaydet
                        </label>

                        <div className="mt-1 text-xs text-slate-400">
                          {r.status === "processing" ? (
                            <span className="inline-flex items-center gap-1 text-slate-200">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              okunuyor
                            </span>
                          ) : r.status === "error" ? (
                            <span className="inline-flex items-center gap-1 text-amber-300">
                              <AlertTriangle className="h-3 w-3" />
                              hata
                            </span>
                          ) : r.status === "done" ? (
                            <span className="inline-flex items-center gap-1 text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" />
                              ok
                            </span>
                          ) : (
                            <span>bekliyor</span>
                          )}
                        </div>

                        {r.error ? <div className="mt-1 text-xs text-amber-200">{r.error}</div> : null}

                        {r.reviewLevel && r.reviewLevel !== "none" ? (
                          <div
                            className={clsx(
                              "mt-2 rounded-2xl border px-3 py-2 text-xs",
                              r.reviewLevel === "error"
                                ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                                : "border-amber-500/30 bg-amber-500/10 text-amber-200"
                            )}
                          >
                            {r.reviewMessage || "Kontrol gerekli."}
                            {!r.reviewed ? (
                              <label className="mt-2 flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={!!r.reviewed}
                                  onChange={(e) => updateRow(r.id, { reviewed: e.target.checked })}
                                  className="h-4 w-4"
                                />
                                Kontrol ettim
                              </label>
                            ) : (
                              <div className="mt-2 text-[11px] text-slate-300">Kontrol edildi</div>
                            )}
                          </div>
                        ) : null}
                        <div className="mt-1 text-xs text-slate-500">#{idx + 1}</div>
                      </div>
                    </div>

                    {/* Right fields */}
                    <div className="flex-1">
                      <div className="grid gap-2 md:grid-cols-6">
                        <label className="md:col-span-2">
                          <div className="mb-1 text-xs font-semibold text-slate-300">Kategori</div>
                          <select
                            value={String(r.category)}
                            onChange={(e) => updateRow(r.id, { category: e.target.value as any })}
                            className="h-10 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100"
                          >
                            {(CATEGORIES as any[]).map((c) => (
                              <option key={String(c)} value={String(c)}>
                                {String(c)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="md:col-span-2">
                          <div className="mb-1 text-xs font-semibold text-slate-300">Tutar</div>
                          <input
                            value={r.total}
                            onChange={(e) => updateRow(r.id, { total: e.target.value })}
                            placeholder="0"
                            inputMode="decimal"
                            className="h-10 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100"
                          />
                        </label>

                        <label className="md:col-span-2">
                          <div className="mb-1 text-xs font-semibold text-slate-300">Fiş No</div>
                          <input
                            value={r.receiptNo}
                            onChange={(e) => updateRow(r.id, { receiptNo: e.target.value })}
                            placeholder="(varsa)"
                            className="h-10 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100"
                          />
                        </label>

                        <label className="md:col-span-6">
                          <div className="mb-1 text-xs font-semibold text-slate-300">Açıklama</div>
                          <input
                            value={r.description}
                            onChange={(e) => updateRow(r.id, { description: e.target.value })}
                            placeholder="Örn: Faruk Eczanesi (düzenleyebilirsin)"
                            className="h-10 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100"
                          />
                        </label>
                      </div>

                      <div className="mt-2 text-xs text-slate-500">
                        Not: AI alanları doldurur; kaydetmeden önce kontrol edebilirsin.
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-slate-950/60 px-5 py-4">
            <div className="text-xs text-slate-400">
              Kaydet dediğinde seçili fişler, açık projeye gider olarak eklenir.
            </div>

            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              className={clsx(
                "h-11 rounded-2xl px-5 text-sm font-semibold transition",
                canSave ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400" : "bg-white/10 text-slate-500"
              )}
            >
              Seçilenleri Kaydet
            </button>
          </div>
        </div>
      </div>

      <ReceiptViewer open={viewerOpen} src={viewerSrc} onClose={() => setViewerOpen(false)} />
    </>
  );
}
