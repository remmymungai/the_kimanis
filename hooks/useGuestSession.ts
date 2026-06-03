"use client";

import { useState, useEffect, useCallback } from "react";
import { getStoredGuestId, getStoredDisplayName, storeSession, clearSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";
import type { Guest } from "@/types";

type SessionState =
  | { status: "loading" }
  | { status: "authenticated"; guest: Guest }
  | { status: "unauthenticated" };

export function useGuestSession() {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    const guestId = getStoredGuestId();
    if (!guestId) {
      setState({ status: "unauthenticated" });
      return;
    }

    const supabase = createClient();
    supabase
      .from("guests")
      .select("*")
      .eq("id", guestId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          clearSession();
          setState({ status: "unauthenticated" });
        } else {
          setState({ status: "authenticated", guest: data as Guest });
        }
      });
  }, []);

  const join = useCallback(
    async (_eventSlug: string, displayName: string): Promise<{ error?: string }> => {
      // Centralized in the API: handles uniqueness, session reclaim, and the
      // GUEST_JOINED broadcast that powers the admin lobby.
      const res = await fetch("/api/play/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) return { error: json.error ?? "Could not join the party." };

      const guest = json.guest as Guest;
      storeSession(guest.id, guest.display_name);
      setState({ status: "authenticated", guest });
      return {};
    },
    []
  );

  const leave = useCallback(() => {
    clearSession();
    setState({ status: "unauthenticated" });
  }, []);

  return { state, join, leave };
}
