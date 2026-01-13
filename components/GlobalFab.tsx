"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Camera, Images, Plus, Minus, PlusSquare } from "lucide-react";
import TransactionModalImport from "@/components/TransactionModal";

const TransactionModal: any = TransactionModalImport as any;

type Pos = { right: number; bottom: number };

function clampPos(p: Pos): Pos {
  const min = 16;
  const maxRight = Math.max(min, window.innerWidth - 72);
  const maxBottom = Math.max(min, window.innerHeight - 120);
  return {
    right: Math.min(Math.max(p.right, min), maxRight),
    bottom: Math.min(Math.max(p.bottom, min), maxBottom),
  };
}

export function GlobalFab() {
  const [mounted, setMounted] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  const [pos, setPos] = React.useState<Pos | null>(null);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalKind, setModalKind] = React.useState<"income" | "expense">("expense");
  const [prefillFiles, setPrefillFiles] = React.useState<File[] | null>(null);

  const dragging = React.useRef(false);
  const moved = React.useRef(false);
  const dragStart = React.useRef<{ x: number; y: number; right: number; bottom: number } | null>(null);

  const fileCamRef = React.useRef<HTMLInputElement | null>(null);
  const filePickRef = React.useRef<HTMLInputElement | null>(null);
  const fileMultiRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const persist = React.useCallback((p: Pos) => {
    try {
      window.localStorage.setItem("hk_fab_pos_v4", JSON.stringify(p));
    } catch {}
  }, []);

  React.useEffect(() => {
    if (!mounted) return;

    let initial: Pos = { right: 18, bottom: 88 };
    try {
      const raw = window.localStorage.getItem("hk_fab_pos_v4");
      if (raw) {
        const v = JSON.parse(raw);
        if (v && typeof v.right === "number" && typeof v.bottom === "number") {
          initial = { right: v.right, bottom: v.bottom };
        }
      }
    } catch {}

    const safe = clampPos(initial);
    setPos(safe);
    persist(safe);

    const onResize = () => {
      setPos((prev) => {
        if (!prev) return prev;
        const clamped = clampPos(prev);
        persist(clamped);
        return clamped;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mounted, persist]);

  const openTx = (kind: "income" | "expense") => {
    setModalKind(kind);
    setPrefillFiles(null);
    setModalOpen(true);
    setExpanded(false);
  };

  const openTxWithFiles = (files: File[], kind: "income" | "expense" = "expense") => {
    setModalKind(kind);
    setPrefillFiles(files);
    setModalOpen(true);
    setExpanded(false);
  };

  const onMainClick = () => {
    if (moved.current) {
      moved.current = false;
      return;
    }
    setExpanded((v) => !v);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = true;
    moved.current = false;

    const current = pos ?? { right: 18, bottom: 88 };
    dragStart.current = { x: e.clientX, y: e.clientY, right: current.right, bottom: current.bottom };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) moved.current = true;

    const next = clampPos({
      right: dragStart.current.right - dx,
      bottom: dragStart.current.bottom - dy,
    });
    setPos(next);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    dragStart.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    setPos((p) => {
      if (!p) return p;
      persist(p);
      return p;
    });
  };

  const pickCameraOrGallery = () => {
    // Prompt as requested: OK = camera, Cancel = gallery
    const ok = window.confirm("Kamerayı açmak için Tamam, galeriden seçmek için İptal.");
    if (ok) fileCamRef.current?.click();
    else filePickRef.current?.click();
  };

  const onPickedSingle = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    openTxWithFiles([f], "expense");
  };

  const onPickedMulti = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    openTxWithFiles(Array.from(files).slice(0, 50), "expense");
  };

  if (!mounted) return null;

  const style = {
    right: `${(pos?.right ?? 18)}px`,
    bottom: `${(pos?.bottom ?? 88)}px`,
  } as React.CSSProperties;

  const baseBtn =
    "pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-emerald-500 text-slate-950 shadow-2xl transition";
  const subBtn =
    "pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-slate-100 backdrop-blur-xl shadow-xl transition";

  const subCommon = "absolute right-1 top-1 opacity-0 scale-90 translate-x-0 translate-y-0";
  const subOn = "opacity-100 scale-100";

  // Up icons (photo tools)
  const cameraCls = expanded
    ? `${subBtn} ${subOn} -translate-y-[70px]`
    : `${subBtn} ${subCommon} pointer-events-none`;
  const photosCls = expanded
    ? `${subBtn} ${subOn} -translate-y-[135px]`
    : `${subBtn} ${subCommon} pointer-events-none`;

  // Left icons (transaction tools)
  const incomeCls = expanded
    ? `${subBtn} ${subOn} -translate-x-[70px]`
    : `${subBtn} ${subCommon} pointer-events-none`;
  const expenseCls = expanded
    ? `${subBtn} ${subOn} -translate-x-[135px]`
    : `${subBtn} ${subCommon} pointer-events-none`;

  const mainCls = expanded ? `${baseBtn} scale-110` : baseBtn;

  return createPortal(
    <>
      {/* hidden inputs */}
      <input
        ref={fileCamRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onPickedSingle(e.target.files)}
      />
      <input
        ref={filePickRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onPickedSingle(e.target.files)}
      />
      <input
        ref={fileMultiRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onPickedMulti(e.target.files)}
      />

      {/* backdrop to close when expanded */}
      {expanded ? (
        <div
          className="fixed inset-0 z-[9998] bg-black/0"
          onClick={() => setExpanded(false)}
        />
      ) : null}

      <div className="fixed z-[9999]" style={style}>
        <div className="relative">
          {/* sub actions */}
          <button type="button" className={photosCls} onClick={() => fileMultiRef.current?.click()} aria-label="Fotoğraflar">
            <Images className="h-5 w-5" />
          </button>
          <button type="button" className={cameraCls} onClick={pickCameraOrGallery} aria-label="Kamera">
            <Camera className="h-5 w-5" />
          </button>

          <button type="button" className={incomeCls} onClick={() => openTx("income")} aria-label="Gelir Ekle">
            <PlusSquare className="h-5 w-5" />
          </button>
          <button type="button" className={expenseCls} onClick={() => openTx("expense")} aria-label="Gider Ekle">
            <Minus className="h-5 w-5" />
          </button>

          {/* main FAB */}
          <button
            type="button"
            className={mainCls}
            onClick={onMainClick}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            aria-label="Menü"
            title="Menü"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
      </div>

      <TransactionModal
        open={modalOpen}
        kind={modalKind}
        prefillFiles={prefillFiles}
        onClose={() => {
          setModalOpen(false);
          setPrefillFiles(null);
        }}
      />
    </>,
    document.body
  );
}
