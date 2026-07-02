"use client";

import { TourFormState, Companion } from "./types";
import { Users } from "lucide-react";
import TourEmergencyContactPicker from "@/components/TourEmergencyContactPicker";

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
        Wähle, welche Notfallkontakte für diese Tour gelten sollen — falls dein Standardkontakt gerade keine Zeit hat, wählst du hier einfach jemand anderen.
      </p>

      <div className="mb-8">
        <label className="block text-xs font-semibold text-forest-950/70 mb-2">Notfallkontakte für diese Tour</label>
        <TourEmergencyContactPicker
          allContacts={emergencyContacts}
          selectedIds={form.selectedContactIds}
          onChange={(ids) => update({ selectedContactIds: ids })}
        />
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
