"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Confession } from "@/types";

export default function ModeratePage() {
  const params = useParams();
  const gameId = params?.id as string;
  const router = useRouter();
  const [pending, setPending] = useState<Confession[]>([]);
  const [approvedCount, setApprovedCount] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: pend }, { count }] = await Promise.all([
      supabase
        .from("confessions")
        .select("*")
        .eq("game_instance_id", gameId)
        .eq("is_approved", false)
        .order("submitted_at", { ascending: true }),
      supabase
        .from("confessions")
        .select("id", { count: "exact", head: true })
        .eq("game_instance_id", gameId)
        .eq("is_approved", true),
    ]);
    setPending((pend as Confession[]) ?? []);
    setApprovedCount(count ?? 0);
  }, [gameId]);

  useEffect(() => {
    load();
    const supabase = createClient();
    // Poll for new pending confessions (they're inserted server-side)
    const poll = setInterval(load, 3000);
    return () => clearInterval(poll);
  }, [load]);

  async function act(id: string, method: "PATCH" | "DELETE") {
    setBusy(id);
    const res = await fetch(`/api/admin/confessions/${id}`, { method });
    if (res.ok) {
      setPending((prev) => prev.filter((c) => c.id !== id));
      if (method === "PATCH") setApprovedCount((c) => c + 1);
    }
    setBusy(null);
  }

  return (
    <main className="min-h-dvh bg-dark text-white pb-8">
      <header className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
        <button onClick={() => router.back()} className="text-white/60 text-sm">← Back</button>
        <div className="flex-1">
          <h1 className="font-bold">Moderate Confessions</h1>
          <p className="text-white/50 text-xs">{approvedCount} approved · {pending.length} pending</p>
        </div>
        <a href={`/wall?game=${gameId}`} target="_blank" rel="noreferrer"
          className="px-3 py-1.5 border border-white/20 rounded-xl text-xs text-white/60">Wall ↗</a>
      </header>

      <div className="p-5 space-y-3 max-w-lg mx-auto">
        {pending.length === 0 ? (
          <div className="text-center py-16 text-white/40">
            <p className="text-4xl mb-3">🤫</p>
            <p>No confessions waiting. New ones appear here automatically.</p>
          </div>
        ) : (
          pending.map((c) => (
            <div key={c.id} className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <p className="text-white text-sm leading-relaxed mb-4">&ldquo;{c.content}&rdquo;</p>
              <div className="flex gap-3">
                <button
                  onClick={() => act(c.id, "PATCH")}
                  disabled={busy === c.id}
                  className="flex-1 py-2.5 bg-sage text-white rounded-xl font-bold text-sm active:scale-95 transition-all disabled:opacity-40"
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => act(c.id, "DELETE")}
                  disabled={busy === c.id}
                  className="flex-1 py-2.5 bg-blush/80 text-white rounded-xl font-bold text-sm active:scale-95 transition-all disabled:opacity-40"
                >
                  ✗ Hide
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
