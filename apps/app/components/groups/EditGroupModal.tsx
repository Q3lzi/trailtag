"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { SAC_LEVELS, KLETTERSTEIG_GRADES, MTB_SCALES } from "@/components/create-tour/types";
import { X, Loader2 } from "lucide-react";

/**
 * Lets the organizer correct or fill in route name, difficulty, notes, and
 * parking after the group already exists — planning a shared hike isn't
 * always finished in one sitting, and there was previously no way back in
 * to fix a typo or add a difficulty rating after creation.
 */
export default function EditGroupModal({
  group,
  onSave,
  onCancel,
}: {
  group: any;
  onSave: (patch: any) => void;
  onCancel: () => void;
}) {
  const [routeName, setRouteName] = useState(group.routeName || "");
  const [difficulty, setDifficulty] = useState(group.difficulty || "");
  const [notes, setNotes] = useState(group.notes || "");
  const [parkingLocation, setParkingLocation] = useState(group.parkingLocation || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      const token = getToken();
      const updated = await apiFetch(
        `/tour-groups/${group.id}`,
        { method: "PUT", body: JSON.stringify({ routeName, difficulty, notes, parkingLocation }) },
        token ?? undefined
      );
      onSave(updated);
    } catch (err: any) {
      setError(err?.message ?? "Konnte nicht gespeichert werden");
    } finally {
      setSaving(false);
    }
  }

  const difficultyOptions =
    group.activity === "WANDERN" || group.activity === "BERGTOUR" || group.activity === "SKITOUR"
      ? SAC_LEVELS.map((s) => s.key)
      : group.activity === "KLETTERSTEIG"
      ? KLETTERSTEIG_GRADES
      : group.activity === "MOUNTAINBIKE"
      ? MTB_SCALES
      : [];

  return (
    <div className="fixed inset-0 bg-forest-950/40 backdrop-blur-sm flex items-center justify-center z-50 p-6" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-semibold text-forest-950">Tour bearbeiten</h3>
          <button onClick={onCancel} className="text-stone hover:text-forest-950 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Name der Tour</label>
            <input
              type="text" value={routeName} onChange={(e) => setRouteName(e.target.value)}
              className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30"
            />
          </div>

          {difficultyOptions.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-forest-950/70 mb-2">Schwierigkeit</label>
              <div className="flex gap-2 flex-wrap">
                {difficultyOptions.map((d) => (
                  <button
                    key={d} type="button" onClick={() => setDifficulty(d)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors ${
                      difficulty === d ? "border-forest-700 bg-forest-100 text-forest-700" : "border-forest-950/15 text-forest-950/70"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Parkplatz / Trailhead</label>
            <input
              type="text" value={parkingLocation} onChange={(e) => setParkingLocation(e.target.value)}
              placeholder="z. B. Parkplatz beim Restaurant"
              className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Notizen für die Gruppe</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
              className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 resize-none"
            />
          </div>
        </div>

        {error && <p className="text-xs text-alarm mt-3">{error}</p>}

        <div className="flex items-center gap-2 mt-5">
          <button
            onClick={save} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-forest-700 text-white py-2.5 text-sm font-semibold hover:bg-forest-600 transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? "Wird gespeichert…" : "Speichern"}
          </button>
          <button onClick={onCancel} className="rounded-xl border border-forest-950/15 text-forest-950/70 px-4 py-2.5 text-sm font-medium hover:border-forest-950/30 transition-colors">
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
