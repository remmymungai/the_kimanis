"use client";

import { useState, useEffect, useRef } from "react";

export function useCountdown(closesAt: Date | null): {
  remainingMs: number;
  isExpired: boolean;
  progressRatio: number;
} {
  const [remainingMs, setRemainingMs] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!closesAt) {
      setRemainingMs(0);
      return;
    }

    function tick() {
      const ms = closesAt!.getTime() - Date.now();
      setRemainingMs(Math.max(0, ms));
      if (ms > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [closesAt]);

  const totalMs = closesAt
    ? closesAt.getTime() - (closesAt.getTime() - remainingMs) + remainingMs
    : 0;

  return {
    remainingMs,
    isExpired: closesAt !== null && remainingMs <= 0,
    progressRatio: closesAt ? Math.min(1, Math.max(0, remainingMs / (closesAt.getTime() - Date.now() + remainingMs))) : 0,
  };
}
