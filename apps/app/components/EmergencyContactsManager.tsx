"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Phone, Plus, Trash2, ChevronUp, ChevronDown, ShieldCheck, X } from "lucide-react";

type Contact = { id: string; name: string; phone: string; relation: string | null; isPrimary: boolean; priority: number };

export default function EmergencyContactsManager({
  contacts,
  onChange,
}: {
  contacts: Contact[];
  onChange: (next: Contact[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRelation, setNewRelation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function persistOrder(next: Contact[]) {
    onChange(next); // optimistic
    try {
      const token = getToken();
      await apiFetch(
        "/profile/emergency-contacts/reorder",
        { method: "PUT", body: JSON.stringify({ orderedIds: next.map((c) => c.id) }) },
        token ?? undefined
      );
    } catch {
      // best-effort — a failed reorder will simply re-sync on next page load
    }
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...contacts];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    persistOrder(next);
  }
  function moveDown(index: number) {
    if (index === contacts.length - 1) return;
    const next = [...contacts];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    persistOrder(next);
  }

  async function handleAdd() {
    if (!newName.trim() || !newPhone.trim()) {
      setError("Name und Telefonnummer sind nötig.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const token = getToken();
      const created = await apiFetch(
        "/profile/emergency-contacts",
        { method: "POST", body: JSON.stringify({ name: newName.trim(), phone: newPhone.trim(), relation: newRelation.trim() || null }) },
        token ?? undefined
      );
      const next = [...contacts, created];
      // If this is the only contact, make it primary immediately via reorder.
      await persistOrder(next);
      setNewName(""); setNewPhone(""); setNewRelation("");
      setAdding(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kontakt konnte nicht gespeichert werden");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const token = getToken();
      await apiFetch(`/profile/emergency-contacts/${id}`, { method: "DELETE" }, token ?? undefined);
      const next = contacts.filter((c) => c.id !== id);
      onChange(next);
      if (next.length > 0) await persistOrder(next);
    } catch {}
  }

  return (
    <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-7">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-display font-semibold text-sm text-forest-950">Notfallkontakte</h3>
        {!adding && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs text-forest-700 font-medium hover:underline">
            <Plus className="w-3.5 h-3.5" /> Hinzufügen
          </button>
        )}
      </div>
      <p className="text-xs text-stone mb-4">
        Im Notfall werden alle Kontakte gleichzeitig per SMS alarmiert. Die Reihenfolge bestimmt, wer im Ersthelfer-Portal zuerst angerufen wird.
      </p>

      {contacts.length === 0 && !adding && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
          <ShieldCheck className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">Noch kein Notfallkontakt hinterlegt — das ist für eine sichere Tourenplanung wichtig.</p>
        </div>
      )}

      <div className="space-y-2">
        {contacts.map((c, i) => (
          <div key={c.id} className="flex items-center gap-3 rounded-xl border border-forest-950/[0.08] bg-white p-3">
            <div className="flex flex-col shrink-0">
              <button onClick={() => moveUp(i)} disabled={i === 0} className="text-stone hover:text-forest-700 disabled:opacity-20 transition-colors">
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => moveDown(i)} disabled={i === contacts.length - 1} className="text-stone hover:text-forest-700 disabled:opacity-20 transition-colors">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="w-8 h-8 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center text-xs font-bold shrink-0">
              {c.name[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-forest-950 truncate">{c.name}</p>
                {i === 0 && (
                  <span className="text-[10px] font-bold text-forest-700 bg-forest-100 px-2 py-0.5 rounded-full shrink-0">Primär</span>
                )}
              </div>
              <p className="text-xs text-stone">{c.relation ? `${c.relation} · ` : ""}{c.phone}</p>
            </div>
            <a href={`tel:${c.phone}`} className="p-2 text-forest-950/40 hover:text-forest-700 transition-colors shrink-0">
              <Phone className="w-4 h-4" />
            </a>
            <button onClick={() => handleDelete(c.id)} className="p-2 text-stone hover:text-alarm transition-colors shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {adding && (
        <div className="mt-3 rounded-xl border border-forest-950/[0.08] bg-forest-100/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-forest-950/70">Neuer Kontakt</span>
            <button onClick={() => { setAdding(false); setError(""); }} className="text-stone hover:text-forest-950">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {error && <p className="text-xs text-alarm mb-2">{error}</p>}
          <div className="space-y-2">
            <input
              type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name"
              className="w-full rounded-lg border border-forest-950/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30"
            />
            <input
              type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Telefonnummer"
              className="w-full rounded-lg border border-forest-950/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30"
            />
            <input
              type="text" value={newRelation} onChange={(e) => setNewRelation(e.target.value)} placeholder="Beziehung (optional, z. B. Partner:in)"
              className="w-full rounded-lg border border-forest-950/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30"
            />
            <button
              onClick={handleAdd} disabled={busy}
              className="w-full bg-forest-700 text-white rounded-lg py-2 text-sm font-semibold hover:bg-forest-600 transition-colors disabled:opacity-60"
            >
              {busy ? "Speichert…" : "Kontakt speichern"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
