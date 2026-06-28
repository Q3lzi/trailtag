"use client";

import { ACTIVITIES, SAC_LEVELS, KLETTERSTEIG_GRADES, MTB_SCALES, PISTE_LEVELS, AVALANCHE_RISKS, TRAIL_TYPES, TourFormState } from "./types";

export default function Step5Details({
  form,
  update,
}: {
  form: TourFormState;
  update: (patch: Partial<TourFormState>) => void;
}) {
  const activityDef = ACTIVITIES.find((a) => a.key === form.activity);
  const fields = activityDef?.fields ?? [];

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold text-forest-950 mb-1.5">Letzte Details</h2>
      <p className="text-stone text-sm mb-7">Optional, aber hilfreich für Rettungskräfte im Notfall.</p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {(fields.includes("distance") || !form.gpxData) && (
          <div>
            <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Distanz (km)</label>
            <input
              type="number"
              value={form.distanceKm}
              onChange={(e) => update({ distanceKm: e.target.value })}
              placeholder="z. B. 15"
              className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700"
            />
          </div>
        )}
        {(fields.includes("elevation") || !form.gpxData) && (
          <div>
            <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Höhenmeter</label>
            <input
              type="number"
              value={form.elevationUp}
              onChange={(e) => update({ elevationUp: e.target.value })}
              placeholder="z. B. 900"
              className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700"
            />
          </div>
        )}
      </div>

      {fields.includes("sac") && (
        <div className="mb-6">
          <label className="block text-xs font-semibold text-forest-950/70 mb-2">Schwierigkeit (SAC-Skala)</label>
          <div className="flex gap-2 flex-wrap">
            {SAC_LEVELS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => update({ difficulty: s.key })}
                title={s.desc}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors ${
                  form.difficulty === s.key ? "border-forest-700 bg-forest-100 text-forest-700" : "border-forest-950/15 text-forest-950/70 hover:border-forest-950/30"
                }`}
              >
                {s.key}
              </button>
            ))}
          </div>
        </div>
      )}

      {fields.includes("klettersteig_grade") && (
        <div className="mb-6">
          <label className="block text-xs font-semibold text-forest-950/70 mb-2">Klettersteig-Schwierigkeit</label>
          <div className="flex gap-2">
            {KLETTERSTEIG_GRADES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => update({ klettersteigGrade: g })}
                className={`w-10 h-10 rounded-lg text-sm font-bold border transition-colors ${
                  form.klettersteigGrade === g ? "border-forest-700 bg-forest-100 text-forest-700" : "border-forest-950/15 text-forest-950/70"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {fields.includes("mtb_scale") && (
        <div className="mb-6">
          <label className="block text-xs font-semibold text-forest-950/70 mb-2">MTB-Schwierigkeit</label>
          <div className="flex gap-2">
            {MTB_SCALES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => update({ mtbScale: s })}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  form.mtbScale === s ? "border-forest-700 bg-forest-100 text-forest-700" : "border-forest-950/15 text-forest-950/70"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {fields.includes("trail_type") && (
        <div className="mb-6">
          <label className="block text-xs font-semibold text-forest-950/70 mb-2">Trail-Typ</label>
          <div className="flex gap-2 flex-wrap">
            {TRAIL_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => update({ trailType: t })}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  form.trailType === t ? "border-forest-700 bg-forest-100 text-forest-700" : "border-forest-950/15 text-forest-950/70"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {fields.includes("piste_level") && (
        <div className="mb-6">
          <label className="block text-xs font-semibold text-forest-950/70 mb-2">Pistenniveau</label>
          <div className="flex gap-2">
            {PISTE_LEVELS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => update({ pisteLevel: p })}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  form.pisteLevel === p ? "border-forest-700 bg-forest-100 text-forest-700" : "border-forest-950/15 text-forest-950/70"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {fields.includes("avalanche") && (
        <div className="mb-6">
          <label className="block text-xs font-semibold text-forest-950/70 mb-2">Lawinengefahr</label>
          <div className="flex gap-2">
            {AVALANCHE_RISKS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => update({ avalancheRisk: r.key })}
                title={r.desc}
                className={`w-10 h-10 rounded-lg text-sm font-bold border transition-colors ${
                  form.avalancheRisk === r.key ? "border-forest-700 bg-forest-100 text-forest-700" : "border-forest-950/15 text-forest-950/70"
                }`}
              >
                {r.key}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Notizen für Rettungskräfte</label>
        <textarea
          value={form.notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="z. B. Ausrüstung, geplante Pausen, besondere Hinweise…"
          rows={3}
          className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700 resize-none"
        />
      </div>
    </div>
  );
}
