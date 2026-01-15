"use client";

import * as React from "react";
import Link from "next/link";
import clsx from "clsx";
import { CalendarDays, FileText, UploadCloud, RefreshCw, Download, Trash2 } from "lucide-react";
import { useAppStore, useStoreActions } from "@/lib/store";

type DocFile = {
  id: string;
  originalName: string;
  docType: "calendar" | "scenario";
  mime: string;
  size: number;
  uploadedByName: string;
  uploadedByRole: string;
  createdAt: string;
};

type ListPayload =
  | { ok: true; files: { calendar: DocFile[]; scenario: DocFile[] }; projectName: string }
  | { ok: false; error: string };

function uniq(arr: string[]) {
  const s = new Set<string>();
  for (const x of arr) {
    const v = String(x ?? "").trim();
    if (v) s.add(v);
  }
  return Array.from(s);
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function userDisplayName(profile: any) {
  const fn = String(profile?.firstName ?? "").trim();
  const ln = String(profile?.lastName ?? "").trim();
  const n = `${fn} ${ln}`.trim();
  return n || "İsimsiz";
}

function userRole(profile: any) {
  return String(profile?.title ?? "").trim();
}

function canUpload(role: string) {
  if (!role) return false;
  const r = role.toLowerCase();
  if (r === "yapımcı".toLowerCase()) return true;
  if (r === "yapım amiri".toLowerCase()) return true;
  if (r.startsWith("reji")) return true; // Reji 1/2/3
  if (r.includes("devamlılık")) return true; // reji grubuna dahil
  return false;
}

export default function ProjectsPage() {
  const localProjects = useAppStore((s) => s.projects);
  const profile = useAppStore((s) => s.profile);

  const { deleteProject, addProject } = useStoreActions();
const allTx = useAppStore((s) => s.transactions);


  const [projects, setProjects] = React.useState<string[]>([]);
  const [selected, setSelected] = React.useState<string>("");
  const [listLoading, setListLoading] = React.useState(false);
  const [files, setFiles] = React.useState<{ calendar: DocFile[]; scenario: DocFile[] }>({ calendar: [], scenario: [] });
  const [msg, setMsg] = React.useState<string | null>(null);

  const [newProjectName, setNewProjectName] = React.useState<string>("");
  const [addBusy, setAddBusy] = React.useState(false);

  const name = React.useMemo(() => userDisplayName(profile), [profile]);
  const role = React.useMemo(() => userRole(profile), [profile]);

  const refreshProjects = React.useCallback(async () => {
    setMsg(null);
    try {
      const res = await fetch("/api/team", { method: "GET", cache: "no-store" });
      const data = await safeJson(res);
      const fromTeams = Array.isArray(data?.teams) ? data.teams.map((t: any) => String(t?.projectName ?? "").trim()) : [];
      const fromLocal = localProjects.map((p: any) => String(p?.name ?? "").trim());
      const merged = uniq([...fromLocal, ...fromTeams]);
      setProjects(merged);
      if (!selected && merged.length > 0) setSelected(merged[0]);
    } catch {
      const fromLocal = localProjects.map((p: any) => String(p?.name ?? "").trim());
      setProjects(uniq(fromLocal));
      if (!selected && fromLocal.length > 0) setSelected(fromLocal[0]);
    }
  }, [localProjects, selected]);

  const refreshFiles = React.useCallback(async () => {
    if (!selected) return;
    setListLoading(true);
    setMsg(null);
    try {
      const qs = new URLSearchParams({
        projectName: selected,
        userName: name,
      });
      const res = await fetch(`/api/project-doc?${qs.toString()}`, { method: "GET", cache: "no-store" });
      const data = (await safeJson(res)) as ListPayload | null;
      if (!res.ok || !data || !data.ok) {
        const err = (data && "error" in data && data.error) ? data.error : `Dosyalar alınamadı (HTTP ${res.status}).`;
        setMsg(err);
        setFiles({ calendar: [], scenario: [] });
        return;
      }
      setFiles(data.files);
    } catch (e: any) {
      setMsg(e?.message || "Ağ hatası.");
      setFiles({ calendar: [], scenario: [] });
    } finally {
      setListLoading(false);
    }
  }, [selected, name]);

  React.useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  React.useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  const doUpload = async (docType: "calendar" | "scenario", file: File) => {
    if (!selected) return;
    if (!profile) {
      setMsg("Önce Hesabım sayfasından ad/soyad ve ünvan bilgini kaydetmelisin.");
      return;
    }
    if (!canUpload(role)) {
      setMsg("Bu dosyaları sadece Reji / Yapımcı / Yapım Amiri yükleyebilir.");
      return;
    }

    const fd = new FormData();
    fd.append("projectName", selected);
    fd.append("docType", docType);
    fd.append("userName", name);
    fd.append("userRole", role);
    fd.append("file", file);

    setMsg(null);
    try {
      const res = await fetch("/api/project-doc", { method: "POST", body: fd });
      const data = await safeJson(res);
      if (!res.ok) {
        setMsg((data && data.error) ? data.error : `Yükleme başarısız (HTTP ${res.status}).`);
        return;
      }
      setMsg("Yüklendi.");
      await refreshFiles();
    } catch (e: any) {
      setMsg(e?.message || "Ağ hatası.");
    }
  };

  const pickFile = (docType: "calendar" | "scenario") => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = false;

    if (docType === "calendar") {
      input.accept = ".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv";
    } else {
      input.accept = ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }

    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      doUpload(docType, f);
    };
    input.click();
  };

  const downloadHref = (id: string) => {
    const qs = new URLSearchParams({
      id,
      userName: name,
    });
    return `/api/project-doc/file?${qs.toString()}`;
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-100">Proje</div>
          <div className="mt-1 text-xs text-slate-400">
            Takvim & Senaryo dosyaları. Yükleme: sadece Reji / Yapımcı / Yapım Amiri. İndirme: projedeki herkes.
          </div>
        </div>

        <Link
          href="/app"
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
        >
          ← Geri
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_260px]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-semibold text-slate-200">Proje Seç</div>

          
          <div className="mt-3 rounded-3xl border border-white/10 bg-slate-950/40 p-3">
            <div className="text-xs font-semibold text-slate-200">Proje Ekle</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Örn: AJet Kids / Hadi Bi Market"
                className="h-11 flex-1 min-w-[220px] rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 [color-scheme:dark]"
              />
              <button
                type="button"
                disabled={!newProjectName.trim() || addBusy}
                onClick={() => {
                  const name = newProjectName.trim();
                  if (!name) return;
                  setAddBusy(true);
                  try {
                    const id = addProject(name);
                    // update local list
                    setNewProjectName("");
                    setSelected(name);
                    // refresh list to include
                    setProjects((prev) => uniq([name, ...prev]));
                  } finally {
                    setAddBusy(false);
                  }
                }}
                className="h-11 rounded-2xl bg-emerald-500 px-5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                Ekle
              </button>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">Bu proje cihazında kaydedilir. Ekip oluştururken de kullanılır.</div>
          </div>

