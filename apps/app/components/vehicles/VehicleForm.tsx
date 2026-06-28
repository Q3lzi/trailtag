"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { X } from "lucide-react";

export default function VehicleForm({
  vehicle,
  onSaved,
  onCancel,
}: {
  vehicle?: any; // undefined = creating a new vehicle, present = editing
  onSaved: (vehicle: any) => void;
  onCancel: () => void;
}) {
  const [plate, setPlate] = useState(vehicle?.plate ?? "");
  const [make, setMake] = useState(vehicle?.make ?? "");
  const [model, setModel] = useState(vehicle?.model ?? "");
  const [color, setColor] = useState(vehicle?.color ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!plate.trim()) {
      setError("Das Kennzeichen ist erforderlich.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const token = getToken();
      const body = JSON.stringify({ plate: plate.trim(), make: make.trim() || null, model: model.trim() || null, color: color.trim() || null });
      const result = vehicle
        ? await apiFetch(`/vehicles/${vehicle.id}`, { method: "PUT", body }, token ?? undefined)
        : await apiFetch("/vehicles", { method: "POST", body }, token ?? undefined);
      onSaved(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-forest-950/[0.08] shadow-card p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display font-semibold text-sm text-forest-950">
          {vehicle ? "Fahrzeug bearbeiten" : "Neues Fahrzeug"}
        </h3>
        <button onClick={onCancel} className="text-stone hover:text-forest-950 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {error && <div className="bg-alarm-50 border border-alarm-100 text-alarm text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}

      <div className="space-y-3.5">
        <div>
          <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Kennzeichen *</label>
          <input
            type="text"
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            placeholder="z. B. SZ 722 05"
            className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm font-mono tracking-wide focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Marke (optional)</label>
            <input
              type="text"
              value={make}
              onChange={(e) => setMake(e.target.value)}
              placeholder="z. B. Audi"
              className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Modell (optional)</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="z. B. Q4"
              className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Farbe (optional)</label>
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="z. B. Schwarz"
            className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-5">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 rounded-xl bg-forest-700 text-white py-2.5 text-sm font-semibold hover:bg-forest-600 transition-colors disabled:opacity-60"
        >
          {saving ? "Speichert…" : "Speichern"}
        </button>
        <button onClick={onCancel} className="rounded-xl border border-forest-950/15 text-forest-950/70 px-4 py-2.5 text-sm font-medium hover:border-forest-950/30 transition-colors">
          Abbrechen
        </button>
      </div>
    </div>
  );
}
