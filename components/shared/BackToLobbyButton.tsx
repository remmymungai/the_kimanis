"use client";

import { useRouter } from "next/navigation";

export function BackToLobbyButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.replace("/play")}
      className="mt-2 px-6 py-3 rounded-xl border-2 border-olive text-olive font-semibold text-sm
                 active:scale-95 transition-all duration-100"
    >
      ← Back to Lobby
    </button>
  );
}
