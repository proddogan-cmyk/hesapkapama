import type { AppState, Category, Transaction } from "@/lib/types";
import { nameKey, canonicalName } from "@/lib/name";

export function bySelectedProject(state: AppState): Transaction[] {
  const pid = state.selectedProjectId;
  const all = state.transactions || [];
  if (!pid) return [];
  if (pid === "__all__") return all;
  return all.filter((t) => t.projectId === pid);
}

export function totals(txs: Transaction[] | undefined) {
  const list = Array.isArray(txs) ? txs : [];
  const totalIn = list.filter((t) => t.kind === "income").reduce((a, t) => a + (t.amount || 0), 0);
  const totalOut = list.filter((t) => t.kind === "expense").reduce((a, t) => a + (t.amount || 0), 0);
  return { totalIn, totalOut, balance: totalIn - totalOut };
}

export function categoryTotals(txs: Transaction[] | undefined) {
  const list = Array.isArray(txs) ? txs : [];
  const map = new Map<Category, number>();
  for (const t of list) {
    if (t.kind !== "expense") continue;
    map.set(t.category, (map.get(t.category) || 0) + (t.amount || 0));
  }
  return Array.from(map.entries()).sort((a,b) => b[1]-a[1]);
}

export function advanceByPerson(txs: Transaction[] | undefined) {
  const list = Array.isArray(txs) ? txs : [];
  const inMap = new Map<string, { label: string; amount: number }>();
  const outMap = new Map<string, { label: string; amount: number }>();

  for (const t of list) {
    if (t.subtype === "advance_in") {
      const key = nameKey(t.who);
      const prev = inMap.get(key);
      inMap.set(key, { label: prev?.label || canonicalName(t.who), amount: (prev?.amount || 0) + (t.amount || 0) });
    }
    if (t.subtype === "advance_out") {
      const key = nameKey(t.who);
      const prev = outMap.get(key);
      outMap.set(key, { label: prev?.label || canonicalName(t.who), amount: (prev?.amount || 0) + (t.amount || 0) });
    }
  }

  const inArr = Array.from(inMap.values()).sort((a,b) => b.amount - a.amount);
  const outArr = Array.from(outMap.values()).sort((a,b) => b.amount - a.amount);
  return { inArr, outArr };
}
