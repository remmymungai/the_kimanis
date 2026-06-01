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
    async (eventSlug: string, displayName: string): Promise<{ error?: string }> => {
      const supabase = createClient();

      // Look up event
      const { data: event, error: eErr } = await supabase
        .from("events")
        .select("id")
        .eq("slug", eventSlug)
        .eq("is_active", true)
        .single();

      if (eErr || !event) return { error: "Event not found." };

      // Check if name exists (returning guest)
      const { data: existing } = await supabase
        .from("guests")
        .select("*")
        .eq("event_id", event.id)
        .eq("display_name", displayName.trim())
        .single();

      if (existing) {
        storeSession(existing.id, existing.display_name);
        setState({ status: "authenticated", guest: existing as Guest });
        return {};
      }

      // New guest
      const { data: newGuest, error: gErr } = await supabase
        .from("guests")
        .insert({ event_id: event.id, display_name: displayName.trim() })
        .select()
        .single();

      if (gErr || !newGuest) {
        if (gErr?.code === "23505") return { error: "That name is already taken! Try adding your surname." };
        return { error: "Could not join the party. Please try again." };
      }

      storeSession(newGuest.id, newGuest.display_name);
      setState({ status: "authenticated", guest: newGuest as Guest });
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
