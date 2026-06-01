"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGuestSession } from "@/hooks/useGuestSession";

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { state } = useGuestSession();

  useEffect(() => {
    if (state.status === "unauthenticated") {
      router.replace("/join");
    }
  }, [state.status, router]);

  if (state.status === "loading") {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-cream">
        <div className="w-8 h-8 rounded-full border-4 border-olive border-t-transparent animate-spin" />
      </div>
    );
  }

  if (state.status === "unauthenticated") return null;

  return <>{children}</>;
}
