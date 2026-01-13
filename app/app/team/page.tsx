"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, UserPlus, RefreshCw, Trash2, Check, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useUser } from "@clerk/nextjs";

type MemberRole =
  | "Yapımcı"
  | "Yapım Amiri"
  | "Şef Asistan"
  | "Mekan Sorumlusu"
  | "Mekan Asistanı"
  | "Yapım Asistanı"
  | "Runner"
  | "Sanat Yönetmeni"
  | "Sanat Asistanı"
  | "Kostüm Şefi"
  | "Kostüm Asistanı"
  | "Reji 1"
  | "Reji 2"
  | "Reji 3"
  | "Devamlılık Asistanı";

const ROLE_OPTIONS: MemberRole[] = [
  "Yapımcı",
  "Yapım Amiri",
  "Şef Asistan",
  "Mekan Sorumlusu",
  "Mekan Asistanı",
  "Yapım Asistanı",
  "Runner",
  "Sanat Yönetmeni",
  "Sanat Asistanı",
  "Kostüm Şefi",
  "Kostüm Asistanı",
  "Reji 1",
  "Reji 2",
  "Reji 3",
  "Devamlılık Asistanı",
];

type TeamMember = {
  id: string;
  name: string;
  role: MemberRole;
  status?: "active" | "pending";
};

type Team = {
  id: string;
  name: string;
  projectName: string;
  ownerId?: string;
  joinCode?: string;
  members?: TeamMember[];
  pendingMembers?: TeamMember[];
};

type TeamsPayload = {
  ok?: boolean;
  error?: string;
  teams?: Team[];
};

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function TeamPage() {
  const { user } = useUser();
  const userId = user?.id || "";

  const projects = useAppStore((s) => s.projects);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const profile = useAppStore((s) => s.profile);



const myName = React.useMemo(() => {
  const fn = String((profile as any)?.firstName ?? (user as any)?.firstName ?? "").trim();
  const ln = String((profile as any)?.lastName ?? (user as any)?.lastName ?? "").trim();
  const full = `${fn} ${ln}`.trim();
  return full || String((user as any)?.fullName ?? "").trim();
}, [profile, user]);

const myRole = React.useMemo(() => {
  return String((profile as any)?.title ?? "").trim();
}, [profile]);

  const [payload, setPayload] = React.useState<TeamsPayload | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [advanceApprovals, setAdvanceApprovals] = React.useState<any[]>([]);
  const [advanceLoading, setAdvanceLoading] = React.useState(false);

  const [teamName, setTeamName] = React.useState("");
  const [projectId, setProjectId] = React.useState<string>("");
  const [createBusy, setCreateBusy] = React.useState(false);

  const [joinCode, setJoinCode] = React.useState("");
  const [joinBusy, setJoinBusy] = React.useState(false);

  // manual member add
  const [manualTeamId, setManualTeamId] = React.useState<string | null>(null);
  const [manualName, setManualName] = React.useState("");
  const [manualRole, setManualRole] = React.useState<MemberRole>("Yapım Asistanı");
  const [manualBusy, setManualBusy] = React.useState(false);

  const [deleteBusyId, setDeleteBusyId] = React.useState<string | null>(null);

  const teams = payload?.teams ?? [];
  const projectNameSelected =
    projects.find((p) => p.id === projectId)?.name ??
    projects.find((p) => p.id === selectedProjectId)?.name ??
    (projects[0]?.name ?? "");

  React.useEffect(() => {
    if (projectId) return;
    if (selectedProjectId && selectedProjectId !== "__all__") {
      setProjectId(selectedProjectId);
      return;
    }
    if (projects.length > 0) setProjectId(projects[0].id);
  }, [projectId, selectedProjectId, projects]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/team", { method: "GET", cache: "no-store" });
      const data = (await safeJson(res)) as TeamsPayload | null;

      if (!res.ok) {
        setPayload(data ?? { ok: false, error: `HTTP ${res.status}` });
        setErrorMsg((data && data.error) ? data.error : `Ekip verisi alınamadı (HTTP ${res.status}).`);
        return;
      }

      setPayload(data ?? { ok: true, teams: [] });
    } catch (e: any) {
      setPayload({ ok: false, error: "network_error", teams: [] });
      setErrorMsg(e?.message || "Ağ hatası.");
    } finally {
      setLoading(false);
    }
  }, []);


