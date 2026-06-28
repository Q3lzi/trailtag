"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { setToken } from "@/lib/auth";
import AuthShell from "@/components/AuthShell";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setToken(data.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Anmeldung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="font-display text-xl font-semibold text-forest-950 mb-1">Willkommen zurück</h1>
      <p className="text-sm text-stone mb-6">Melde dich mit deinem Trailtag-Konto an.</p>

      {error && (
        <div className="bg-alarm-50 border border-alarm-100 text-alarm text-sm rounded-xl px-4 py-3 mb-5">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">E-Mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700 transition-shadow"
            placeholder="du@email.ch"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Passwort</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700 transition-shadow"
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-forest-700 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-forest-600 transition-colors disabled:opacity-60"
        >
          {loading ? "Anmelden…" : "Einloggen"}
        </button>
      </form>

      <div className="mt-5 flex items-center justify-between text-xs">
        <Link href="/forgot-password" className="text-forest-700 font-medium hover:underline">
          Passwort vergessen?
        </Link>
        <Link href="/register" className="text-stone hover:text-forest-950">
          Konto erstellen
        </Link>
      </div>
    </AuthShell>
  );
}
