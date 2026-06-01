"use client";

import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/types/realtime";

type Props = {
  entries: LeaderboardEntry[];
  highlightGuestId?: string;
  title?: string;
  className?: string;
};

const RANK_MEDALS = ["🥇", "🥈", "🥉"];
const RANK_COLORS = ["bg-gold/20 border-gold", "bg-muted border-border", "bg-blush/10 border-blush/30"];

export function Leaderboard({ entries, highlightGuestId, title = "Leaderboard", className }: Props) {
  const top = entries.slice(0, 10);

  return (
    <div className={cn("w-full max-w-sm mx-auto", className)}>
      <h2 className="text-center text-lg font-bold text-dark mb-4">{title}</h2>
      <div className="space-y-2">
        {top.map((entry) => {
          const isHighlighted = entry.guest_id === highlightGuestId;
          const medal = RANK_MEDALS[entry.rank - 1];
          const rankColor = RANK_COLORS[entry.rank - 1] ?? "";

          return (
            <div
              key={entry.guest_id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all",
                rankColor || "bg-white border-border",
                isHighlighted && "ring-2 ring-olive ring-offset-1"
              )}
            >
              {/* Rank */}
              <span className="text-xl w-8 text-center flex-shrink-0">
                {medal ?? <span className="text-sm font-bold text-muted-foreground">{entry.rank}</span>}
              </span>

              {/* Name */}
              <span className={cn("flex-1 font-semibold truncate", isHighlighted ? "text-olive" : "text-dark")}>
                {entry.display_name}
                {isHighlighted && <span className="text-xs ml-1 font-normal text-olive/70">(you)</span>}
              </span>

              {/* Points */}
              <span className="text-sm font-bold text-dark tabular-nums">
                {entry.cumulative_points.toLocaleString()} pts
              </span>
            </div>
          );
        })}

        {entries.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No scores yet</p>
        )}
      </div>
    </div>
  );
}
