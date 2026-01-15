"use client";

import * as React from "react";
import { useStore } from "@/lib/store";

/**
 * CloudSync
 * - Requires Clerk-authenticated user (non-local id).
 * - Pulls latest state from server file DB and hydrates local store.
 * - Pushes state changes back to server with debounce.
 */
export function CloudSync({ userId }: { userId: string }) {
  const store = useStore();

  const isLocal = userId.startsWith("local_");

  const pulledRef = React.useRef(false);
  const pushingRef = React.useRef(false);
  const debounceRef = React.useRef<any>(null);

  // Pull once
  React.useEffect(() => {
    if (isLocal) return;
    if (pulledRef.current) return;

    let cancelled = false;
    pulledRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/state/pull", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        const state = data?.state;
        if (state && typeof state === "object") {
          store.setState(() => ({
            profile: state.profile,
            projects: Array.isArray(state.projects) ? state.projects : [],
            selectedProjectId: state.selectedProjectId,
            transactions: Array.isArray(state.transactions) ? state.transactions : [],
            nameTags: Array.isArray(state.nameTags) ? state.nameTags : [],
          }));
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLocal, store]);

  // Push on changes with debounce
  React.useEffect(() => {
    if (isLocal) return;

    const unsub = store.subscribe(() => {
      if (pushingRef.current) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const s = store.getState();
        pushingRef.current = true;
        try {
          await fetch("/api/state/push", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              profile: s.profile,
              projects: s.projects,
              selectedProjectId: s.selectedProjectId,
              transactions: s.transactions,
              nameTags: s.nameTags,
            }),
          }).catch(() => null);
        } finally {
          pushingRef.current = false;
        }
      }, 800);
    });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      unsub();
    };
  }, [isLocal, store]);

  return null;
}
