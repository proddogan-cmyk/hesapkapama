"use client";

import * as React from "react";
import { Plus, Minus, Camera, Images } from "lucide-react";
import TransactionModal from "@/components/TransactionModal";
import { useAppStore, useStoreActions } from "@/lib/store";

type Kind = "income" | "expense";

export function BottomActionBar() {
  const projects = useAppStore((s) => s.projects);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const { selectProject } = useStoreActions();

  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<Kind>("expense");
  const [prefillFiles, setPrefillFiles] = React.useState<File[] | null>(null);

  const camRef = React.useRef<HTMLInputElement | null>(null);
  const galleryRef = React.useRef<HTMLInputElement | null>(null);
  const multiRef = React.useRef<HTMLInputElement | null>(null);

  // remember last real project selection
  React.useEffect(() => {
    if (!selectedProjectId) return;
    if (selectedProjectId === "__all__") return;
    try {
      window.localStorage.setItem("hk_last_project_v1", selectedProjectId);
    } catch {}
  }, [selectedProjectId]);

  const ensureWritableProject = React.useCallback((): string | null => {
    const current = selectedProjectId;
    if (current && current !== "__all__") return current;

    if (projects.length === 0) {
      alert("Önce bir proje eklemen gerekiyor.");
      return null;
    }

    let next = projects[0].id;
    try {
      const last = window.localStorage.getItem("hk_last_project_v1");
      if (last && projects.some((p) => p.id === last)) next = last;
    } catch {}

    selectProject(next);
    return next;
  }, [selectedProjectId, projects, selectProject]);

  const openTx = (k: Kind) => {
    const pid = ensureWritableProject();
    if (!pid) return;
    setKind(k);
    setPrefillFiles(null);
    setOpen(true);
  };
  const onCameraClick = () => {
    const pid = ensureWritableProject();
    if (!pid) return;
    const ok = confirm('Kamerayı açmak için "Tamam", galeriden seçmek için "İptal" butonuna bas.');
    if (ok) camRef.current?.click();
    else galleryRef.current?.click();
  };


  const openTxWithFiles = (files: File[]) => {
    const pid = ensureWritableProject();
    if (!pid) return;
    setKind("expense");
    setPrefillFiles(files);
    setOpen(true);
  };

  const onCameraPick = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    openTxWithFiles([f]);
  };

  const onMultiPick = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    openTxWithFiles(Array.from(files).slice(0, 50));
  };

  return (
    <>
      {/* hidden inputs */}
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onCameraPick(e.target.files)}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onCameraPick(e.target.files)}
      />
      <input
        ref={multiRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onMultiPick(e.target.files)}
      />

      <div className="fixed bottom-[72px] left-1/2 z-[65] -translate-x-1/2">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/75 p-2 shadow-2xl backdrop-blur">
          <button
            type="button"
            onClick={() => openTx("income")}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950 shadow-sm hover:bg-emerald-400"
            aria-label="Gelir ekle"
            title="Gelir ekle"
          >
            <Plus className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => openTx("expense")}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500 text-slate-950 shadow-sm hover:bg-rose-400"
            aria-label="Gider ekle"
            title="Gider ekle"
          >
            <Minus className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => camRef.current?.click()}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
            aria-label="Kamera veya Galeri (Tek fiş)"
            title="Kamera veya Galeri (Tek fiş)"
          >
            <Camera className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => multiRef.current?.click()}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
            aria-label="Çoklu foto"
            title="Çoklu foto"
          >
            <Images className="h-5 w-5" />
          </button>
        </div>
      </div>

      <TransactionModal
        open={open}
        kind={kind}
        prefillFiles={prefillFiles}
        onClose={() => {
          setOpen(false);
          setPrefillFiles(null);
        }}
      />
    </>
  );
}