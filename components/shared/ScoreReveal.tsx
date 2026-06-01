"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  pointsAwarded: number;
  isCorrect: boolean | null;
  correctAnswer?: string;
  className?: string;
};

export function ScoreReveal({ pointsAwarded, isCorrect, correctAnswer, className }: Props) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShown(true), 50);
    return () => clearTimeout(t);
  }, []);

  const isUnscored = isCorrect === null;

  return (
    <div className={cn("flex flex-col items-center justify-center gap-6 p-8 text-center", className)}>
      {/* Result icon */}
      <div
        className={cn(
          "w-24 h-24 rounded-full flex items-center justify-center text-5xl",
          "transition-all duration-500",
          shown ? "scale-100 opacity-100" : "scale-50 opacity-0",
          isUnscored ? "bg-muted" :
          isCorrect ? "bg-sage/20" : "bg-blush/20"
        )}
      >
        {isUnscored ? "📝" : isCorrect ? "✓" : "✗"}
      </div>

      {/* Points */}
      {!isUnscored && (
        <div
          className={cn(
            "transition-all duration-700 delay-200",
            shown ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          )}
        >
          {isCorrect ? (
            <>
              <p className="text-5xl font-bold text-olive tabular-nums">
                +{pointsAwarded.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground mt-1">points</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-blush">Incorrect</p>
              {correctAnswer && (
                <p className="text-sm text-muted-foreground mt-2">
                  Answer: <span className="font-semibold text-dark">{correctAnswer}</span>
                </p>
              )}
            </>
          )}
        </div>
      )}

      {isUnscored && (
        <p className="text-muted-foreground text-sm">Answer submitted!</p>
      )}
    </div>
  );
}
