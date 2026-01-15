import Image from "next/image";
import clsx from "clsx";

export function Logo({ variant = "icon" }: { variant?: "icon" | "full" }) {
  return (
    <div className={clsx("inline-flex items-center gap-3", variant === "icon" && "gap-2")}>
      <div className="relative h-10 w-10 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <Image src="/brand/logo.png" alt="Logo" fill className="object-contain p-1.5" priority />
      </div>
      {variant === "full" && (
        <div className="leading-tight">
          <div className="text-sm font-semibold text-slate-100">HesapKapama</div>
          <div className="text-xs text-slate-400">hesapkapama.com</div>
        </div>
      )}
    </div>
  );
}