{projects.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-3 text-sm text-slate-300">
              Henüz proje yok. Ana sayfadan proje ekle veya ekip oluştur.
            </div>
          ) : (
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="mt-3 h-11 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-white/10 [color-scheme:dark]"
            >
              {projects.map((p) => (
                <option key={p} value={p} className="bg-slate-950 text-slate-100">
                  {p}
                </option>
              ))}
            </select>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshProjects}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
            >
              <RefreshCw className="h-4 w-4" />
              Listeyi Yenile
            </button>

            <button
              type="button"
              onClick={refreshFiles}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
            >
              <RefreshCw className="h-4 w-4" />
              Dosyaları Yenile
            </button>

            <div className="ml-auto text-xs text-slate-400">
              {profile ? (
                <span className="text-slate-300">
                  {name} • <span className="text-slate-400">{role || "Ünvan yok"}</span>
                </span>
              ) : (
                <span className="text-rose-200">Profil eksik (Hesabım’dan kaydet)</span>
              )}
            </div>
          </div>

          {msg ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-3 text-sm text-slate-200">
              {msg}
            </div>
          ) : null}

          {listLoading ? <div className="mt-3 text-xs text-slate-400">Yükleniyor…</div> : null}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-semibold text-slate-200">Yükleme Yetkisi</div>
          <div className="mt-2 text-sm text-slate-300">
            {canUpload(role) ? "Bu kullanıcı yükleyebilir." : "Bu kullanıcı sadece indirebilir."}
          </div>
          <div className="mt-3 text-xs text-slate-400">
            Not: Yetki server tarafında da kontrol edilir.
          </div>
        </div>
      </div>
