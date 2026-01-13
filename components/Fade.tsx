"use client";

import * as React from "react";
import clsx from "clsx";

export function Fade({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("animate-[fadeIn_220ms_ease-out]", className)}>
      {children}
      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
