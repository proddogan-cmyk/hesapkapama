"use client";

import * as React from "react";
import { Fade } from "@/components/Fade";
import { useAppStore, useStoreActions } from "@/lib/store";
import type { BizType } from "@/lib/types";
import { Pencil } from "lucide-react";

export default function AccountPage() {
  const profile = useAppStore((s) => s.profile);
  const { setProfile } = useStoreActions();

  const [editMode, setEditMode] = React.useState(false);

  const [firstName, setFirstName] = React.useState(profile?.firstName ?? "");
  const [lastName, setLastName] = React.useState(profile?.lastName ?? "");
  const [title, setTitle] = React.useState(profile?.title ?? "");
  const [bizType, setBizType] = React.useState<BizType>(profile?.bizType ?? "freelance");
  const [companyName, setCompanyName] = React.useState(profile?.companyName ?? "");

  React.useEffect(() => {
    if (!profile) return;
    setFirstName(profile.firstName ?? "");
    setLastName(profile.lastName ?? "");
    setTitle(profile.title ?? "");
    setBizType(profile.bizType ?? "freelance");
    setCompanyName(profile.companyName ?? "");
  }, [profile]);

  const canSave = !!firstName.trim() && !!lastName.trim() && !!title.trim();

  const save = async () => {
    if (!canSave) return;

    const nextProfile = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      title: title.trim(),
      bizType,
      companyName: bizType === "company" ? companyName.trim() : undefined,
    };

    setProfile(nextProfile);

    try {
      await fetch("/api/user/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(nextProfile),
      });
    } catch {
      // ignore
    }

    setEditMode(false);
  };

  const displayName = `${String(profile?.firstName || "").trim()} ${String(profile?.lastName || "").trim()}`.trim() || "—";
  const displayTitle = String(profile?.title || "").trim() || "—";
  const displayBiz =
    (profile?.bizType || "freelance") === "company" ? "Şirket" : "Freelance";
  const displayCompany =
    (profile?.bizType || "freelance") === "company" ? (String(profile?.companyName || "").trim() || "—") : "—";

  return (
    <Fade>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-slate-100">Hesabım</div>
            <div className="mt-1 text-sm text-slate-400">
              Bilgilerini kaydedebilirsin. Düzenlemek için sağ üstten “Düzenle”ye bas.
            </div>
          </div>

          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-semibold text-slate-200 hover:bg-white/10"
          >
            <Pencil className="mr-2 h-4 w-4" />
            {editMode ? "Vazgeç" : "Düzenle"}
          </button>
        </div>

        {!editMode ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="text-xs font-semibold text-slate-300">Ad Soyad</div>
              <div className="mt-2 text-sm font-semibold text-slate-100">{displayName}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="text-xs font-semibold text-slate-300">Ünvan</div>
              <div className="mt-2 text-sm font-semibold text-slate-100">{displayTitle}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="text-xs font-semibold text-slate-300">Çalışma tipi</div>
              <div className="mt-2 text-sm font-semibold text-slate-100">{displayBiz}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="text-xs font-semibold text-slate-300">Şirket adı</div>
              <div className="mt-2 text-sm font-semibold text-slate-100">{displayCompany}</div>
            </div>

            {!profile ? (
              <div className="md:col-span-2 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                Profilin kaydedilmemiş görünüyor. “Düzenle” → bilgileri gir → Kaydet.
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-xs text-slate-300">
                Ad
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="h-11 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-slate-100 outline-none"
                />
              </label>
              <label className="grid gap-2 text-xs text-slate-300">
                Soyad
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="h-11 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-slate-100 outline-none"
                />
              </label>

              <label className="grid gap-2 text-xs text-slate-300 md:col-span-2">
                Ünvan
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Örn: Yapımcı / Prodüksiyon / Art Director"
                  className="h-11 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                />
              </label>

              <label className="grid gap-2 text-xs text-slate-300">
                Çalışma tipi
                <select
                  value={bizType}
                  onChange={(e) => setBizType(e.target.value as BizType)}
                  className="h-11 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-slate-100 outline-none"
                >
                  <option value="freelance" className="bg-slate-950">Freelance</option>
                  <option value="company" className="bg-slate-950">Şirket</option>
                </select>
              </label>

              <label className="grid gap-2 text-xs text-slate-300">
                Şirket adı
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={bizType !== "company"}
                  placeholder="Örn: Kraft Film"
                  className="h-11 rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 disabled:opacity-60"
                />
              </label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={save}
                disabled={!canSave}
                className="h-11 rounded-2xl bg-emerald-500 px-5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                Kaydet
              </button>
            </div>
          </>
        )}
      </div>
    </Fade>
  );
}
