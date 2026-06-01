"use client";

import { useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeMessage } from "@/types/realtime";
import type { GameInstance, Question } from "@/types";

type GameChannelOptions = {
  gameInstanceId: string;
  onMessage: (msg: RealtimeMessage) => void;
};

export function useGameChannel({ gameInstanceId, onMessage }: GameChannelOptions) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const syncState = useCallback(async () => {
    const supabase = createClient();
    const { data: game } = await supabase
      .from("game_instances")
      .select("*")
      .eq("id", gameInstanceId)
      .single();

    if (!game) return;

    const g = game as GameInstance;

    if (g.status === "question_open" || g.status === "question_closed") {
      const { data: question } = await supabase
        .from("questions")
        .select("*")
        .eq("game_instance_id", gameInstanceId)
        .eq("index", g.current_question_index)
        .single();

      if (question) {
        const q = question as Question;
        onMessageRef.current({
          type: "QUESTION_REVEAL",
          question: {
            id: q.id,
            index: q.index,
            prompt: q.prompt,
            question_type: q.question_type,
            options: q.options
              ? (q.options as { id: string; text: string; is_correct: boolean }[]).map(
                  ({ id, text }) => ({ id, text })
                )
              : null,
            time_limit_seconds: q.time_limit_seconds,
            media_url: q.media_url,
            total_questions: 0, // updated via separate count query if needed
          },
          opens_at: g.activated_at ?? new Date().toISOString(),
          closes_at: null,
        });
      }
    }

    onMessageRef.current({
      type: "GAME_STATE_CHANGE",
      game_instance_id: g.id,
      new_status: g.status,
      current_question_index: g.current_question_index,
    });
  }, [gameInstanceId]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`game:${gameInstanceId}`)
      .on("broadcast", { event: "game_event" }, (payload) => {
        onMessageRef.current(payload.payload as RealtimeMessage);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Sync on subscribe in case we missed messages while reconnecting
          syncState();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameInstanceId, syncState]);
}
