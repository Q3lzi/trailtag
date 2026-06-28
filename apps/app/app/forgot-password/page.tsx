"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import AuthShell from "@/components/AuthShell";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setStep("reset");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Fehler beim Senden");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwörter stimmen nicht überein");
      return;
    }
    if (newPassword.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen haben");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), code: code.trim(), newPassword }),
      });
      router.push("/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Fehler beim Zurücksetzen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="font-display text-xl font-semibold text-forest-950 mb-1">Passwort vergessen</h1>
      <p className="text-sm text-stone mb-6">
        {step === "request"
          ? "Gib deine E-Mail-Adresse ein, wir senden dir einen Code."
          : `Code wurde an ${email} gesendet.`}
      </p>

      {error && (
        <div className="bg-alarm-50 border border-alarm-100 text-alarm text-sm rounded-xl px-4 py-3 mb-5">
          {error}
        </div>
      )}

      {step === "request" ? (
        <form onSubmit={handleRequestCode} className="space-y-4">
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
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-forest-700 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-forest-600 transition-colors disabled:opacity-60"
          >
            {loading ? "Sende…" : "Code anfordern"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Code (6-stellig)</label>
            <input
              type="text"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-center text-lg tracking-[0.3em] font-display focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700 transition-shadow"
              placeholder="000000"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Neues Passwort</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700 transition-shadow"
              placeholder="Mindestens 8 Zeichen"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Passwort bestätigen</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700 transition-shadow"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-forest-700 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-forest-600 transition-colors disabled:opacity-60"
          >
            {loading ? "Ändere…" : "Passwort ändern"}
          </button>
          <button
            type="button"
            onClick={() => handleRequestCode({ preventDefault: () => {} } as React.FormEvent)}
            className="w-full text-center text-xs text-forest-700 font-medium hover:underline"
          >
            Code erneut senden
          </button>
        </form>
      )}

      <p className="mt-5 text-center text-xs text-stone">
        <Link href="/login" className="text-forest-700 font-medium hover:underline">
          Zurück zum Login
        </Link>
      </p>
    </AuthShell>
  );
}
