"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ConfessionsWall } from "@/components/game/confessions-wall/ConfessionsWall";
import { createClient } from "@/lib/supabase/client";

function WallPageInner() {
  const searchParams = useSearchParams();
  const [gameInstanceId, setGameInstanceId] = useState<string | null>(null);

  const queryId = searchParams?.get("game");

  useEffect(() => {
    if (queryId) {
      setGameInstanceId(queryId);
      return;
    }

    // Auto-detect active confessions_wall game
    const supabase = createClient();
    supabase
      .from("game_instances")
      .select("id")
      .eq("game_type", "confessions_wall")
      .in("status", ["active", "question_open", "completed"])
      .order("activated_at", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setGameInstanceId(data.id);
      });
  }, [queryId]);

  if (!gameInstanceId) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="text-center text-white/60">
          <div className="text-5xl mb-4">🤫</div>
          <p>Confessions Wall not active yet</p>
        </div>
      </div>
    );
  }

  return <ConfessionsWall gameInstanceId={gameInstanceId} />;
}

export default function WallPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-gold border-t-transparent animate-spin" />
      </div>
    }>
      <WallPageInner />
    </Suspense>
  );
}
