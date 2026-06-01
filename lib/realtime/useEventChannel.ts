"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeMessage } from "@/types/realtime";

type EventChannelOptions = {
  onMessage: (msg: RealtimeMessage) => void;
};

export function useEventChannel({ onMessage }: EventChannelOptions) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("event:lobby")
      .on("broadcast", { event: "game_event" }, (payload) => {
        onMessageRef.current(payload.payload as RealtimeMessage);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
