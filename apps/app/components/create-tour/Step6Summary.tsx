"use client";

import { ACTIVITIES, TourFormState } from "./types";
import { Clock, Car, Users, MapPin, FileText } from "lucide-react";
import LicensePlate from "@/components/LicensePlate";

export default function Step6Summary({
  form,
  vehicles,
}: {
  form: TourFormState;
  vehicles: any[];
}) {
  const activityDef = ACTIVITIES.find((a) => a.key === form.activity);
  const vehicle = vehicles.find((v) => v.id === form.vehicleId);
  const totalPersons = form.companions.length + 1;

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold text-forest-950 mb-1.5">Alles bereit?</h2>
      <p className="text-stone text-sm mb-7">Prüfe die Angaben — danach kannst du die Tour starten.</p>

      <div className="rounded-2xl bg-forest-950 p-6 mb-5 relative overflow-hidden">
        <h3 className="font-display text-xl font-semibold text-white mb-1">
          {activityDef?.emoji ?? "🏔️"} {form.routeName || activityDef?.label || "Tour"}
        </h3>
        <p className="text-white/55 text-sm">{activityDef?.label}</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-xl bg-white border border-forest-950/[0.06] p-4">
          <Clock className="w-4 h-4 text-forest-700 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-forest-950">
              {form.startDateTime.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" })}{" "}
              {form.startDateTime.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })} Uhr
            </p>
            <p className="text-stone">
              Rückkehr bis {form.etaDateTime.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" })}{" "}
              {form.etaDateTime.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })} Uhr
              {form.multiDay && ` · ${form.returnDays} Tage`}
            </p>
          </div>
        </div>

        {vehicle && (
          <div className="flex items-center gap-3 rounded-xl bg-white border border-forest-950/[0.06] p-4">
            <Car className="w-4 h-4 text-forest-700 shrink-0" />
            <LicensePlate text={vehicle.plate} size="sm" />
          </div>
        )}

        <div className="flex items-center gap-3 rounded-xl bg-white border border-forest-950/[0.06] p-4">
          <Users className="w-4 h-4 text-forest-700 shrink-0" />
          <p className="text-sm text-forest-950">
            <span className="font-semibold">{totalPersons}</span>{" "}
            {totalPersons === 1 ? "Person" : `Personen (ich + ${form.companions.length})`}
          </p>
        </div>

        {(form.distanceKm || form.elevationUp) && (
          <div className="flex items-center gap-3 rounded-xl bg-white border border-forest-950/[0.06] p-4">
            <MapPin className="w-4 h-4 text-forest-700 shrink-0" />
            <p className="text-sm text-forest-950">
              {form.distanceKm && `${form.distanceKm} km`}
              {form.distanceKm && form.elevationUp && " · "}
              {form.elevationUp && `${form.elevationUp} hm`}
            </p>
          </div>
        )}

        {form.notes && (
          <div className="flex items-start gap-3 rounded-xl bg-white border border-forest-950/[0.06] p-4">
            <FileText className="w-4 h-4 text-forest-700 mt-0.5 shrink-0" />
            <p className="text-sm text-forest-950/80">{form.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
