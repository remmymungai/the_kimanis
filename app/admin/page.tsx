"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });

    if (authErr) {
      setError(authErr.message);
      setLoading(false);
      return;
    }

    router.replace("/admin/dashboard");
  }

  return (
    <main className="min-h-dvh bg-dark flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">💍</div>
          <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
          <p className="text-white/50 mt-1 text-sm">The Kimanis Engagement Party</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Admin email"
            autoComplete="email"
            required
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white
                       placeholder:text-white/40 focus:outline-none focus:border-gold transition-colors"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            required
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white
                       placeholder:text-white/40 focus:outline-none focus:border-gold transition-colors"
          />
          {error && <p className="text-blush text-sm font-medium">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl bg-gold text-dark font-bold text-base
                       active:scale-95 transition-all duration-100 disabled:opacity-40"
          >
            {loading ? "Signing in..." : "Sign In →"}
          </button>
        </form>
      </div>
    </main>
  );
}
