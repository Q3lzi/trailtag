"use client";

import { TourFormState, Companion } from "./types";
import { Phone, AlertCircle, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";

export default function Step3Emergency({
  form,
  update,
  emergencyContacts,
  friends,
}: {
  form: TourFormState;
  update: (patch: Partial<TourFormState>) => void;
  emergencyContacts: any[];
  friends: any[];
}) {
  function addCompanion() {
    update({ companions: [...form.companions, { name: "", age: "", notes: "" }] });
  }
  function updateCompanion(i: number, patch: Partial<Companion>) {
    const next = [...form.companions];
    next[i] = { ...next[i], ...patch };
    update({ companions: next });
  }
  function removeCompanion(i: number) {
    update({ companions: form.companions.filter((_, j) => j !== i) });
  }
  function addFriendAsCompanion(friend: any) {
    update({ companions: [...form.companions, { name: friend.name, age: "", notes: "" }] });
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold text-forest-950 mb-1.5">Wer wird informiert?</h2>
      <p className="text-stone text-sm mb-7">
        Im Notfall werden alle deine Notfallkontakte benachrichtigt — das gilt für jede Tour automatisch.
      </p>

      {/* Emergency contacts overview (informational — applies account-wide) */}
      <div className="mb-8">
        <label className="block text-xs font-semibold text-forest-950/70 mb-2">Deine Notfallkontakte</label>
        {emergencyContacts.length === 0 ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
            <AlertCircle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800">
              Du hast noch keine Notfallkontakte hinterlegt.{" "}
              <Link href="/dashboard/profil" className="font-medium underline">
                Jetzt im Profil hinzufügen
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {emergencyContacts.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-forest-950/[0.08] bg-white p-3">
                <div className="w-8 h-8 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center text-xs font-bold shrink-0">
                  {c.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-forest-950">{c.name}</p>
                  {c.relation && <p className="text-xs text-stone">{c.relation}</p>}
                </div>
                {c.isPrimary && (
                  <span className="text-[10px] font-bold text-forest-700 bg-forest-100 px-2 py-0.5 rounded-full">Primär</span>
                )}
                <Phone className="w-3.5 h-3.5 text-forest-950/30 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Companions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-semibold text-forest-950/70">Begleitpersonen</label>
          <button type="button" onClick={addCompanion} className="flex items-center gap-1 text-xs text-forest-700 font-medium hover:underline">
            <Plus className="w-3.5 h-3.5" /> Hinzufügen
          </button>
        </div>

        {friends.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
            {friends.map((f) => (
              <button
                key={f.friendshipId}
                type="button"
                onClick={() => addFriendAsCompanion(f)}
                className="flex items-center gap-1.5 shrink-0 rounded-full border border-forest-950/10 bg-white px-3 py-1.5 text-xs font-medium text-forest-950/75 hover:border-forest-700 hover:text-forest-700 transition-colors"
              >
                <Users className="w-3 h-3" /> {f.name}
              </button>
            ))}
          </div>
        )}

        {form.companions.length === 0 ? (
          <p className="text-sm text-stone">Niemand markiert — du bist solo unterwegs.</p>
        ) : (
          <div className="space-y-2.5">
            {form.companions.map((c, i) => (
              <div key={i} className="rounded-xl border border-forest-950/[0.08] bg-white p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={c.name}
                    onChange={(e) => updateCompanion(i, { name: e.target.value })}
                    placeholder="Name"
                    className="flex-1 rounded-lg border border-forest-950/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700"
                  />
                  <input
                    type="text"
                    value={c.age}
                    onChange={(e) => updateCompanion(i, { age: e.target.value })}
                    placeholder="Jg."
                    className="w-20 rounded-lg border border-forest-950/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700"
                  />
                  <button type="button" onClick={() => removeCompanion(i)} className="p-2 text-stone hover:text-alarm transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <input
                  type="text"
                  value={c.notes}
                  onChange={(e) => updateCompanion(i, { notes: e.target.value })}
                  placeholder="Notizen (z. B. medizinische Hinweise)"
                  className="w-full rounded-lg border border-forest-950/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
