"use client";

import * as React from "react";
import clsx from "clsx";
import { ROLE_GROUPS, type TeamRole, roleOrderIndex } from "@/lib/teamRoles";

export type TeamDto = {
  id: string;
  ownerUserId: string;
  projectName: string;
  joinCode: string;
  createdAt: number;
  members: Array<{ userId: string; displayName: string; role: string; joinedAt: number }>;
};

export type JoinRequestDto = {
  id: string;
  teamId: string;
  userId: string;
  displayName: string;
  role: string;
  createdAt: number;
  status: "pending" | "approved" | "rejected";
};

export type TransferDto = {
  id: string;
  teamId: string;
  projectName: string;
  fromUserId: string;
  fromDisplayName: string;
  toUserId: string;
  toDisplayName: string;
  amount: number;
  note?: string;
  createdAt: number;
  status: "pending" | "approved" | "rejected";
  approvedAt?: number;
};

export function TeamCard(props: {
  meUserId: string;
  team: TeamDto;
  localProjectOptions: Array<{ id: string; name: string }>;
  mappedProjectId?: string;
  onMapProject: (teamId: string, projectId: string) => void;

  pendingRequests: JoinRequestDto[];
  onApproveRequest: (teamId: string, requestId: string, action: "approve" | "reject") => void;

  onRemoveMember: (teamId: string, memberUserId: string) => void;

  onOpenSendAdvance: (team: TeamDto, toUserId: string) => void;

  pendingTransfersForMe: TransferDto[];
  onApproveTransfer: (transferId: string, action: "approve" | "reject") => void;
}) {
  const { meUserId, team } = props;
  const isOwner = team.ownerUserId === meUserId;

  const members = [...team.members].sort((a, b) => {
    const ai = roleOrderIndex(a.role as TeamRole);
    const bi = roleOrderIndex(b.role as TeamRole);
    if (ai !== bi) return ai - bi;
    return a.displayName.localeCompare(b.displayName);
  });

  const byRole = new Map<string, Array<(typeof members)[number]>>();
  for (const m of members) {
    const key = String(m.role || "Diğer");
    byRole.set(key, [...(byRole.get(key) || []), m]);
  }

  const requests = props.pendingRequests.filter((r) => r.teamId === team.id && r.status === "pending");

  const pendingTransfers = props.pendingTransfersForMe.filter((t) => t.teamId === team.id && t.status === "pending");

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">{team.projectName}</div>
          <div className="mt-1 text-xs text-slate-400">
            Ekip Kodu: <span className="font-semibold text-slate-200">{team.joinCode}</span>
            {isOwner ? " (Paylaş: ekip katılımı onaylıdır)" : ""}
          </div>
        </div>

        <div className="min-w-[220px]">
          <div className="text-xs font-semibold text-slate-300">Bu ekip hangi projeye yazılsın?</div>
          <select
            value={props.mappedProjectId || ""}
            onChange={(e) => props.onMapProject(team.id, e.target.value)}
            className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-slate-100 outline-none"
          >
            <option value="" className="bg-slate-950">Seç…</option>
            {props.localProjectOptions.map((p) => (
              <option key={p.id} value={p.id} className="bg-slate-950">
                {p.name}
              </option>
            ))}
          </select>
          <div className="mt-1 text-[11px] text-slate-500">
            Avans işlemleri bu proje seçimine göre otomatik eklenir.
          </div>
        </div>
      </div>

      {pendingTransfers.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
          <div className="text-xs font-semibold text-amber-200">Avans Onayların</div>
          <div className="mt-2 grid gap-2">
            {pendingTransfers.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-sm text-slate-100">
                  <span className="font-semibold">{t.fromDisplayName}</span> → {t.amount.toLocaleString("tr-TR")} TL
                  {t.note ? <span className="ml-2 text-xs text-slate-400">({t.note})</span> : null}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => props.onApproveTransfer(t.id, "reject")}
                    className="h-10 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-semibold text-slate-200 hover:bg-white/10"
                  >
                    Reddet
                  </button>
                  <button
                    type="button"
                    onClick={() => props.onApproveTransfer(t.id, "approve")}
                    className="h-10 rounded-2xl bg-emerald-500 px-4 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                  >
                    Onayla
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {isOwner && requests.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-semibold text-slate-200">Katılım Onayları</div>
          <div className="mt-2 grid gap-2">
            {requests.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/40 p-3"
              >
                <div className="text-sm text-slate-100">
                  <span className="font-semibold">{r.displayName}</span>
                  <span className="ml-2 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300">
                    {r.role}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => props.onApproveRequest(team.id, r.id, "reject")}
                    className="h-10 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-semibold text-slate-200 hover:bg-white/10"
                  >
                    Reddet
                  </button>
                  <button
                    type="button"
                    onClick={() => props.onApproveRequest(team.id, r.id, "approve")}
                    className="h-10 rounded-2xl bg-emerald-500 px-4 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                  >
                    Onayla
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {ROLE_GROUPS.map((g) => {
          const groupMembers = members.filter((m) => g.roles.includes(m.role as TeamRole));
          if (groupMembers.length === 0) return null;

          return (
            <div key={g.key} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="text-xs font-semibold text-slate-200">{g.title}</div>
              <div className="mt-3 grid gap-2">
                {groupMembers.map((m) => {
                  const isMe = m.userId === meUserId;
                  return (
                    <div
                      key={m.userId}
                      className={clsx(
                        "flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 p-3",
                        isMe && "ring-1 ring-emerald-400/30"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-100">
                          {m.displayName} {isMe ? <span className="text-xs text-emerald-300">(Sen)</span> : null}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">{m.role}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isMe ? (
                          <button
                            type="button"
                            onClick={() => props.onOpenSendAdvance(team, m.userId)}
                            className="h-10 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-semibold text-slate-200 hover:bg-white/10"
                          >
                            Avans Gönder
                          </button>
                        ) : null}

                        {isOwner && !isMe ? (
                          <button
                            type="button"
                            onClick={() => props.onRemoveMember(team.id, m.userId)}
                            className="h-10 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 text-xs font-semibold text-rose-200 hover:bg-rose-500/15"
                          >
                            Çıkar
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
