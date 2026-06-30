"use client";

import { useState } from "react";
import { X, MapPin, Flag, Droplets, Mountain, AlertTriangle, Coffee, Moon } from "lucide-react";

const WAYPOINT_TYPES = [
  { key: "meeting", label: "Treffpunkt", icon: Flag },
  { key: "water", label: "Wasserstelle", icon: Droplets },
  { key: "viewpoint", label: "Aussichtspunkt", icon: Mountain },
  { key: "hazard", label: "Gefahrenstelle", icon: AlertTriangle },
  { key: "rest", label: "Pausenplatz", icon: Coffee },
  { key: "other", label: "Sonstiges", icon: MapPin },
];

const OVERNIGHT_TYPES = [
  { key: "huette", label: "SAC Hütte" }, { key: "berghuette", label: "Berghütte" },
  { key: "hotel", label: "Hotel/B&B" }, { key: "zelt", label: "Zelt/Biwak" },
  { key: "camping", label: "Camping" }, { key: "schutz", label: "Schutzhütte" },
];

/**
 * Captures context for a point placed on the map — a bare pin tells no one
 * anything; "Wasserstelle bei km 8, ergiebig auch im Sommer" does. Shown
 * right after a map click, before the point is actually saved.
 */
export default function AddPointModal({
  kind,
  onSave,
  onCancel,
}: {
  kind: "waypoint" | "overnight";
  onSave: (data: { name: string; type: string; notes: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState(kind === "waypoint" ? "other" : "huette");
  const [notes, setNotes] = useState("");

  return (
    <div className="fixed inset-0 bg-forest-950/40 backdrop-blur-sm flex items-center justify-center z-50 p-6" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-sm w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-forest-950">
            {kind === "waypoint" ? "Wegpunkt" : "Übernachtung"} hinzufügen
          </h3>
          <button onClick={onCancel} className="text-stone hover:text-forest-950 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind === "waypoint" ? "z. B. Quelle beim Wegweiser" : "z. B. Lidernenhütte"}
              className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-forest-950/70 mb-2">Typ</label>
            {kind === "waypoint" ? (
              <div className="grid grid-cols-3 gap-2">
                {WAYPOINT_TYPES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setType(t.key)}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 transition-all ${
                      type === t.key ? "border-forest-700 bg-forest-100" : "border-forest-950/[0.08] hover:border-forest-950/20"
                    }`}
                  >
                    <t.icon className={`w-4 h-4 ${type === t.key ? "text-forest-700" : "text-forest-950/40"}`} />
                    <span className={`text-[10px] font-medium ${type === t.key ? "text-forest-700" : "text-forest-950/60"}`}>{t.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30"
              >
                {OVERNIGHT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Notizen (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={kind === "waypoint" ? "z. B. nur bei Tageslicht erreichbar" : "z. B. Reservierung bestätigt"}
              className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-5">
          <button
            onClick={() => onSave({ name, type, notes })}
            className="flex-1 rounded-xl bg-forest-700 text-white py-2.5 text-sm font-semibold hover:bg-forest-600 transition-colors"
          >
            Speichern
          </button>
          <button onClick={onCancel} className="rounded-xl border border-forest-950/15 text-forest-950/70 px-4 py-2.5 text-sm font-medium hover:border-forest-950/30 transition-colors">
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
