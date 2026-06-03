"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SESSION_CHANNEL } from "@/lib/games";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  display_name: string;
  joined_at: string;
  is_blocked: boolean;
  points: number;
};

export default function AdminLobbyPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: guests }, { data: answers }] = await Promise.all([
      supabase.from("guests").select("id, display_name, joined_at, is_blocked"),
      supabase.from("answers").select("guest_id, points_awarded"),
    ]);

    const totals: Record<string, number> = {};
    for (const a of answers ?? []) {
      totals[a.guest_id] = (totals[a.guest_id] ?? 0) + (a.points_awarded ?? 0);
    }

    const merged: Row[] = (guests ?? [])
      .map((g) => ({
        id: g.id,
        display_name: g.display_name,
        joined_at: g.joined_at,
        is_blocked: g.is_blocked,
        points: totals[g.id] ?? 0,
      }))
      .sort((a, b) => b.points - a.points || a.display_name.localeCompare(b.display_name));

    setRows(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase
      .channel(SESSION_CHANNEL)
      .on("broadcast", { event: "game_event" }, (payload) => {
        if (payload.payload.type === "GUEST_JOINED") load();
      })
      .subscribe();
    const poll = setInterval(load, 5000);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [load]);

  async function kick(row: Row) {
    setBusy(row.id);
    await fetch(`/api/admin/guests/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_blocked: !row.is_blocked }),
    });
    await load();
    setBusy(null);
  }

  async function remove(row: Row) {
    if (!window.confirm(`Remove ${row.display_name}? This deletes their scores too.`)) return;
    setBusy(row.id);
    await fetch(`/api/admin/guests/${row.id}`, { method: "DELETE" });
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setBusy(null);
  }

  return (
    <main className="min-h-dvh bg-dark text-white pb-8">
      <header className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
        <button onClick={() => router.back()} className="text-white/60 text-sm">← Back</button>
        <div className="flex-1">
          <h1 className="font-bold">Guest Lobby</h1>
          <p className="text-white/50 text-xs">{rows.length} joined · overall standings</p>
        </div>
        <a href="/admin/dashboard" className="px-3 py-1.5 border border-white/20 rounded-xl text-xs text-white/60">Games</a>
      </header>

      <div className="p-5 space-y-2 max-w-lg mx-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-4 border-gold border-t-transparent animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-white/40">
            <p className="text-4xl mb-3">👥</p>
            <p>No guests have joined yet.</p>
          </div>
        ) : (
          rows.map((r, i) => (
            <div
              key={r.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl border",
                r.is_blocked ? "bg-blush/10 border-blush/30 opacity-60" : "bg-white/5 border-white/10"
              )}
            >
              <span className="w-6 text-center text-sm font-bold text-white/40">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white truncate">
                  {r.display_name}
                  {r.is_blocked && <span className="ml-2 text-xs text-blush">kicked</span>}
                </p>
                <p className="text-white/40 text-xs">{r.points.toLocaleString()} pts</p>
              </div>
              <button
                onClick={() => kick(r)}
                disabled={busy === r.id}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/20 text-white/70 disabled:opacity-40"
              >
                {r.is_blocked ? "Un-kick" : "Kick"}
              </button>
              <button
                onClick={() => remove(r)}
                disabled={busy === r.id}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blush/80 text-white disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
