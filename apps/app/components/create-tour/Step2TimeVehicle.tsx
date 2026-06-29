"use client";

import { TourFormState } from "./types";
import { Car, Plus, Sunrise, Clock3 } from "lucide-react";
import LicensePlate from "@/components/LicensePlate";

// Use local date/time components throughout — toISOString() converts to
// UTC and silently shifts the date by a day depending on timezone/hour,
// which made the date input appear to "reset" on every keystroke.
function toDateInputValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function toTimeInputValue(d: Date) {
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}
function mergeDateTime(dateStr: string, timeStr: string, fallback: Date) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  const next = new Date(fallback);
  if (y && m && d) next.setFullYear(y, m - 1, d);
  if (!isNaN(h) && !isNaN(min)) next.setHours(h, min, 0, 0);
  return next;
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function addDays(d: Date, days: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}
function roundToNext15Min(d: Date) {
  const next = new Date(d);
  const mins = next.getMinutes();
  next.setMinutes(Math.ceil(mins / 15) * 15, 0, 0);
  return next;
}

export default function Step2TimeVehicle({
  form,
  update,
  vehicles,
  onAddVehicle,
}: {
  form: TourFormState;
  update: (patch: Partial<TourFormState>) => void;
  vehicles: any[];
  onAddVehicle: () => void;
}) {
  const now = new Date();
  const startsToday = isSameDay(form.startDateTime, now);
  const startsInFuture = !startsToday && form.startDateTime.getTime() > now.getTime();
  const startsInPast = !startsToday && form.startDateTime.getTime() < now.getTime();

  function setStartNow() {
    const rounded = roundToNext15Min(now);
    const hoursAhead = 6; // sensible default planning horizon for a day hike
    const newEta = new Date(rounded.getTime() + hoursAhead * 60 * 60 * 1000);
    update({ startDateTime: rounded, etaDateTime: alignEtaDate(newEta, rounded, form.multiDay, form.returnDays) });
  }

  function handleStartChange(next: Date) {
    // Keep the return time's time-of-day, but re-anchor its date relative
    // to the new start date — this is what makes "1 night" mean "the day
    // after start" automatically instead of needing manual sync.
    const newEta = alignEtaDate(form.etaDateTime, next, form.multiDay, form.returnDays);
    update({ startDateTime: next, etaDateTime: newEta });
  }

  function alignEtaDate(eta: Date, start: Date, multiDay: boolean, days: number) {
    const offsetDays = multiDay ? Math.max(1, days - 1) : 0;
    const targetDate = addDays(start, offsetDays);
    const aligned = new Date(targetDate);
    aligned.setHours(eta.getHours(), eta.getMinutes(), 0, 0);
    return aligned;
  }

  function handleMultiDayToggle(checked: boolean) {
    const days = checked ? Math.max(2, form.returnDays) : 1;
    update({ multiDay: checked, returnDays: days, etaDateTime: alignEtaDate(form.etaDateTime, form.startDateTime, checked, days) });
  }

  function handleReturnDaysChange(days: number) {
    const clamped = Math.max(2, Math.min(14, days || 2));
    update({ returnDays: clamped, etaDateTime: alignEtaDate(form.etaDateTime, form.startDateTime, true, clamped) });
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold text-forest-950 mb-1.5">Wann und mit was?</h2>
      <p className="text-stone text-sm mb-7">
        Die Rückkehrzeit ist dein Sicherheits-Timer — wenn du sie verpasst, eskaliert das System automatisch.
      </p>

      {/* Start */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold text-forest-950/70">Start</label>
          <button
            type="button"
            onClick={setStartNow}
            className="flex items-center gap-1 text-xs text-forest-700 font-medium hover:underline"
          >
            <Sunrise className="w-3 h-3" /> Jetzt
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            value={toDateInputValue(form.startDateTime)}
            onChange={(e) => handleStartChange(mergeDateTime(e.target.value, toTimeInputValue(form.startDateTime), form.startDateTime))}
            className="rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700"
          />
          <input
            type="time"
            value={toTimeInputValue(form.startDateTime)}
            onChange={(e) => handleStartChange(mergeDateTime(toDateInputValue(form.startDateTime), e.target.value, form.startDateTime))}
            className="rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700"
          />
        </div>
        {startsInFuture && (
          <p className="text-xs text-amber-700 mt-1.5 flex items-center gap-1">
            <Clock3 className="w-3 h-3" /> Geplant für die Zukunft — du kannst die Tour erst am Starttag selbst starten, bis dahin als Entwurf speichern.
          </p>
        )}
        {startsInPast && (
          <p className="text-xs text-amber-700 mt-1.5 flex items-center gap-1">
            <Clock3 className="w-3 h-3" /> Startzeit liegt in der Vergangenheit — beim Starten beginnt der Sicherheits-Timer trotzdem erst jetzt.
          </p>
        )}
      </div>

      {/* Multi-day toggle */}
      <label className="flex items-center gap-2.5 mb-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={form.multiDay}
          onChange={(e) => handleMultiDayToggle(e.target.checked)}
          className="w-4 h-4 rounded accent-forest-700"
        />
        <span className="text-sm text-forest-950/80">Mehrtägige Tour mit Übernachtung</span>
      </label>

      {form.multiDay && (
        <div className="mb-3">
          <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Anzahl Tage</label>
          <input
            type="number"
            min={2}
            max={14}
            value={form.returnDays}
            onChange={(e) => handleReturnDaysChange(Number(e.target.value))}
            className="w-24 rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700"
          />
          <p className="text-xs text-stone mt-1.5">
            Das Rückkehrdatum wird automatisch auf {form.returnDays - 1} Tag{form.returnDays - 1 !== 1 ? "e" : ""} nach dem Start gesetzt — Übernachtungen im nächsten Schritt eintragen.
          </p>
        </div>
      )}

      {/* Return */}
      <div className="mb-8">
        <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">
          {form.multiDay ? "Erwartete Rückkehr (letzter Tag)" : "Erwartete Rückkehr"}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            value={toDateInputValue(form.etaDateTime)}
            onChange={(e) => update({ etaDateTime: mergeDateTime(e.target.value, toTimeInputValue(form.etaDateTime), form.etaDateTime) })}
            disabled={form.multiDay}
            className="rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700 disabled:bg-forest-950/[0.03] disabled:text-forest-950/40"
          />
          <input
            type="time"
            value={toTimeInputValue(form.etaDateTime)}
            onChange={(e) => update({ etaDateTime: mergeDateTime(toDateInputValue(form.etaDateTime), e.target.value, form.etaDateTime) })}
            className="rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700"
          />
        </div>
        {form.multiDay && (
          <p className="text-xs text-stone mt-1.5">Das Datum richtet sich nach der Anzahl Tage oben — nur die Uhrzeit ist hier frei wählbar.</p>
        )}
      </div>

      {/* Vehicle */}
      <div>
        <label className="block text-xs font-semibold text-forest-950/70 mb-2">Fahrzeug am Trailhead</label>
        {vehicles.length === 0 ? (
          <button
            type="button"
            onClick={onAddVehicle}
            className="flex items-center gap-2 text-sm text-forest-700 font-medium hover:underline"
          >
            <Plus className="w-4 h-4" /> Fahrzeug hinzufügen
          </button>
        ) : (
          <div className="space-y-2">
            {vehicles.map((v) => {
              const selected = form.vehicleId === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => update({ vehicleId: v.id })}
                  className={`w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all ${
                    selected ? "border-forest-700 bg-forest-100" : "border-forest-950/[0.08] bg-white hover:border-forest-950/20"
                  }`}
                >
                  <div className="flex-1 flex items-center gap-3">
                    <LicensePlate text={v.plate} size="sm" />
                    {(v.make || v.model) && <p className="text-xs text-stone">{v.make} {v.model}</p>}
                  </div>
                </button>
              );
            })}
            <button type="button" onClick={onAddVehicle} className="flex items-center gap-2 text-sm text-forest-700 font-medium hover:underline pt-1">
              <Plus className="w-4 h-4" /> Weiteres Fahrzeug
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
