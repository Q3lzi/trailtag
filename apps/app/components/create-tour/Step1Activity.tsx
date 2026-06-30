"use client";

import { useRouter } from "next/navigation";
import { ACTIVITIES, TourFormState } from "./types";
import { User, Users, ArrowRight } from "lucide-react";

export default function Step1Activity({
  form,
  update,
  friends = [],
}: {
  form: TourFormState;
  update: (patch: Partial<TourFormState>) => void;
  friends?: any[];
}) {
  const router = useRouter();

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold text-forest-950 mb-1.5">Was steht an?</h2>
      <p className="text-stone text-sm mb-7">Wähle, ob du alleine oder mit Freunden unterwegs bist.</p>

      {/* Solo continues this wizard; "shared" hands off to its own,
          simpler flow entirely — a group hike has different concepts
          (route lives on the group, start mode, suggested ETA) that don't
          map cleanly onto the solo wizard's per-person fields. */}
      <div className="mb-7">
        <label className="block text-xs font-semibold text-forest-950/70 mb-2">Tour-Art</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => update({ isSharedTour: false })}
            className="flex items-center gap-2.5 rounded-xl border border-forest-700 bg-forest-100 shadow-card p-3.5 transition-all"
          >
            <User className="w-4 h-4 text-forest-700" />
            <span className="text-sm font-medium text-forest-700">Alleine</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/touren/neu-gemeinsam")}
            disabled={friends.length === 0}
            className="flex items-center justify-between gap-2.5 rounded-xl border border-forest-950/[0.08] bg-white p-3.5 transition-all hover:border-forest-950/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-forest-950/40" />
              <span className="text-sm font-medium text-forest-950/70">Mit Freunden</span>
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-forest-950/30" />
          </button>
        </div>
        {friends.length === 0 && (
          <p className="text-xs text-stone mt-2">Du hast noch keine Freunde verbunden — das geht in den Profileinstellungen.</p>
        )}
      </div>

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
