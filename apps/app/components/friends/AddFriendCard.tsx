"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { UserPlus, Copy, Check } from "lucide-react";

/**
 * Two-way friend connection: shows the user's own short code to share, and
 * a field to enter someone else's code — mirrors the mobile app's QR-based
 * flow but via a typed code, since scanning isn't practical in a browser.
 */
export default function AddFriendCard({ myCode, onAdded }: { myCode: string | null; onAdded: () => void }) {
  const [inputCode, setInputCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleAdd() {
    if (!inputCode.trim()) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const token = getToken();
      const data = await apiFetch("/friends/add", { method: "POST", body: JSON.stringify({ qrCode: inputCode.trim() }) }, token ?? undefined);
      setSuccess(`Anfrage an ${data.target?.name ?? "Person"} gesendet.`);
      setInputCode("");
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Konnte nicht hinzugefügt werden");
    } finally {
      setSubmitting(false);
    }
  }

  function copyCode() {
    if (!myCode) return;
    navigator.clipboard.writeText(myCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-6">
      <h3 className="font-display font-semibold text-sm text-forest-950 mb-4 flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-forest-700" /> Freunde verbinden
      </h3>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <p className="text-[11px] font-bold text-stone uppercase tracking-wide mb-2">Dein Code</p>
          {myCode ? (
            <button
              onClick={copyCode}
              className="w-full flex items-center justify-between rounded-xl border border-forest-950/10 bg-forest-100/40 px-4 py-3 hover:border-forest-700/30 transition-colors"
            >
              <span className="font-display font-bold text-lg text-forest-950 tracking-wider">{myCode}</span>
              {copied ? <Check className="w-4 h-4 text-forest-700" /> : <Copy className="w-4 h-4 text-forest-950/40" />}
            </button>
          ) : (
            <p className="text-sm text-stone">Lädt…</p>
          )}
          <p className="text-xs text-stone mt-2">Teile diesen Code, damit andere dich hinzufügen können.</p>
        </div>

        <div>
          <p className="text-[11px] font-bold text-stone uppercase tracking-wide mb-2">Code eingeben</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="z. B. AB12CD34"
              className="flex-1 rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700"
              maxLength={12}
            />
            <button
              onClick={handleAdd}
              disabled={submitting || !inputCode.trim()}
              className="rounded-xl bg-forest-700 text-white px-4 py-2.5 text-sm font-semibold hover:bg-forest-600 transition-colors disabled:opacity-50 shrink-0"
            >
              Senden
            </button>
          </div>
          {error && <p className="text-xs text-alarm mt-2">{error}</p>}
          {success && <p className="text-xs text-forest-700 mt-2">{success}</p>}
        </div>
      </div>
    </div>
  );
}
