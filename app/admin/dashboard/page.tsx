"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GAME_TYPE_LABELS } from "@/types/game-config";
import { cn } from "@/lib/utils";
import type { GameInstance } from "@/types";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending:         { label: "Pending",    className: "bg-muted text-muted-foreground" },
  active:          { label: "Active",     className: "bg-sage/20 text-sage" },
  question_open:   { label: "Live",       className: "bg-gold/20 text-gold animate-pulse" },
  question_closed: { label: "Reviewing",  className: "bg-blush/20 text-blush" },
  completed:       { label: "Done",       className: "bg-muted text-muted-foreground" },
};

export default function DashboardPage() {
  const router = useRouter();
  const [games, setGames] = useState<GameInstance[]>([]);
  const [guestCount, setGuestCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase
      .from("game_instances")
      .select("*")
      .order("display_order", { ascending: true })
      .then(({ data }) => {
        if (data) setGames(data as GameInstance[]);
        setLoading(false);
      });

    supabase
      .from("guests")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => setGuestCount(count ?? 0));
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/admin");
  }

  return (
    <main className="min-h-dvh bg-dark text-white">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold">Game Hub Admin</h1>
          <p className="text-white/50 text-sm">{guestCount} guests joined</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/admin/games/new"
            className="px-4 py-2 bg-gold text-dark rounded-xl font-semibold text-sm"
          >
            + New Game
          </a>
          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-xl border border-white/20 text-white/60 text-sm"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Game list */}
      <div className="p-5 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-4 border-gold border-t-transparent animate-spin" />
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-16 text-white/40">
            <p className="text-4xl mb-3">🎮</p>
            <p>No games yet. Create your first one!</p>
          </div>
        ) : (
          games.map((game) => {
            const badge = STATUS_BADGE[game.status] ?? STATUS_BADGE.pending;
            return (
              <div
                key={game.id}
                onClick={() => router.push(`/admin/games/${game.id}`)}
                className="bg-white/5 rounded-2xl p-4 border border-white/10 cursor-pointer
                           active:scale-98 transition-all hover:bg-white/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">{game.title}</p>
                    <p className="text-white/50 text-sm mt-0.5">
                      {GAME_TYPE_LABELS[game.game_type]}
                    </p>
                  </div>
                  <span className={cn("px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0", badge.className)}>
                    {badge.label}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