const fetchAdvanceApprovals = React.useCallback(async () => {
  if (!myName) {
    setAdvanceApprovals([]);
    return;
  }

  setAdvanceLoading(true);
  try {
    const qs = new URLSearchParams({ userName: myName });
    const res = await fetch(`/api/advance?${qs.toString()}`, { method: "GET", cache: "no-store" });
    const data = (await safeJson(res)) as any;
    if (res.ok && data && data.ok && Array.isArray(data.pendingToApprove)) {
      setAdvanceApprovals(data.pendingToApprove);
    } else {
      setAdvanceApprovals([]);
    }
  } catch {
    setAdvanceApprovals([]);
  } finally {
    setAdvanceLoading(false);
  }
}, [myName]);


  React.useEffect(() => {
    refresh();
    fetchAdvanceApprovals();
  }, [refresh, fetchAdvanceApprovals]);

  const onCreateTeam = async () => {
    if (!teamName.trim()) {
      setErrorMsg("Ekip adı zorunlu.");
      return;
    }
    if (!projectNameSelected) {
      setErrorMsg("Proje seçmeden ekip oluşturamazsın. Önce ana sayfadan proje ekle.");
      return;
    }

    if (!userId) {
      setErrorMsg("Kullanıcı bilgisi yüklenemedi. Sayfayı yenile.");
      return;
    }

    setCreateBusy(true);
    setErrorMsg(null);

    try {
      const body = {
        name: teamName.trim(),
        teamName: teamName.trim(),
        projectName: projectNameSelected,
        ownerId: userId,
      };

      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await safeJson(res);

      if (!res.ok) {
        setErrorMsg((data && data.error) ? data.error : `Ekip oluşturulamadı (HTTP ${res.status}).`);
        return;
      }

      setTeamName("");
      await refresh();
    } catch (e: any) {
      setErrorMsg(e?.message || "Ağ hatası.");
    } finally {
      setCreateBusy(false);
    }
  };



const onDecidePending = async (teamId: string, memberId: string, decision: "approve" | "reject") => {
  if (!teamId || !memberId) return;
  setErrorMsg(null);

  try {
    const res = await fetch("/api/team/pending", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ teamId, memberId, decision, ownerId: userId || "" }),
    });

    const data = await safeJson(res);

    if (!res.ok) {
      setErrorMsg((data && data.error) ? data.error : `İşlem yapılamadı (HTTP ${res.status}).`);
      return;
    }

    await refresh();
  } catch (e: any) {
    setErrorMsg(e?.message || "Ağ hatası.");
  }
};