<div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
  <div className="flex items-center justify-between">
    <div>
      <div className="text-sm font-semibold text-slate-100">Projeleri Yönet</div>
      <div className="mt-1 text-xs text-slate-400">
        İşi biten projeyi buradan silebilirsin. Bu işlem: proje, ekipler ve proje dosyalarını kaldırır.
      </div>
    </div>
  </div>

  {localProjects.length === 0 ? (
    <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-3 text-sm text-slate-300">
      Silinecek proje yok.
    </div>
  ) : (
    <div className="mt-3 space-y-2">
      {localProjects
        .slice()
        .sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        .map((p: any) => {
          const txCount = allTx.filter((t) => t.projectId === p.id).length;
          return (
            <div key={p.id} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-100">{p.name}</div>
                <div className="mt-1 text-xs text-slate-400">{txCount} işlem</div>
              </div>

              <button
                type="button"
                className={clsx(
                  "inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold",
                  canUpload(role)
                    ? "border border-rose-400/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15"
                    : "border border-white/10 bg-white/5 text-slate-400 cursor-not-allowed"
                )}
                disabled={!canUpload(role)}
                onClick={async () => {
                  if (!profile) {
                    setMsg("Önce Hesabım sayfasından ad/soyad ve ünvan bilgini kaydetmelisin.");
                    return;
                  }
                  if (!canUpload(role)) {
                    setMsg("Projeyi silme yetkisi sadece Reji / Yapımcı / Yapım Amiri.");
                    return;
                  }

                  const ok = window.confirm(
                    `“${p.name}” projesi silinecek. Ekipler ve takvim/senaryo dosyaları da kaldırılacak. Devam?`
                  );
                  if (!ok) return;

                  setMsg(null);

                  try {
                    const res = await fetch("/api/project-delete", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        projectName: String(p.name || "").trim(),
                        userName: name,
                        userRole: role,
                      }),
                    });
                    const data = await safeJson(res);

                    if (!res.ok) {
                      setMsg((data && data.error) ? data.error : `Silme başarısız (HTTP ${res.status}).`);
                      return;
                    }

                    deleteProject(p.id);
                    setMsg("Proje silindi.");
                    await refreshProjects();
                  } catch (e: any) {
                    setMsg(e?.message || "Ağ hatası.");
                  }
                }}
                title={!canUpload(role) ? "Silme yetkin yok" : "Projeyi sil"}
              >
                <Trash2 className="h-4 w-4" />
                Projeyi Sil
              </button>
            </div>
          );
        })}
    </div>
  )}
</div>


      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Calendar */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-slate-200" />
              <div className="text-sm font-semibold text-slate-100">Takvim</div>
            </div>

            <button
              type="button"
              onClick={() => pickFile("calendar")}
              className={clsx(
                "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold",
                canUpload(role)
                  ? "border border-white/10 bg-white/10 text-slate-100 hover:bg-white/15"
                  : "border border-white/10 bg-white/5 text-slate-400 cursor-not-allowed"
              )}
              disabled={!canUpload(role)}
              title={!canUpload(role) ? "Yükleme yetkin yok" : "Takvim dosyası yükle"}
            >
              <UploadCloud className="h-4 w-4" />
              Yükle (Excel)
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {files.calendar.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-3 text-sm text-slate-300">
                Takvim dosyası yok.
              </div>
            ) : (
              files.calendar
                .slice()
                .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                .map((f) => (
                  <div key={f.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-slate-100">{f.originalName}</div>
                      <div className="text-xs text-slate-400">
                        {f.uploadedByName} • {f.uploadedByRole} • {new Date(f.createdAt).toLocaleString("tr-TR")}
                      </div>
                    </div>
                    <a
                      href={downloadHref(f.id)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
                    >
                      <Download className="h-4 w-4" />
                      İndir
                    </a>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Scenario */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-200" />
              <div className="text-sm font-semibold text-slate-100">Senaryo</div>
            </div>

            <button
              type="button"
              onClick={() => pickFile("scenario")}
              className={clsx(
                "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold",
                canUpload(role)
                  ? "border border-white/10 bg-white/10 text-slate-100 hover:bg-white/15"
                  : "border border-white/10 bg-white/5 text-slate-400 cursor-not-allowed"
              )}
              disabled={!canUpload(role)}
              title={!canUpload(role) ? "Yükleme yetkin yok" : "Senaryo dosyası yükle"}
            >
              <UploadCloud className="h-4 w-4" />
              Yükle (Word)
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {files.scenario.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-3 text-sm text-slate-300">
                Senaryo dosyası yok.
              </div>
            ) : (
              files.scenario
                .slice()
                .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                .map((f) => (
                  <div key={f.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-slate-100">{f.originalName}</div>
                      <div className="text-xs text-slate-400">
                        {f.uploadedByName} • {f.uploadedByRole} • {new Date(f.createdAt).toLocaleString("tr-TR")}
                      </div>
                    </div>
                    <a
                      href={downloadHref(f.id)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
                    >
                      <Download className="h-4 w-4" />
                      İndir
                    </a>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
