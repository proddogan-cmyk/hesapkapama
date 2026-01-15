"use client";

import * as React from "react";
import clsx from "clsx";
import { Plus, Check, X } from "lucide-react";
import { useAppStore, useStoreActions } from "@/lib/store";

type ProjectTabsProps = {
  allowAdd?: boolean;
};

export function ProjectTabs({ allowAdd = true }: ProjectTabsProps) {
  const projects = useAppStore((s) => s.projects);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const { addProject, selectProject } = useStoreActions();

  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");

  const onCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    addProject(trimmed);
    try { (document.activeElement as any)?.blur?.(); } catch {}
    setName("");
    setOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {projects.length === 0 ? (
          <div className="text-xs text-slate-400">HenÇ¬z proje yok.</div>
        ) : (
          projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectProject(p.id)}
              className={clsx(
                "rounded-full border px-4 py-2 text-xs font-semibold transition",
                selectedProjectId === p.id
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              )}
            >
              {p.name}
            </button>
          ))
        )}
      </div>

      {allowAdd && (
        <div className="ml-auto flex items-center gap-2">
          <div
            className={clsx(
              "flex items-center gap-2 overflow-hidden rounded-full border border-white/10 bg-white/5 transition-all duration-300",
              open ? "w-[340px] pr-2" : "w-[150px] pr-0"
            )}
          >
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className={clsx(
                "inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-100 transition",
                open ? "text-slate-300" : "hover:text-slate-50"
              )}
            >
              <Plus className="h-4 w-4" />
              Proje Ekle
            </button>

            {open && (
              <>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Proje adŽñ"
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none"
                  inputMode="text"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onCreate();
                    if (e.key === "Escape") { setOpen(false); setName(""); }
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={onCreate}
                  disabled={!name.trim()}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                  aria-label="Kaydet"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => { try { (document.activeElement as any)?.blur?.(); } catch {} setOpen(false); setName(""); }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  aria-label="Žøptal"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
