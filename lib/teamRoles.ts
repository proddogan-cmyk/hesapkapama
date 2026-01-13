export type TeamRole =
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

export type TeamRoleGroupKey = "production" | "art" | "costume" | "directorate";

export const ROLE_GROUPS: Array<{
  key: TeamRoleGroupKey;
  title: string;
  roles: TeamRole[];
}> = [
  {
    key: "production",
    title: "Yapım Ekibi",
    roles: [
      "Yapımcı",
      "Yapım Amiri",
      "Şef Asistan",
      "Mekan Sorumlusu",
      "Mekan Asistanı",
      "Yapım Asistanı",
      "Runner",
    ],
  },
  {
    key: "art",
    title: "Sanat Ekibi",
    roles: ["Sanat Yönetmeni", "Sanat Asistanı"],
  },
  {
    key: "costume",
    title: "Kostüm Ekibi",
    roles: ["Kostüm Şefi", "Kostüm Asistanı"],
  },
  {
    key: "directorate",
    title: "Reji Ekibi",
    roles: ["Reji 1", "Reji 2", "Reji 3", "Devamlılık Asistanı"],
  },
];

export const ALL_ROLES: TeamRole[] = ROLE_GROUPS.flatMap((g) => g.roles);

export function roleGroupFor(role: TeamRole): TeamRoleGroupKey {
  for (const g of ROLE_GROUPS) {
    if (g.roles.includes(role)) return g.key;
  }
  return "production";
}

export function roleOrderIndex(role: TeamRole): number {
  let idx = 9999;
  for (const g of ROLE_GROUPS) {
    const i = g.roles.indexOf(role);
    if (i >= 0) idx = Math.min(idx, i + (g.key === "production" ? 0 : g.key === "art" ? 100 : g.key === "costume" ? 200 : 300));
  }
  return idx;
}