const onDecideAdvance = async (id: string, decision: "accept" | "reject") => {
  if (!id) return;
  if (!myName) {
    setErrorMsg("Hesabım sayfasından ad/soyad ve ünvan bilgisini kaydetmelisin.");
    return;
  }
  setErrorMsg(null);

  try {
    const res = await fetch("/api/advance/decide", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, userName: myName, decision }),
    });

    const data = await safeJson(res);

    if (!res.ok) {
      setErrorMsg((data && data.error) ? data.error : `İşlem yapılamadı (HTTP ${res.status}).`);
      return;
    }

    await refresh();
    await fetchAdvanceApprovals();
  } catch (e: any) {
    setErrorMsg(e?.message || "Ağ hatası.");
  }
};

  const onDeleteTeam = async (teamId: string) => {
    if (!userId) return;
    const ok = confirm("Bu ekibi silmek istiyor musun? (Geri alınamaz)");
    if (!ok) return;

    setDeleteBusyId(teamId);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/team", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamId, ownerId: userId }),
      });

      const data = await safeJson(res);

      if (!res.ok) {
        setErrorMsg((data && data.error) ? data.error : `Ekip silinemedi (HTTP ${res.status}).`);
        return;
      }

      await refresh();
    } catch (e: any) {
      setErrorMsg(e?.message || "Ağ hatası.");
    } finally {
      setDeleteBusyId(null);
    }
  };

  const onJoinTeam = async () => {
    if (!joinCode.trim()) {
      setErrorMsg("Ekip kodu zorunlu.");
      return;
    }
    if (!myName) {
      setErrorMsg("Katılım için önce Hesabım sayfasından ad/soyad ve ünvan bilgisini kaydetmelisin.");
      return;
    }
    setJoinBusy(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/team/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ joinCode: joinCode.trim(), name: myName, role: myRole || "Yapım Asistanı" }),
      });

      const data = await safeJson(res);
      if (!res.ok) {
        setErrorMsg((data && data.error) ? data.error : `Katılım isteği gönderilemedi (HTTP ${res.status}).`);
        return;
      }

      setJoinCode("");
      await refresh();
    } catch (e: any) {
      setErrorMsg(e?.message || "Ağ hatası.");
    } finally {
      setJoinBusy(false);
    }
  };

  const onManualAdd = async () => {
    if (!manualTeamId) return;
    if (!manualName.trim()) {
      setErrorMsg("Üye adı zorunlu.");
      return;
    }

    setManualBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/team/member", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teamId: manualTeamId,
          name: manualName.trim(),
          role: manualRole,
        }),
      });

      const data = await safeJson(res);
      if (!res.ok) {
        setErrorMsg((data && data.error) ? data.error : `Üye eklenemedi (HTTP ${res.status}).`);
        return;
      }

      setManualName("");
      setManualRole("Yapım Asistanı");
      setManualTeamId(null);
      await refresh();
    } catch (e: any) {
      setErrorMsg(e?.message || "Ağ hatası.");
    } finally {
      setManualBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-100">Ekibim</div>
          <div className="mt-1 text-xs text-slate-400">
            Proje bazlı ekip oluştur, ekip koduyla katılım al. App kullanmayan kişiler için manuel üye ekleyebilirsin.
          </div>
        </div>

        <Link
          href="/app"
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
        >
          ← Geri
        </Link>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-slate-100">Yeni Ekip Oluştur</div>
          <div className="mt-1 text-xs text-slate-400">Ekip adı örnekleri: Yapım Ekibi, Reji Ekibi, Sanat Ekibi…</div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-300">Ekip Adı</label>
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="mt-1 h-11 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-white/10"
                placeholder="Yapım Ekibi"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300">Proje</label>

              {projects.length === 0 ? (
                <div className="mt-1 rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-3 text-xs text-slate-300">
                  Henüz proje yok. Ana sayfadan proje ekledikten sonra burada seçebilirsin.
                </div>
              ) : (
                <select
                  value={projectId || ""}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="mt-1 h-11 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-white/10 [color-scheme:dark]"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-slate-950 text-slate-100">
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button
              type="button"
              onClick={onCreateTeam}
              disabled={createBusy || projects.length === 0}
              className="h-11 w-full rounded-2xl bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
            >
              {createBusy ? "Oluşturuluyor…" : "Oluştur"}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-slate-100">Ekip Koduyla Katıl</div>
          <div className="mt-1 text-xs text-slate-400">Ekip owner’ı sana bir katılım kodu verecek.</div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-300">Ekip Kodu</label>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="mt-1 h-11 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-white/10"
                placeholder="HK-XXXXXX"
              />
            </div>

            <button
              type="button"
              onClick={onJoinTeam}
              disabled={joinBusy}
              className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-60"
            >
              {joinBusy ? "Gönderiliyor…" : "Katılma İsteği Gönder"}
            </button>
          </div>
        </div>
      </div>

      {errorMsg ? (
        <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {errorMsg}
        </div>
      ) : null}


<div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
  <div className="flex items-center justify-between">
    <div>
      <div className="text-sm font-semibold text-slate-100">Bekleyen Avans Onayları</div>
      <div className="mt-1 text-xs text-slate-400">
        Birisi sana avans işlemi açtıysa burada görünür. Kabul edince iki tarafın işlemlerine otomatik düşer.
      </div>
    </div>
    <button
      type="button"
      onClick={() => {
        refresh();
        fetchAdvanceApprovals();
      }}
      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
    >
      <RefreshCw className="h-4 w-4" />
      Yenile
    </button>
  </div>

  {advanceLoading ? (
    <div className="mt-3 text-xs text-slate-400">Yükleniyor…</div>
  ) : advanceApprovals.length === 0 ? (
    <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-3 text-sm text-slate-300">
      Bekleyen avans yok.
    </div>
  ) : (
    <div className="mt-3 space-y-2">
      {advanceApprovals.map((a) => (
        <div
          key={a.id}
          className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="truncate text-sm text-slate-100">
              {a.projectName} • {a.fromName} → {a.toName} • {Number(a.amount).toLocaleString("tr-TR")} TL
            </div>
            <div className="text-xs text-slate-400">{a.note ? a.note : "—"}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onDecideAdvance(a.id, "accept")}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15"
            >
              <Check className="h-4 w-4" />
              Kabul
            </button>
            <button
              type="button"
              onClick={() => onDecideAdvance(a.id, "reject")}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/15"
            >
              <X className="h-4 w-4" />
              Reddet
            </button>
          </div>
        </div>
      ))}
    </div>
  )}
</div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-xs text-slate-400">
          {loading ? "Yükleniyor…" : payload ? `${teams.length} ekip` : "—"}
        </div>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
        >
          <RefreshCw className="h-4 w-4" />
          Yenile
        </button>
      </div>

      <div className="mt-3 grid gap-4">
        {teams.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6 text-sm text-slate-300">
            Henüz ekip yok. Yukarıdan ekip oluşturabilir veya kodla katılabilirsin.
          </div>
        ) : (
          teams.map((t) => {
            const canDelete = !t.ownerId || (Boolean(userId) && t.ownerId === userId);
            return (
              <div key={t.id} className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{t.name}</div>
                    <div className="mt-1 text-xs text-slate-400">Proje: {t.projectName}</div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-xs text-slate-400">
                      Kod: <span className="select-all font-semibold text-slate-200">{t.joinCode || "—"}</span>
                    </div>

                    {canDelete ? (
                      <button
                        type="button"
                        onClick={() => onDeleteTeam(t.id)}
                        disabled={deleteBusyId === t.id}
                        className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/15 disabled:opacity-60"
                        title="Ekip Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                        {deleteBusyId === t.id ? "Siliniyor…" : "Sil"}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
                    onClick={() => {
                      setManualTeamId((prev) => (prev === t.id ? null : t.id));
                      setManualName("");
                      setManualRole("Yapım Asistanı");
                    }}
                  >
                    <UserPlus className="h-4 w-4" />
                    Üye ekle
                  </button>
                </div>

                {manualTeamId === t.id ? (
                  <div className="mt-3 rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-semibold text-slate-200">Üye</div>
                    <div className="mt-3 grid gap-3 md:grid-cols-[1fr_240px_140px]">
                      <input
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        placeholder="Ad Soyad (örn: Ali Veli)"
                        className="h-11 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-white/10"
                      />
                      <select
                        value={manualRole}
                        onChange={(e) => setManualRole(e.target.value as MemberRole)}
                        className="h-11 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-white/10 [color-scheme:dark]"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r} className="bg-slate-950 text-slate-100">
                            {r}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={onManualAdd}
                        disabled={manualBusy}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
                      >
                        <Plus className="h-4 w-4" />
                        {manualBusy ? "Ekleniyor…" : "Ekle"}
                      </button>
                    </div>

                    <div className="mt-3 text-xs text-slate-400">
                      Bu yöntem app kullanmayan kişiler için: onay akışına girmeden direkt üye ekler.
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs font-semibold text-slate-200">Üyeler</div>
                    <div className="mt-2 space-y-2">
                      {(t.members ?? []).length === 0 ? (
                        <div className="text-xs text-slate-400">Üye yok.</div>
                      ) : (
                        (t.members ?? []).map((m) => (
                          <div key={m.id} className="flex items-center justify-between">
                            <div className="min-w-0">
                              <div className="truncate text-sm text-slate-100">{m.name}</div>
                              <div className="text-xs text-slate-400">{m.role}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs font-semibold text-slate-200">Onay Bekleyenler</div>
                    <div className="mt-2 space-y-2">
                      {(t.pendingMembers ?? []).length === 0 ? (
                        <div className="text-xs text-slate-400">Bekleyen istek yok.</div>
                      ) : (
                        (t.pendingMembers ?? []).map((m) => (
                      <div key={m.id} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-950/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="truncate text-sm text-slate-100">{m.name}</div>
                          <div className="text-xs text-slate-400">{m.role}</div>
                        </div>

                        {canDelete ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onDecidePending(t.id, m.id, "approve")}
                              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15"
                            >
                              <Check className="h-4 w-4" />
                              Onayla
                            </button>
                            <button
                              type="button"
                              onClick={() => onDecidePending(t.id, m.id, "reject")}
                              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/15"
                            >
                              <X className="h-4 w-4" />
                              Reddet
                            </button>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400">Owner onayı gerekli</div>
                        )}
                      </div>
                    ))                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
