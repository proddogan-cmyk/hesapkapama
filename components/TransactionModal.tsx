"use client";

import * as React from "react";
import clsx from "clsx";
import { Loader2, Receipt, X } from "lucide-react";
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


  const [receiptConfirmOpen, setReceiptConfirmOpen] = React.useState(false);
  const [receiptDraft, setReceiptDraft] = React.useState<{
    imageDataUrl: string;
    merchant: string;
    category: Category;
    amount: string;
    receiptNo: string;
    plate?: string;
    receiptMeta: ReceiptMeta;
  } | null>(null);

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
    setReceiptConfirmOpen(false);
    setReceiptDraft(null);
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
  setReceiptNo(editTx.receipt?.receiptNo ?? "");
  setOcrStatus("");
  setOcrProgress(0);
  setOcrBusy(false);
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

  const nextReceipt: ReceiptMeta | undefined =
    receipt || receiptNo
      ? {
          ...(receipt ?? {}),
          receiptNo: receiptNo || receipt?.receiptNo,
        }
      : undefined;

  const tx: Omit<Transaction, "id"> = {
    projectId: resolvedProjectId,
    ts,
    kind,
    category,
    subtype,
    who,
    description: desc,
    amount: v,
    receipt: nextReceipt,
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

const isTaxiMerchant = (merchant: string) => /taksi|taxi/i.test(merchant);

const isFuelMerchant = (merchant: string) =>
  /(shell|opet|bp|petrol\s*ofisi|total|aytemiz)/i.test(merchant);

const buildAutoDescription = ({
  category,
  merchant,
  plate,
}: {
  category?: Category;
  merchant?: string;
  plate?: string;
}): string => {
  const parts: string[] = [];
  const safeMerchant = merchant?.trim();
  const safePlate = plate?.trim();
  const taxi = category === "TAKSİ" || (safeMerchant ? isTaxiMerchant(safeMerchant) : false);
  const fuel = safeMerchant ? isFuelMerchant(safeMerchant) : false;

  if (taxi) {
    if (safeMerchant) parts.push(`Taksi: ${safeMerchant}`);
    if (safePlate) parts.push(`Plaka: ${safePlate}`);
  } else if (fuel) {
    if (safePlate) parts.push(`Plaka: ${safePlate}`);
  }

  return parts.join(" | ");
};

const applyVision = (extracted: any, imageDataUrl: string) => {
  const merchant = String(extracted?.merchant || "").trim();
  const taxId = String(extracted?.taxId || "").trim();
  const rno = String(extracted?.receiptNo || "").trim();
  const total = extracted?.total;
  const dateISO = String(extracted?.dateISO || "").trim();
  const timeHHMM = String(extracted?.timeHHMM || "").trim();
  const rawText = typeof extracted?.rawText === "string" ? extracted.rawText : "";
  const parsed = rawText ? parseReceiptText(rawText) : {};
  const inferredMerchant = merchant || parsed.brand || extractMerchant(rawText);

  const tsFromVision = (() => {
    if (!dateISO) return null;
    const dtStr = timeHHMM ? `${dateISO}T${timeHHMM}:00` : `${dateISO}T12:00:00`;
    const ms = new Date(dtStr).getTime();
    return Number.isFinite(ms) ? ms : null;
  })();

  const nextReceipt: ReceiptMeta = {
    imageDataUrl,
    ocrText: rawText || undefined,
    merchant: inferredMerchant || undefined,
    taxId: taxId || undefined,
    receiptNo: rno || undefined,
    plate: parsed.plate,
    inferredCategory: parsed.category,
    ai: { extracted },
  };

  const inferredCategory =
    parsed.category && parsed.category !== "AVANS" ? parsed.category : category;
  const inferredAmount =
    typeof total === "number" && Number.isFinite(total) && total > 0 ? String(total) : "";

  setReceiptDraft({
    imageDataUrl,
    merchant: inferredMerchant,
    category: inferredCategory,
    amount: inferredAmount,
    receiptNo: rno,
    plate: parsed.plate,
    receiptMeta: nextReceipt,
  });
  setReceiptConfirmOpen(true);

  if (tsFromVision) setTs(tsFromVision);
  setSubtype("generic");
};

const applyParsed = (parsedText: string, imageDataUrl: string) => {
    const parsed = parseReceiptText(parsedText);
    const rno = extractReceiptNo(parsedText);
    const taxId = extractTaxId(parsedText);
    const merchantGuess = parsed.brand || extractMerchant(parsedText);
    const nextReceipt: ReceiptMeta = {
      imageDataUrl,
      ocrText: parsedText,
      merchant: merchantGuess || undefined,
      taxId: taxId || undefined,
      receiptNo: rno || undefined,
      plate: parsed.plate,
      inferredCategory: parsed.category,
    };
    const inferredCategory =
      parsed.category && parsed.category !== "AVANS" ? parsed.category : category;
    const inferredAmount = parsed.amount != null ? String(parsed.amount) : "";

    setReceiptDraft({
      imageDataUrl,
      merchant: merchantGuess,
      category: inferredCategory,
      amount: inferredAmount,
      receiptNo: rno,
      plate: parsed.plate,
      receiptMeta: nextReceipt,
    });
    setReceiptConfirmOpen(true);

    if (parsed.dateMs) setTs(parsed.dateMs);
    setSubtype("generic");
  };

  const onPickSingleFile = async (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    
reader.onload = async () => {
  const imageDataUrlRaw = String(reader.result || "");
  const imageDataUrl = useVision ? await resizeDataUrlForVision(imageDataUrlRaw) : imageDataUrlRaw;

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
        setOcrStatus("Fiş okundu, onay bekleniyor.");
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
    setOcrStatus("Fiş okundu, onay bekleniyor.");
  } catch (e: any) {
    setOcrStatus(`Okuma hata: ${e?.message || "Bilinmeyen"}`);
  } finally {
    setOcrBusy(false);
  }
};
    reader.readAsDataURL(file);
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (files.length === 1) {
      await onPickSingleFile(files[0]);
      return;
    }

    await onPickBulkFiles(files);
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
const autoDesc = buildAutoDescription({
  category: inferredCategory as Category,
  merchant,
  plate: parsed.plate,
});

const receiptMeta: ReceiptMeta = {
  imageDataUrl,
  ocrText: parsedText,
  merchant,
  plate: parsed.plate,
  inferredCategory: inferredCategory as any,
  taxId: String(visionExtracted?.taxId || "").trim() || undefined,
  receiptNo: String(visionExtracted?.receiptNo || "").trim() || undefined,
  ai: visionExtracted ? { extracted: visionExtracted } : undefined,
};

txs.push({
  projectId: effectiveProjectId,
  ts: inferredTs,
  kind: "expense",
  subtype: "generic",
  category: inferredCategory as Category,
  who: merchant,
  description: autoDesc || (parsed.plate ? `Plaka: ${parsed.plate}` : ""),
  amount: total,
  receipt: receiptMeta,
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

  const onConfirmReceipt = () => {
    if (!receiptDraft) return;

    const nextReceipt: ReceiptMeta = {
      ...receiptDraft.receiptMeta,
      merchant: receiptDraft.merchant || undefined,
      receiptNo: receiptDraft.receiptNo || undefined,
      inferredCategory: receiptDraft.category,
      plate: receiptDraft.plate,
    };

    setReceipt(nextReceipt);
    setReceiptNo(receiptDraft.receiptNo || "");

    if (receiptDraft.amount) setAmount(receiptDraft.amount);
    if (receiptDraft.merchant) setWho(receiptDraft.merchant);
    setCategory(receiptDraft.category);

    const autoDesc = buildAutoDescription({
      category: receiptDraft.category,
      merchant: receiptDraft.merchant,
      plate: receiptDraft.plate,
    });

    if (autoDesc) {
      setDesc((prev) => {
        const trimmed = String(prev || "").trim();
        if (!trimmed) return autoDesc;
        if (trimmed.includes(autoDesc)) return trimmed;
        return `${trimmed} | ${autoDesc}`;
      });
    }

    setReceiptConfirmOpen(false);
    setReceiptDraft(null);
  };

  const onCancelReceipt = () => {
    setReceiptConfirmOpen(false);
    setReceiptDraft(null);
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
                    <Receipt className="h-4 w-4" />
                    Fiş Ekle
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onPickFiles(e.target.files)} />
                  </label>
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
                    {receipt.merchant || receipt.plate || receipt.inferredCategory ? (
                      <div className="mt-3 text-slate-400">
                        {receipt.merchant ? <span className="mr-3">Marka: <span className="text-slate-200">{receipt.merchant}</span></span> : null}
                        {receipt.inferredCategory ? <span className="mr-3">Kategori: <span className="text-slate-200">{receipt.inferredCategory}</span></span> : null}
                        {receipt.plate ? <span>Plaka: <span className="text-slate-200">{receipt.plate}</span></span> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
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

      {receiptConfirmOpen && receiptDraft && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="text-sm font-semibold text-slate-100">Fiş Onayı</div>
              <button
                type="button"
                onClick={onCancelReceipt}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-950/60 text-slate-200 hover:bg-white/10"
                aria-label="Kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-6 px-5 py-5 md:grid-cols-[220px_1fr]">
              <div className="space-y-3">
                <img
                  src={receiptDraft.imageDataUrl}
                  alt="Fiş önizleme"
                  className="h-40 w-full rounded-2xl border border-white/10 object-cover"
                />
                <p className="text-xs text-slate-400">
                  Açıklama alanı kullanıcıya bırakılır. (Taksi/benzin fişlerinde otomatik açıklama eklenir.)
                </p>
              </div>

              <div className="grid gap-4">
                <label className="grid gap-2 text-xs text-slate-300">
                  Kategori
                  <select
                    value={receiptDraft.category}
                    onChange={(e) =>
                      setReceiptDraft((prev) => (prev ? { ...prev, category: e.target.value as Category } : prev))
                    }
                    className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none [color-scheme:dark]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c} className="bg-slate-950 text-slate-100">
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-xs text-slate-300">
                  Mağaza
                  <input
                    value={receiptDraft.merchant}
                    onChange={(e) =>
                      setReceiptDraft((prev) => (prev ? { ...prev, merchant: e.target.value } : prev))
                    }
                    className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none"
                    placeholder="Örn: Shell, Taksi..."
                  />
                </label>

                <label className="grid gap-2 text-xs text-slate-300">
                  Tutar (₺)
                  <input
                    value={receiptDraft.amount}
                    onChange={(e) =>
                      setReceiptDraft((prev) => (prev ? { ...prev, amount: e.target.value } : prev))
                    }
                    inputMode="decimal"
                    className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none"
                    placeholder="Örn: 1250"
                  />
                </label>

                <label className="grid gap-2 text-xs text-slate-300">
                  Fiş No
                  <input
                    value={receiptDraft.receiptNo}
                    onChange={(e) =>
                      setReceiptDraft((prev) => (prev ? { ...prev, receiptNo: e.target.value } : prev))
                    }
                    className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none"
                    placeholder="Örn: 001234 / ZR-1234"
                  />
                </label>

                {buildAutoDescription({
                  category: receiptDraft.category,
                  merchant: receiptDraft.merchant,
                  plate: receiptDraft.plate,
                }) && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                    Otomatik açıklama:{" "}
                    <span className="text-slate-100">
                      {buildAutoDescription({
                        category: receiptDraft.category,
                        merchant: receiptDraft.merchant,
                        plate: receiptDraft.plate,
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-4">
              <button
                type="button"
                onClick={onCancelReceipt}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={onConfirmReceipt}
                className="rounded-2xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Onayla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
