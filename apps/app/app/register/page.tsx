"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { setToken } from "@/lib/auth";
import AuthShell from "@/components/AuthShell";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen haben");
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      setToken(data.token);
      router.push("/verify-email");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registrierung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="font-display text-xl font-semibold text-forest-950 mb-1">Konto erstellen</h1>
      <p className="text-sm text-stone mb-6">Richte deinen Sicherheitsbegleiter in wenigen Minuten ein.</p>

      {error && (
        <div className="bg-alarm-50 border border-alarm-100 text-alarm text-sm rounded-xl px-4 py-3 mb-5">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700 transition-shadow"
            placeholder="Dein Name"
            autoComplete="name"
          />
        </div>
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
            placeholder="Mindestens 8 Zeichen"
            autoComplete="new-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-forest-700 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-forest-600 transition-colors disabled:opacity-60"
        >
          {loading ? "Erstelle Konto…" : "Konto erstellen"}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-stone">
        Schon ein Konto?{" "}
        <Link href="/login" className="text-forest-700 font-medium hover:underline">
          Einloggen
        </Link>
      </p>
    </AuthShell>
  );
}
