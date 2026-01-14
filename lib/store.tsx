"use client";

import * as React from "react";
import type { AppState, Category, Profile, Project, Transaction, TxKind, TxSubtype } from "@/lib/types";
import { canonicalName, nameKey } from "@/lib/name";

function safeUUID() {
  const c: any = (globalThis as any).crypto;
  // Preferred path (modern browsers)
  if (c && typeof c.randomUUID === "function") return c.randomUUID();

  // Fallback to RFC4122 v4 using getRandomValues when available
  if (c && typeof c.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);

    // Per RFC4122 section 4.4
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
    return (
      hex.slice(0, 4).join("") +
      "-" +
      hex.slice(4, 6).join("") +
      "-" +
      hex.slice(6, 8).join("") +
      "-" +
      hex.slice(8, 10).join("") +
      "-" +
      hex.slice(10, 16).join("")
    );
  }

  // Last-resort fallback (still unique enough for local usage)
  return `${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
}

const DEFAULT_STATE: AppState = {
  profile: undefined,
  projects: [],
  selectedProjectId: undefined,
  transactions: [],
  nameTags: [],
};

type Store = {
  getState: () => AppState;
  setState: (updater: (s: AppState) => AppState) => void;
  subscribe: (fn: () => void) => () => void;
};

function safeParse(json: string | null): any {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}

function makeStore(storageKey: string): Store {
  let state: AppState = DEFAULT_STATE;

  const persisted = safeParse(typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null);
  if (persisted && typeof persisted === "object") {
    state = {
      ...DEFAULT_STATE,
      ...persisted,
      projects: Array.isArray(persisted.projects) ? persisted.projects : [],
      transactions: Array.isArray(persisted.transactions) ? persisted.transactions : [],
      nameTags: Array.isArray(persisted.nameTags) ? persisted.nameTags : [],
    };
  }

  const listeners = new Set<() => void>();

  function persist(next: AppState) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  return {
    getState: () => state,
    setState: (updater) => {
      state = updater(state);
      persist(state);
      listeners.forEach((l) => l());
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

const StoreContext = React.createContext<Store | null>(null);

export function StoreProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const storeRef = React.useRef<Store | null>(null);

  if (!storeRef.current) {
    storeRef.current = makeStore(`hesapkapama.com:v2:${userId}`);
  }

  return <StoreContext.Provider value={storeRef.current}>{children}</StoreContext.Provider>;
}

export function useAppStore<T>(selector: (s: AppState) => T): T {
  const store = React.useContext(StoreContext);
  if (!store) throw new Error("StoreProvider missing");

  // React's useSyncExternalStore expects getSnapshot to be referentially stable between calls
  // when the underlying store has not changed. Many selectors (especially inline arrow funcs)
  // produce new object/array references each render, which can trigger an infinite loop warning.
  // We cache the last selected value and reuse it when the selection is shallow-equal.
  const selectorRef = React.useRef(selector);
  selectorRef.current = selector;

  const lastSelectedRef = React.useRef<T | undefined>(undefined);

  const shallowEqual = (a: any, b: any): boolean => {
    if (Object.is(a, b)) return true;
    if (!a || !b) return false;

    const aType = typeof a;
    const bType = typeof b;
    if (aType !== "object" || bType !== "object") return false;

    // Arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!Object.is(a[i], b[i])) return false;
      }
      return true;
    }

    // Plain objects
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const k of aKeys) {
      if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
      if (!Object.is(a[k], b[k])) return false;
    }
    return true;
  };

  const getSnapshot = React.useCallback((): T => {
    const next = selectorRef.current(store.getState());
    const prev = lastSelectedRef.current;

    if (prev !== undefined && shallowEqual(prev, next)) {
      return prev;
    }

    lastSelectedRef.current = next;
    return next;
  }, [store]);

  return React.useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

export function useStoreActions() {
  const store = React.useContext(StoreContext);
  if (!store) throw new Error("StoreProvider missing");

  const setProfile = (profile: Profile) =>
    store.setState((s) => ({ ...s, profile }));

  const addProject = (name: string) => {
    const clean = name.trim();
    if (!clean) return undefined;

    const existing = store.getState().projects.find((p) => p.name === clean);
    if (existing) {
      store.setState((s) => ({ ...s, selectedProjectId: existing.id }));
      return existing.id;
    }

    const id = safeUUID();
    store.setState((s) => {
      const p: Project = { id, name: clean, createdAt: Date.now() };
      return { ...s, projects: [p, ...s.projects], selectedProjectId: p.id };
    });
    return id;
  };

  const deleteProject = (id: string) => {
    store.setState((s) => {
      const projects = s.projects.filter((p) => p.id !== id);
      const transactions = s.transactions.filter((t) => t.projectId !== id);

      const selectedProjectId =
        s.selectedProjectId === id ? projects[0]?.id : s.selectedProjectId;

      const nameTagsSet = new Set<string>();
      const nameTags: string[] = [];
      for (const tx of transactions) {
        if (tx.subtype !== "advance_in" && tx.subtype !== "advance_out") continue;
        const canonical = canonicalName(tx.who);
        if (!canonical) continue;
        const key = nameKey(canonical);
        if (!nameTagsSet.has(key)) {
          nameTagsSet.add(key);
          nameTags.push(canonical);
        }
      }

      return { ...s, projects, transactions, selectedProjectId, nameTags: nameTags.slice(0, 200) };
    });
  };

  const selectProject = (id: string) =>
    store.setState((s) => ({ ...s, selectedProjectId: id }));

  const deleteTransaction = (id: string) =>
    store.setState((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) }));

  const updateTransaction = (id: string, patch: Partial<Omit<Transaction, "id">>) => {
    store.setState((s) => {
      let nameTags = s.nameTags;

      const txs = s.transactions.map((t) => {
        if (t.id !== id) return t;

        const nextKind = (patch.kind ?? t.kind) as TxKind;
        const nextSubtype = (patch.subtype ?? t.subtype) as TxSubtype;

        const isAdvance = nextSubtype === "advance_in" || nextSubtype === "advance_out";
        const nextWhoRaw = (patch.who ?? t.who) ?? "";
        const nextWho = isAdvance ? canonicalName(String(nextWhoRaw)) : String(nextWhoRaw).trim();

        if (isAdvance) {
          const key = nameKey(nextWho);
          if (nextWho && !nameTags.some((n) => nameKey(n) === key)) {
            nameTags = [nextWho, ...nameTags].slice(0, 200);
          }
        }

        const nextCategory: Category =
          isAdvance ? "AVANS" : ((patch.category ?? t.category) as Category);

        const next: Transaction = {
          ...t,
          ...patch,
          kind: nextKind,
          subtype: nextSubtype,
          who: nextWho,
          category: nextCategory,
        };

        return next;
      });

      // Keep newest-first ordering by timestamp
      const sorted = [...txs].sort((a, b) => b.ts - a.ts);
      return { ...s, nameTags, transactions: sorted };
    });
  };

  const upsertNameTag = (raw: string) => {
    const canonical = canonicalName(raw);
    if (!canonical) return;
    const key = nameKey(canonical);

    store.setState((s) => {
      const existingKeys = new Set(s.nameTags.map((t) => nameKey(t)));
      if (existingKeys.has(key)) return s;
      return { ...s, nameTags: [canonical, ...s.nameTags].slice(0, 200) };
    });
  };

  const addTransaction = (tx: Omit<Transaction, "id">) => {
    const id = safeUUID();

    // Normalize names for advances
    const isAdvance = tx.subtype === "advance_in" || tx.subtype === "advance_out";
    const who = isAdvance ? canonicalName(tx.who) : tx.who;

    if (isAdvance) upsertNameTag(who);

    store.setState((s) => ({
      ...s,
      transactions: [{ ...tx, id, who }, ...s.transactions],
    }));
  };

  const addTransactionsBulk = (txs: Array<Omit<Transaction, "id">>) => {
    store.setState((s) => {
      const prepared = txs.map((tx) => {
        const id = safeUUID();
        const isAdvance = tx.subtype === "advance_in" || tx.subtype === "advance_out";
        const who = isAdvance ? canonicalName(tx.who) : tx.who;
        if (isAdvance) {
          // update tag list per item
          const key = nameKey(who);
          if (!s.nameTags.some((t) => nameKey(t) === key)) {
            s = { ...s, nameTags: [who, ...s.nameTags] };
          }
        }
        return { ...tx, id, who } as Transaction;
      });

      return { ...s, transactions: [...prepared, ...s.transactions] };
    });
  };

  return {
    setProfile,
    addProject,
    deleteProject,
    selectProject,
    addTransaction,
    addTransactionsBulk,
    updateTransaction,
    deleteTransaction,
    upsertNameTag,
  };
}

export const CATEGORIES: Category[] = [
  "YEMEK",
  "ULAŞIM",
  "TAKSİ",
  "İLETİŞİM",
  "OFİS-KIRTASİYE",
  "KONAKLAMA",
  "MEKAN",
  "SANAT",
  "KOSTÜM",
  "DİĞER",
  "FİŞSİZ",
];

export function defaultCategoryForKind(kind: TxKind): Category {
  return kind === "expense" ? "DİĞER" : "AVANS";
}

export function subtypeLabels(kind: TxKind): Array<{ value: TxSubtype; label: string }> {
  if (kind === "income") return [{ value: "advance_in", label: "Avans Aldım" }, { value: "generic", label: "Diğer Giriş" }];
  return [
    { value: "generic", label: "Harcama" },
    { value: "advance_out", label: "Avans Verdim" },
  ];
}
