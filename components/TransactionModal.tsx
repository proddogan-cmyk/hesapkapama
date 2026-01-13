"use client";

import * as React from "react";
import clsx from "clsx";
import { Camera, ImagePlus, Loader2, X, UploadCloud } from "lucide-react";
import type { Category, ReceiptMeta, Transaction, TxKind, TxSubtype } from "@/lib/types";
import { CATEGORIES, defaultCategoryForKind, subtypeLabels, useAppStore, useStoreActions } from "@/lib/store";
import { runOcr } from "@/lib/receipt/ocr";
import { runVisionReceipt, resizeDataUrlForVision } from "@/lib/receipt/vision";
import { parseReceiptText } from "@/lib/receipt/parse";
import { canonicalName } from "@/lib/name";

type Props = {
  open: boolean;
  kind: TxKind;
  editTx?: Transaction | null;
  prefillFiles?: File[] | null;
  onClose: () => void;
};

function fmtNowTs() {
  return Date.now();
}

function toTryInt(s: string): number | null {
  const cleaned = s.replace(/[^0-9.,]/g, "").trim();
  if (!cleaned) return null;
  const normalized = cleaned.replace(/\./g, "").replace(/,/g, ".");
  const v = Number(normalized);
  if (!Number.isFinite(v)) return null;
  return v;
}

