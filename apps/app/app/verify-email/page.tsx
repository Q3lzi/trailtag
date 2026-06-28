"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import AuthShell from "@/components/AuthShell";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const token = getToken();
      await apiFetch("/auth/verify-email", { method: "POST", body: JSON.stringify({ code: code.trim() }) }, token ?? undefined);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ungültiger Code");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setInfo("");
    try {
      const token = getToken();
      await apiFetch("/auth/resend-verification", { method: "POST" }, token ?? undefined);
      setInfo("Ein neuer Code wurde gesendet.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Fehler beim Senden");
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="font-display text-xl font-semibold text-forest-950 mb-1">E-Mail bestätigen</h1>
      <p className="text-sm text-stone mb-6">Wir haben dir einen 6-stelligen Code gesendet.</p>

      {error && (
        <div className="bg-alarm-50 border border-alarm-100 text-alarm text-sm rounded-xl px-4 py-3 mb-5">
          {error}
        </div>
      )}
      {info && (
        <div className="bg-forest-100 border border-forest-700/20 text-forest-700 text-sm rounded-xl px-4 py-3 mb-5">
          {info}
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-4">
        <input
          type="text"
          required
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-center text-lg tracking-[0.3em] font-display focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700 transition-shadow"
          placeholder="000000"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-forest-700 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-forest-600 transition-colors disabled:opacity-60"
        >
          {loading ? "Bestätige…" : "Bestätigen"}
        </button>
      </form>

      <div className="mt-5 flex items-center justify-between text-xs">
        <button onClick={handleResend} disabled={resending} className="text-forest-700 font-medium hover:underline">
          {resending ? "Sende…" : "Code erneut senden"}
        </button>
        <Link href="/dashboard" className="text-stone hover:text-forest-950">
          Später
        </Link>
      </div>
    </AuthShell>
  );
}
