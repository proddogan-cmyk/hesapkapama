"use client";

import * as React from "react";
import clsx from "clsx";
import { X } from "lucide-react";
import type { Category, Transaction, TxKind, TxSubtype } from "@/lib/types";
import { CATEGORIES, defaultCategoryForKind, subtypeLabels, useAppStore, useStoreActions } from "@/lib/store";

type Props = {
  open: boolean;
  kind: TxKind;
  editTx?: Transaction | null;
  prefillFiles?: File[] | null; // kept for compatibility, not used (fiş ekleme ana sayfadaki ikonla yapılır)
  onClose: () => void;
};

function fmtNowTs() {
  return Date.now();
}

function toTryNumber(s: string): number | null {
  const cleaned = String(s || "").replace(/[^0-9.,]/g, "").trim();
  if (!cleaned) return null;
  const normalized = cleaned.replace(/\./g, "").replace(/,/g, ".");
  const v = Number(normalized);
  if (!Number.isFinite(v)) return null;
  return v;
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function TransactionModal({ open, kind, editTx = null, onClose }: Props) {
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const projects = useAppStore((s) => s.projects);
  const profile = useAppStore((s) => s.profile);
  const nameTags = useAppStore((s) => s.nameTags);

  const { addTransaction, updateTransaction } = useStoreActions();

  const [subtype, setSubtype] = React.useState<TxSubtype>(kind === "income" ? "advance_in" : "generic");
  const [category, setCategory] = React.useState<Category>(defaultCategoryForKind(kind));

  const [projectId, setProjectId] = React.useState<string>("");
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

  const [who, setWho] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [amount, setAmount] = React.useState<string>("");
  const [ts, setTs] = React.useState<number>(fmtNowTs());

  // advance_in: "Kimden aldın" ekipten seçilebilir + Diğer
  const [memberOptions, setMemberOptions] = React.useState<string[]>([]);
  const [membersLoading, setMembersLoading] = React.useState(false);
  const [whoMode, setWhoMode] = React.useState<"select" | "custom">("select");
  const [selectedWho, setSelectedWho] = React.useState<string>("");

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) return;
    // default state
    setSubtype(kind === "income" ? "advance_in" : "generic");
    setCategory(defaultCategoryForKind(kind));
    setProjectId("");
    setWho("");
    setDesc("");
    setAmount("");
    setTs(fmtNowTs());
    setMemberOptions([]);
    setMembersLoading(false);
    setWhoMode("select");
    setSelectedWho("");
  }, [open, kind]);

  // Prefill when editing
  React.useEffect(() => {
    if (!open) return;
    if (!editTx) return;

    setSubtype(editTx.subtype);
    setCategory(editTx.category);
    setProjectId(editTx.projectId);
    setWho(editTx.who ?? "");
    setDesc(editTx.description ?? "");
    setAmount(String(editTx.amount ?? ""));
    setTs(editTx.ts);

    setWhoMode("custom");
    setSelectedWho("");
  }, [open, editTx]);

  // subtype changes adjust category defaults
  React.useEffect(() => {
    if (!open) return;

    const isAdvance = subtype === "advance_in" || subtype === "advance_out";

    if (isAdvance) {
      setCategory("AVANS");
    } else {
      if (kind === "expense" && category === "AVANS") setCategory("DİĞER");
      if (kind === "income" && category === "AVANS") {
        // income generic can still be AVANS if user wants; leave
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtype, kind]);

  // Load member list for the selected project (advance_in / advance_out)
  React.useEffect(() => {
    if (!open) return;
    if (subtype !== "advance_in" && subtype !== "advance_out") return;
    if (!resolvedProjectName) {
      setMemberOptions([]);
      return;
    }

    let cancelled = false;

    (async () => {
      setMembersLoading(true);
      try {
        const res = await fetch("/api/team", { method: "GET", cache: "no-store" });
        const data = (await safeJson(res)) as any;

        if (!res.ok || !data || !Array.isArray(data.teams)) {
          if (!cancelled) setMemberOptions([]);
          return;
        }

        const teams = data.teams as any[];
        const related = teams.filter((t) => String(t.projectName || "").trim() === resolvedProjectName);
        const names: string[] = [];
        for (const t of related) {
          for (const m of (t.members || [])) {
            const nm = String(m?.name || "").trim();
            if (nm) names.push(nm);
          }
        }

        const uniq = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "tr"));
        if (!cancelled) setMemberOptions(uniq);
      } catch {
        if (!cancelled) setMemberOptions([]);
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, subtype, resolvedProjectName]);

  // When user chooses from select, sync into who
  React.useEffect(() => {
    if (!open) return;
    if (subtype !== "advance_in" && subtype !== "advance_out") return;

    if (whoMode === "select") {
      setWho(selectedWho);
    }
  }, [open, subtype, whoMode, selectedWho]);

  if (!open) return null;

  const isAdvance = subtype === "advance_in" || subtype === "advance_out";
  const canSubmit = Boolean(resolvedProjectId) && Boolean(String(who || "").trim()) && Boolean(toTryNumber(amount) != null);

  const submit = async () => {
    if (!resolvedProjectId) return;

    const v = toTryNumber(amount);
    if (v == null || v <= 0) return;

    const tx: Omit<Transaction, "id"> = {
      projectId: resolvedProjectId,
      ts,
      kind,
      subtype,
      category: isAdvance ? "AVANS" : category,
      who: String(who || "").trim(),
      description: String(desc || "").trim(),
      amount: v,
      receipt: editTx?.receipt, // preserve receipt when editing
    };

    if (editTx) {
      updateTransaction(editTx.id, tx);
    } else {
      addTransaction(tx);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3">
      <div className="w-[92vw] max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 shadow-2xl backdrop-blur">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-slate-950/40 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-slate-100">
              {editTx ? "İşlem Düzenle" : kind === "income" ? "Gelir / Avans" : "Harcama Ekle"}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {subtype === "advance_in"
                ? "Avans aldığında projeyi seç, kimden aldığını ekipten seç ve kaydet."
                : "Manuel işlem ekleyebilirsin. Fiş ekleme ana sayfadaki fiş ikonundan yapılır."}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
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

            {subtype === "advance_in" || subtype === "advance_out" ? (
              <label className="grid gap-2 text-xs text-slate-300">
                Proje
                <select
                  value={resolvedProjectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none [color-scheme:dark]"
                >
                  {projects.length === 0 ? (
                    <option value="" className="bg-slate-950 text-slate-100">Önce proje ekle</option>
                  ) : null}
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-slate-950 text-slate-100">
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="grid gap-2 text-xs text-slate-300">
                Kategori
                <select
                  value={isAdvance ? "AVANS" : category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  disabled={isAdvance}
                  className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none disabled:opacity-60 [color-scheme:dark]"
                >
                  {isAdvance ? (
                    <option value="AVANS" className="bg-slate-950 text-slate-100">AVANS</option>
                  ) : (
                    CATEGORIES.map((c) => (
                      <option key={c} value={c} className="bg-slate-950 text-slate-100">
                        {c}
                      </option>
                    ))
                  )}
                </select>
              </label>
            )}

            <div className="md:col-span-2">
              {subtype === "advance_in" || subtype === "advance_out" ? (
                <div className="grid gap-2 text-xs text-slate-300">
                  <div className="flex items-center justify-between">
                    <div>{subtype === "advance_out" ? "Kime verdin?" : "Kimden aldın?"}</div>
                    <div className="text-[11px] text-slate-500">
                      {membersLoading ? "Ekip yükleniyor…" : memberOptions.length > 0 ? "Ekipten seçebilirsin." : "Ekip bulunamadı (istersen Diğer seç)."}
                    </div>
                  </div>

                  <div className="grid gap-2 md:grid-cols-[1fr_200px]">
                    <select
                      value={whoMode === "custom" ? "__custom__" : (selectedWho || "")}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "__custom__") {
                          setWhoMode("custom");
                          setSelectedWho("");
                          setWho("");
                        } else {
                          setWhoMode("select");
                          setSelectedWho(v);
                        }
                      }}
                      className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none [color-scheme:dark]"
                    >
                      <option value="" className="bg-slate-950 text-slate-100">Seç…</option>
                      {memberOptions.map((n) => (
                        <option key={n} value={n} className="bg-slate-950 text-slate-100">
                          {n}
                        </option>
                      ))}
                      <option value="__custom__" className="bg-slate-950 text-slate-100">Diğer…</option>
                    </select>

                    {whoMode === "custom" ? (
                      <input
                        value={who}
                        onChange={(e) => setWho(e.target.value)}
                        placeholder={subtype === "advance_out" ? "İsim gir (örn: Tolga Erener)" : "İsim gir (örn: Tolga Erener)"}
                        className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 [color-scheme:dark]"
                      />
                    ) : (
                      <div className="flex items-center rounded-2xl border border-white/10 bg-slate-950/30 px-3 text-xs text-slate-400">
                        {selectedWho ? "Seçildi" : "—"}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <label className="grid gap-2 text-xs text-slate-300">
                  Kim (Firma)?
                  <input
                    value={who}
                    onChange={(e) => setWho(e.target.value)}
                    list={isAdvance ? "nameTags" : undefined}
                    className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 [color-scheme:dark]"
                    placeholder={isAdvance ? "Örn: Tolga Erener" : "Örn: Faruk Eczanesi"}
                  />
                  <datalist id="nameTags">
                    {nameTags.map((n) => <option key={n} value={n} />)}
                  </datalist>
                </label>
              )}
            </div>

            <label className="grid gap-2 text-xs text-slate-300 md:col-span-2">
              Açıklama
              <input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 [color-scheme:dark]"
                placeholder="Not (opsiyonel)"
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
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-slate-950/60 px-5 py-4">
          <div className="text-xs text-slate-400">
            {resolvedProjectId ? `Proje: ${resolvedProjectName || "—"}` : "Proje seçmeden kayıt edemezsin."}
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
