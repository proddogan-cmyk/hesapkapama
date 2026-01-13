"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FolderKanban, Users, BarChart3, User, Settings } from "lucide-react";
import clsx from "clsx";

const items = [
  { href: "/app", label: "Ana Sayfa", Icon: Home },
  { href: "/app/projects", label: "Proje", Icon: FolderKanban },
  { href: "/app/team", label: "Ekip", Icon: Users },
  { href: "/app/summary", label: "Özet", Icon: BarChart3 },
  { href: "/app/account", label: "Hesabım", Icon: User },
  { href: "/app/settings", label: "Ayarlar", Icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[60] border-t border-white/10 bg-slate-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-1 px-3 py-2">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition",
                active ? "text-emerald-300" : "text-slate-400 hover:text-slate-200"
              )}
            >
              <Icon className={clsx("h-5 w-5", active && "drop-shadow")} />
              <span className="leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