export default function TransactionModal({ open, kind, editTx = null, prefillFiles = null, onClose }: Props) {
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const [projectId, setProjectId] = React.useState<string>("");
  const projects = useAppStore((s) => s.projects);
  const profile = useAppStore((s) => s.profile);
  const effectiveProjectId = selectedProjectId && selectedProjectId !== "__all__" ? selectedProjectId : undefined;
  const nameTags = useAppStore((s) => s.nameTags);
  const { addTransaction, addTransactionsBulk, updateTransaction } = useStoreActions();

const resolvedProjectId = React.useMemo(() => {
  if (projectId) return projectId;
  if (selectedProjectId && selectedProjectId !== "__all__") return selectedProjectId;
  return projects[0]?.id || "";
}, [projectId, selectedProjectId, projects]);

const resolvedProjectName = React.useMemo(() => {
  return projects.find((p) => p.id === resolvedProjectId)?.name || "";
}, [projects, resolvedProjectId]);

const currentUserName = React.useMemo(() => {
  const fn = String((profile as any)?.firstName ?? "").trim();
  const ln = String((profile as any)?.lastName ?? "").trim();
  return `${fn} ${ln}`.trim();
}, [profile]);

const currentUserRole = React.useMemo(() => {
  return String((profile as any)?.title ?? "").trim();
}, [profile]);

const [memberOptions, setMemberOptions] = React.useState<string[]>([]);
const [membersLoading, setMembersLoading] = React.useState(false);


  const [subtype, setSubtype] = React.useState<TxSubtype>(kind === "income" ? "advance_in" : "generic");
  const [category, setCategory] = React.useState<Category>(defaultCategoryForKind(kind));
  const [who, setWho] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [receiptNo, setReceiptNo] = React.useState<string>("");
  const [amount, setAmount] = React.useState<string>("");
  const [ts, setTs] = React.useState<number>(fmtNowTs());

  const [receipt, setReceipt] = React.useState<ReceiptMeta | undefined>(undefined);
  const [ocrStatus, setOcrStatus] = React.useState<string>("");
  const [ocrProgress, setOcrProgress] = React.useState<number>(0);
  const [ocrBusy, setOcrBusy] = React.useState<boolean>(false);

const [useVision, setUseVision] = React.useState<boolean>(true);
const [visionStatus, setVisionStatus] = React.useState<string>("");


  const [cameraOpen, setCameraOpen] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  const reset = React.useCallback(() => {
    setSubtype(kind === "income" ? "advance_in" : "generic");
    setCategory(defaultCategoryForKind(kind));
    setWho("");
    setDesc("");
    setReceiptNo("");
    setAmount("");
    setTs(fmtNowTs());
    setReceipt(undefined);
    setOcrStatus("");
    setOcrProgress(0);
    setOcrBusy(false);
    setUseVision(true);
    setVisionStatus("");
    setCameraOpen(false);
  }, [kind]);

// Prefill when editing
React.useEffect(() => {
  if (!open) return;
  if (!editTx) return;

  // Ensure modal is aligned to the transaction kind
  setSubtype(editTx.subtype);
  setCategory(editTx.category);
  setWho(editTx.who ?? "");
  setDesc(editTx.description ?? "");
  setAmount(String(editTx.amount ?? ""));
  setTs(editTx.ts);
  setReceipt(editTx.receipt);
  setOcrStatus("");
  setOcrProgress(0);
  setOcrBusy(false);
  setCameraOpen(false);
}, [open, editTx]);



  React.useEffect(() => {
    if (!open) return;
    reset();
  }, [open, reset]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // subtype changes adjust category defaults
  React.useEffect(() => {
    if (kind === "income") {
      setCategory("AVANS");
    } else {
      if (subtype === "advance_out") setCategory("AVANS");
      if (subtype === "generic" && category === "AVANS") setCategory("DİĞER");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtype, kind]);

const prefillUsed = React.useRef(false);

React.useEffect(() => {
  if (!open) {
    prefillUsed.current = false;
    return;
  }
  if (!prefillFiles || prefillFiles.length === 0) return;
  if (prefillUsed.current) return;

  prefillUsed.current = true;

  try {
    const dt = new DataTransfer();
    for (const f of prefillFiles.slice(0, 50)) dt.items.add(f);

    if (dt.files.length === 1) {
      onPickSingleFile(dt.files[0]);
    } else {
      onPickBulkFiles(dt.files);
    }
  } catch {
    onPickSingleFile(prefillFiles[0] ?? null);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [open, prefillFiles]);

  if (!open) return null;

  const canSubmit = Boolean(effectiveProjectId) && Boolean(who.trim()) && Boolean(toTryInt(amount) != null);

  const submit = async () => {
  if (!resolvedProjectId) return;

  const v = toTryInt(amount);
  if (v == null || v <= 0) return;

  const isAdvance = subtype === "advance_in" || subtype === "advance_out";

  if (isAdvance) {
    if (!currentUserName) return;
    if (!resolvedProjectName) return;

    const counterparty = String(who || "").trim();
    if (!counterparty) return;

    const fromName = subtype === "advance_out" ? currentUserName : counterparty;
    const toName = subtype === "advance_out" ? counterparty : currentUserName;

    const approvalBy = subtype === "advance_out" ? toName : fromName;

    await fetch("/api/advance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectName: resolvedProjectName,
        projectId: resolvedProjectId,
        amount: v,
        fromName,
        fromRole: subtype === "advance_out" ? currentUserRole : "",
        toName,
        toRole: subtype === "advance_in" ? currentUserRole : "",
        approvalBy,
        note: String(desc || "").trim(),
        createdBy: currentUserName,
      }),
    }).catch(() => null);

    onClose();
    return;
  }

  const tx: Omit<Transaction, "id"> = {
    projectId: resolvedProjectId,
    ts,
    kind,
    category,
    subtype,
    who,
    description: desc,
    amount: v,
    receiptNo,
    receiptUrls: receiptUrls ?? [],
  };

  if (editTx) {
    updateTransaction(editTx.id, tx);
  } else {
    addTransaction(tx);
  }

  onClose();
};
;

  
const extractReceiptNo = (t: string): string => {
  const m =
    t.match(/(?:fi[şs]\s*no|fis\s*no|receipt\s*no|belge\s*no|document\s*no)\s*[:#\-]?\s*([A-Z0-9\-\/]{4,})/i) ||
    t.match(/(?:FIS|FIŞ)\s*NO\s*[:#\-]?\s*([A-Z0-9\-\/]{4,})/i);
  return m ? String(m[1] || "").trim() : "";
};

const extractTaxId = (t: string): string => {
  const m =
    t.match(/(?:vkn|vergi\s*no|tax\s*id)\s*[:#\-]?\s*([0-9]{10,11})/i) ||
    t.match(/\b([0-9]{10})\b\s*(?:vkn|vergi)/i);
  return m ? String(m[1] || "").trim() : "";
};

const extractMerchant = (t: string): string => {
  const lines = t.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  for (const ln of lines.slice(0, 6)) {
    if (/^(fi[şs]|fis|fatura|invoice|tarih|date|saat|time|toplam|total|kdv|vat)/i.test(ln)) continue;
    if (ln.length >= 3 && ln.length <= 40) return ln;
  }
  return "";
};

const applyVision = (extracted: any, imageDataUrl: string) => {
  const merchant = String(extracted?.merchant || "").trim();
  const taxId = String(extracted?.taxId || "").trim();
  const rno = String(extracted?.receiptNo || "").trim();
  const total = extracted?.total;
  const dateISO = String(extracted?.dateISO || "").trim();
  const timeHHMM = String(extracted?.timeHHMM || "").trim();

  const tsFromVision = (() => {
    if (!dateISO) return null;
    const dtStr = timeHHMM ? `${dateISO}T${timeHHMM}:00` : `${dateISO}T12:00:00`;
    const ms = new Date(dtStr).getTime();
    return Number.isFinite(ms) ? ms : null;
  })();

  const nextReceipt: ReceiptMeta = {
    imageDataUrl,
    // @ts-ignore
    ocrText: typeof extracted?.rawText === "string" ? extracted.rawText : undefined,
    brand: merchant || undefined,
    // @ts-ignore
    taxId: taxId || undefined,
    // @ts-ignore
    receiptNo: rno || undefined,
    // @ts-ignore
    ai: { extracted },
  };

  setReceipt(nextReceipt);

  if (kind === "expense") {
    if (merchant) setWho(merchant);
    if (typeof total === "number" && Number.isFinite(total) && total > 0) setAmount(String(total));
    if (tsFromVision) setTs(tsFromVision);
    setSubtype("generic");
  }

  if (rno) setReceiptNo(rno);
};

const applyParsed = (parsedText: string, imageDataUrl: string) => {
    const parsed = parseReceiptText(parsedText);
    const rno = extractReceiptNo(parsedText);
    const taxId = extractTaxId(parsedText);
    const merchantGuess = parsed.brand || extractMerchant(parsedText);
    const nextReceipt: ReceiptMeta = {
      imageDataUrl,
      ocrText: parsedText,
      brand: merchantGuess || undefined,
      // @ts-ignore
      taxId: taxId || undefined,
      // @ts-ignore
      receiptNo: rno || undefined,
      plate: parsed.plate,
      inferredCategory: parsed.category,
    };
    setReceipt(nextReceipt);

    if (kind === "expense") {
      if (parsed.category && parsed.category !== "AVANS") setCategory(parsed.category);
      if (merchantGuess) setWho(merchantGuess);
      if (rno) setReceiptNo(rno);
      if (parsed.plate) setDesc((d) => (d ? d + " | " : "") + `Plaka: ${parsed.plate}`);
      if (parsed.amount != null) setAmount(String(parsed.amount));
      if (parsed.dateMs) setTs(parsed.dateMs);
      setSubtype("generic");
    } else {
      // income: do not override who for advances; keep user-driven
      if (parsed.amount != null && toTryInt(amount) == null) setAmount(String(parsed.amount));
    }
  };

  const onPickSingleFile = async (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    
reader.onload = async () => {
  const imageDataUrlRaw = String(reader.result || "");
  const imageDataUrl = useVision ? await resizeDataUrlForVision(imageDataUrlRaw) : imageDataUrlRaw;

  setReceipt({ imageDataUrl });
  setOcrBusy(true);
  setOcrProgress(0);
  setOcrStatus("Fiş okunuyor…");
  setVisionStatus("");

  try {
    if (useVision) {
      setVisionStatus("AI (Vision) çalışıyor…");
      const res = await runVisionReceipt(imageDataUrl);
      if (res?.ok && res.extracted) {
        applyVision(res.extracted, imageDataUrl);
        setOcrStatus("AI ile okundu ve alanlar dolduruldu.");
        return;
      }
      setVisionStatus(res?.error ? String(res.error) : "AI okuma başarısız. OCR deneniyor…");
    }

    const text = await runOcr(imageDataUrl, (p, s) => {
      setOcrProgress(p);
      setOcrStatus(s === "recognizing text" ? "Metin çözülüyor…" : "İşleniyor…");
    });
    if (!text.trim()) {
      setOcrStatus("OCR boş döndü. Manuel girilebilir.");
      return;
    }
    applyParsed(text, imageDataUrl);
    setOcrStatus("Fiş okundu ve alanlar dolduruldu.");
  } catch (e: any) {
    setOcrStatus(`Okuma hata: ${e?.message || "Bilinmeyen"}`);
  } finally {
    setOcrBusy(false);
  }
};
    reader.readAsDataURL(file);
  };

  const onPickBulkFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!effectiveProjectId) return;

    const list = Array.from(files).slice(0, 50);

    setOcrBusy(true);
    setOcrProgress(0);
    setOcrStatus(`${useVision ? "AI ile" : "OCR ile"} toplu fiş işleniyor (${list.length})…`);

    const txs: Array<Omit<Transaction, "id">> = [];
    let done = 0;

    for (const file of list) {
      
const imageDataUrlRaw = await new Promise<string>((resolve) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result || ""));
  r.readAsDataURL(file);
});

const imageDataUrl = useVision ? await resizeDataUrlForVision(imageDataUrlRaw) : imageDataUrlRaw;

let parsedText = "";
let visionExtracted: any = null;

if (useVision) {
  try {
    const res = await runVisionReceipt(imageDataUrl);
    if (res?.ok && res.extracted) visionExtracted = res.extracted;
  } catch {
    visionExtracted = null;
  }
}

if (!visionExtracted) {
  try {
    parsedText = await runOcr(imageDataUrl, () => {
      // per-file progress isn't linear; show total progress instead
    });
  } catch {
    parsedText = "";
  }
}

const parsed = parsedText ? parseReceiptText(parsedText) : {};
const merchant = String(visionExtracted?.merchant || parsed.brand || "").trim() || "Bilinmiyor";
const total =
  typeof visionExtracted?.total === "number" && Number.isFinite(visionExtracted.total)
    ? visionExtracted.total
    : typeof parsed.amount === "number"
      ? parsed.amount
      : 0;

const dateISO = String(visionExtracted?.dateISO || "").trim();
const timeHHMM = String(visionExtracted?.timeHHMM || "").trim();
const inferredTs =
  dateISO
    ? (() => {
        const dtStr = timeHHMM ? `${dateISO}T${timeHHMM}:00` : `${dateISO}T12:00:00`;
        const ms = new Date(dtStr).getTime();
        return Number.isFinite(ms) ? ms : (parsed.dateMs || Date.now());
      })()
    : (parsed.dateMs || Date.now());

const inferredCategory = parsed.category && parsed.category !== "AVANS" ? parsed.category : "DİĞER";

const receiptMeta: ReceiptMeta = {
  imageDataUrl,
  ocrText: parsedText,
  brand: merchant,
  plate: parsed.plate,
  inferredCategory: inferredCategory as any,
  // @ts-ignore
  taxId: String(visionExtracted?.taxId || "").trim() || undefined,
  // @ts-ignore
  receiptNo: String(visionExtracted?.receiptNo || "").trim() || undefined,
  // @ts-ignore
  ai: visionExtracted ? { extracted: visionExtracted } : undefined,
};

txs.push({
  projectId: effectiveProjectId,
  ts: inferredTs,
  kind: "expense",
  subtype: "generic",
  category: inferredCategory as Category,
  who: merchant,
  description: parsed.plate ? `Plaka: ${parsed.plate}` : "",
  amount: total,
  receipt: receiptMeta,
  // @ts-ignore
  receiptNo: String(visionExtracted?.receiptNo || "").trim() || undefined,
});

      done++;
      setOcrProgress(Math.round((done / list.length) * 100));
      setOcrStatus(`Toplu fiş işleniyor… (${done}/${list.length})`);
    }

    // sort by date ascending for readability
    txs.sort((a, b) => a.ts - b.ts);

    addTransactionsBulk(txs);
    setOcrStatus(`Toplu fiş eklendi: ${txs.length} adet.`);
    setOcrBusy(false);
    onClose();
  };

  const openCamera = async () => {
    setCameraOpen(true);
    setOcrStatus("");
    setOcrProgress(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (e: any) {
      setOcrStatus(`Kamera açılamadı: ${e?.message || "İzin yok"}`);
      setCameraOpen(false);
    }
  };

  const closeCamera = () => {
    streamRef.current?.getTracks()?.forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  const captureFromCamera = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    closeCamera();

    setReceipt({ imageDataUrl: dataUrl });
    setOcrBusy(true);
    setOcrProgress(0);
    
setOcrStatus("Fiş okunuyor…");
setVisionStatus("");
try {
  const dataUrlOptimized = useVision ? await resizeDataUrlForVision(dataUrl) : dataUrl;

  if (useVision) {
    setVisionStatus("AI (Vision) çalışıyor…");
    const res = await runVisionReceipt(dataUrlOptimized);
    if (res?.ok && res.extracted) {
      applyVision(res.extracted, dataUrlOptimized);
      setOcrStatus("AI ile okundu ve alanlar dolduruldu.");
      return;
    }
    setVisionStatus(res?.error ? String(res.error) : "AI okuma başarısız. OCR deneniyor…");
  }

  const text = await runOcr(dataUrlOptimized, (p, s) => {
    setOcrProgress(p);
    setOcrStatus(s === "recognizing text" ? "Metin çözülüyor…" : "İşleniyor…");
  });
  if (!text.trim()) {
    setOcrStatus("OCR boş döndü. Manuel girilebilir.");
    return;
  }
  applyParsed(text, dataUrlOptimized);
  setOcrStatus("Fiş okundu ve alanlar dolduruldu.");
} catch (e: any) {
  setOcrStatus(`Okuma hata: ${e?.message || "Bilinmeyen"}`);
} finally {
  setOcrBusy(false);
}
  };

  const header = kind === "income" ? "Giriş (+)" : "Çıkış (–)";

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[94vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-slate-100">{header}</div>
            <div className="text-xs text-slate-400">
              {selectedProjectId ? "Seçili projeye işlem eklenecek." : "Önce proje seçmelisin."}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-950/60 text-slate-200 hover:bg-white/10 [color-scheme:dark]"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-auto px-5 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-xs text-slate-300">
              Tür
              <select
                value={subtype}
                onChange={(e) => setSubtype(e.target.value as TxSubtype)}
                className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none [color-scheme:dark]"
              >
                {subtypeLabels(kind).map((o) => (
                  <option key={o.value} value={o.value} className="bg-slate-950 text-slate-100">
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-xs text-slate-300">
              Kategori
              <select
                value={subtype === "advance_in" || subtype === "advance_out" ? "AVANS" : category}
                onChange={(e) => setCategory(e.target.value as Category)}
                disabled={subtype === "advance_in" || subtype === "advance_out"}
                className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none disabled:opacity-60 [color-scheme:dark]"
              >
                {(subtype === "advance_in" || subtype === "advance_out") ? (
                  <option value="AVANS" className="bg-slate-950 text-slate-100">AVANS</option>
                ) : (
                  CATEGORIES.map((c) => (
                    <option key={c} value={c} className="bg-slate-950 text-slate-100">{c}</option>
                  ))
                )}
              </select>
            </label>

            <label className="grid gap-2 text-xs text-slate-300 md:col-span-2">
              {subtype === "advance_in" ? "Kimden aldın?" : subtype === "advance_out" ? "Kime verdin?" : "Kim (Firma)?"}
              <input
                value={who}
                onChange={(e) => setWho(e.target.value)}
                list={(subtype === "advance_in" || subtype === "advance_out") ? "nameTags" : undefined}
                className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 [color-scheme:dark]"
                placeholder={(subtype === "advance_in" || subtype === "advance_out") ? "Örn: Tolga Erener" : "Örn: Bayrampaşa Shell"}
              />
              <datalist id="nameTags">
                {nameTags.map((n) => <option key={n} value={n} />)}
              </datalist>
            </label>

            <label className="grid gap-2 text-xs text-slate-300 md:col-span-2">
              Açıklama
              <input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 [color-scheme:dark]"
                placeholder="Örn: Plaka: 34ABC123 | Not"
              />
            </label>

            <label className="grid gap-2 text-xs text-slate-300 md:col-span-2">
              Fiş No
              <input
                value={receiptNo}
                onChange={(e) => setReceiptNo(e.target.value)}
                className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 [color-scheme:dark]"
                placeholder="Örn: 001234 / ZR-1234"
              />
            </label>

            <label className="grid gap-2 text-xs text-slate-300">
              Tutar (₺)
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 [color-scheme:dark]"
                placeholder="Örn: 1250"
              />
            </label>

            <label className="grid gap-2 text-xs text-slate-300">
              Tarih/Saat
              <input
                type="datetime-local"
                value={new Date(ts).toISOString().slice(0, 16)}
                onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                const ms = new Date(v).getTime();
                if (Number.isFinite(ms)) setTs(ms);
              }}
                className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none [color-scheme:dark]"
              />
            </label>
          </div>

          {kind === "expense" && subtype === "generic" && (
            <div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/60 p-4 [color-scheme:dark]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-100">Fiş (kamera veya foto)</div>
                  <div className="text-xs text-slate-400">Fişi okutunca kategori, tutar, firma ve plaka otomatik doldurulur.</div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 [color-scheme:dark]">
                    <ImagePlus className="h-4 w-4" />
                    Foto Yükle
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickSingleFile(e.target.files?.[0] ?? null)} />
                  </label>

                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 [color-scheme:dark]">
                    <UploadCloud className="h-4 w-4" />
                    Toplu (≤50)
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onPickBulkFiles(e.target.files)} />
                  </label>

                  <button
                    type="button"
                    onClick={openCamera}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                  >
                    <Camera className="h-4 w-4" />
                    Kamera
                  </button>
                </div>
              </div>

              {receipt?.imageDataUrl && (
                <div className="mt-4 grid gap-3 md:grid-cols-[140px_1fr]">
                  <img
                    src={receipt.imageDataUrl}
                    alt="Fiş"
                    className="h-28 w-full rounded-2xl border border-white/10 object-cover"
                  />
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-xs text-slate-300">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-slate-100">OCR Durumu</div>
                      {ocrBusy && <Loader2 className="h-4 w-4 animate-spin text-slate-300" />}
                    </div>
                    <div className="mt-2 text-slate-300">{ocrStatus || "Fiş eklendi. Okumak için bir aksiyon seç."}</div>
                    {ocrBusy && (
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div className="h-full bg-emerald-500" style={{ width: `${ocrProgress}%` }} />
                      </div>
                    )}
                    {receipt.brand || receipt.plate || receipt.inferredCategory ? (
                      <div className="mt-3 text-slate-400">
                        {receipt.brand ? <span className="mr-3">Marka: <span className="text-slate-200">{receipt.brand}</span></span> : null}
                        {receipt.inferredCategory ? <span className="mr-3">Kategori: <span className="text-slate-200">{receipt.inferredCategory}</span></span> : null}
                        {receipt.plate ? <span>Plaka: <span className="text-slate-200">{receipt.plate}</span></span> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          )}

          {cameraOpen && (
            <div className="mt-4 rounded-3xl border border-white/10 bg-slate-950/60 p-4 [color-scheme:dark]">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-100">Kamera</div>
                <button
                  type="button"
                  onClick={closeCamera}
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 [color-scheme:dark]"
                >
                  Kapat
                </button>
              </div>
              <video ref={videoRef} className="mt-3 w-full rounded-2xl border border-white/10 bg-black" playsInline />
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={captureFromCamera}
                  className="rounded-2xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                >
                  Çek & Oku
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-slate-950/60 px-5 py-4">
          <div className="text-xs text-slate-400">
            {selectedProjectId ? "Kaydetmeye hazır." : "Proje seçmeden kayıt edemezsin."}
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className={clsx(
              "h-11 rounded-2xl px-5 text-sm font-semibold transition",
              canSubmit ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400" : "bg-white/10 text-slate-500"
            )}
          >
            {editTx ? "Güncelle" : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}
