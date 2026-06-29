"use client";

import { ACTIVITIES, TourFormState } from "./types";
import { User, Users } from "lucide-react";

export default function Step1Activity({
  form,
  update,
  friends = [],
}: {
  form: TourFormState;
  update: (patch: Partial<TourFormState>) => void;
  friends?: any[];
}) {
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold text-forest-950 mb-1.5">Was steht an?</h2>
      <p className="text-stone text-sm mb-7">Wähle, ob du alleine oder mit Freunden unterwegs bist, und welche Aktivität es ist.</p>

      {/* Solo vs. shared — set first, since it shapes the rest of the
          wizard (each invited friend tracks their own ETA/contacts). */}
      <div className="mb-7">
        <label className="block text-xs font-semibold text-forest-950/70 mb-2">Tour-Art</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => update({ isSharedTour: false, groupInviteFriendIds: [] })}
            className={`flex items-center gap-2.5 rounded-xl border p-3.5 transition-all ${
              !form.isSharedTour ? "border-forest-700 bg-forest-100 shadow-card" : "border-forest-950/[0.08] bg-white hover:border-forest-950/20"
            }`}
          >
            <User className={`w-4 h-4 ${!form.isSharedTour ? "text-forest-700" : "text-forest-950/40"}`} />
            <span className={`text-sm font-medium ${!form.isSharedTour ? "text-forest-700" : "text-forest-950/70"}`}>Alleine</span>
          </button>
          <button
            type="button"
            onClick={() => update({ isSharedTour: true })}
            disabled={friends.length === 0}
            className={`flex items-center gap-2.5 rounded-xl border p-3.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              form.isSharedTour ? "border-forest-700 bg-forest-100 shadow-card" : "border-forest-950/[0.08] bg-white hover:border-forest-950/20"
            }`}
          >
            <Users className={`w-4 h-4 ${form.isSharedTour ? "text-forest-700" : "text-forest-950/40"}`} />
            <span className={`text-sm font-medium ${form.isSharedTour ? "text-forest-700" : "text-forest-950/70"}`}>Mit Freunden</span>
          </button>
        </div>
        {friends.length === 0 && (
          <p className="text-xs text-stone mt-2">Du hast noch keine Freunde verbunden — das geht in den Profileinstellungen.</p>
        )}
      </div>

      {/* Friend picker appears immediately once "shared" is chosen, instead
          of being buried three steps later — this decision belongs right
          next to the moment it's made. */}
      {form.isSharedTour && friends.length > 0 && (
        <div className="mb-7 rounded-xl border border-forest-700/15 bg-forest-100/40 p-4">
          <label className="block text-xs font-semibold text-forest-950/70 mb-1">Wen einladen?</label>
          <p className="text-xs text-stone mb-3">
            Jeder eingeladene Freund erstellt seine eigene Tour mit eigenem Sicherheits-Timer — ihr seht euch gegenseitig live.
          </p>
          <div className="flex flex-wrap gap-2">
            {friends.map((f) => {
              const selected = form.groupInviteFriendIds.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() =>
                    update({
                      groupInviteFriendIds: selected
                        ? form.groupInviteFriendIds.filter((id) => id !== f.id)
                        : [...form.groupInviteFriendIds, f.id],
                    })
                  }
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                    selected ? "bg-forest-700 text-white border-forest-700" : "bg-white text-forest-950/75 border-forest-950/10 hover:border-forest-700/40"
                  }`}
                >
                  <Users className="w-3 h-3" /> {f.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-forest-950/70 mb-2">Aktivität</label>
        <div className="grid grid-cols-3 gap-3">
          {ACTIVITIES.map((a) => {
            const selected = form.activity === a.key;
            return (
              <button
                key={a.key}
                type="button"
                onClick={() => update({ activity: a.key })}
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                  selected
                    ? "border-forest-700 bg-forest-100 shadow-card"
                    : "border-forest-950/[0.08] bg-white hover:border-forest-950/20"
                }`}
              >
                <span className="text-2xl">{a.emoji}</span>
                <span className={`text-xs font-medium ${selected ? "text-forest-700" : "text-forest-950/70"}`}>{a.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
