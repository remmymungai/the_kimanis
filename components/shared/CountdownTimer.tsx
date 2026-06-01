"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  closesAt: Date | null;
  onExpire?: () => void;
  size?: number;
  strokeWidth?: number;
};

export function CountdownTimer({ closesAt, onExpire, size = 80, strokeWidth = 6 }: Props) {
  const [remainingMs, setRemainingMs] = useState(0);
  const [totalMs, setTotalMs] = useState(0);
  const rafRef = useRef<number | null>(null);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!closesAt) return;
    const total = closesAt.getTime() - Date.now();
    setTotalMs(Math.max(0, total));
    expiredRef.current = false;

    function tick() {
      const ms = closesAt!.getTime() - Date.now();
      const clamped = Math.max(0, ms);
      setRemainingMs(clamped);
      if (clamped > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else if (!expiredRef.current) {
        expiredRef.current = true;
        onExpire?.();
      }
    }

    tick();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [closesAt, onExpire]);

  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const ratio = totalMs > 0 ? remainingMs / totalMs : 0;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - ratio);

  // Color transitions: green → yellow → red
  const color =
    ratio > 0.5 ? "#7A9E7E"   // sage green
    : ratio > 0.25 ? "#C9A227" // gold
    : "#E8927C";               // blush red

  if (!closesAt) return null;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-label={`${remainingSeconds} seconds remaining`}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden="true"
      >
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E8E3D9"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: "stroke 0.3s ease, stroke-dashoffset 0.1s linear" }}
        />
      </svg>
      {/* Number in center */}
      <span
        className="absolute text-lg font-bold tabular-nums"
        style={{ color }}
      >
        {remainingSeconds}
      </span>
    </div>
  );
}
