"use client";

import { ACTIVITIES, TourFormState } from "./types";

export default function Step1Activity({
  form,
  update,
}: {
  form: TourFormState;
  update: (patch: Partial<TourFormState>) => void;
}) {
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold text-forest-950 mb-1.5">Was steht an?</h2>
      <p className="text-stone text-sm mb-7">Wähle die Art deiner Tour — das bestimmt, welche Angaben wir später abfragen.</p>

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
  );
}
