"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Flag, Droplets, Mountain, AlertTriangle, Coffee, MapPin, Moon, Trash2 } from "lucide-react";

const WAYPOINT_ICONS: Record<string, any> = {
  meeting: Flag, water: Droplets, viewpoint: Mountain, hazard: AlertTriangle, rest: Coffee, other: MapPin,
};
const WAYPOINT_LABELS: Record<string, string> = {
  meeting: "Treffpunkt", water: "Wasserstelle", viewpoint: "Aussichtspunkt",
  hazard: "Gefahrenstelle", rest: "Pausenplatz", other: "Wegpunkt",
};
const OVERNIGHT_LABELS: Record<string, string> = {
  huette: "SAC Hütte", berghuette: "Berghütte", hotel: "Hotel/B&B",
  zelt: "Zelt/Biwak", camping: "Camping", schutz: "Schutzhütte",
};

/**
 * Shows what was actually placed on the map with its full context — a list
 * of dots on a map tells no one anything; "Wasserstelle bei km 8, ergiebig
 * im Sommer — von Tamara" does, and lets people remove their own entries.
 */
export default function GroupRoutePoints({
  groupId,
  waypoints,
  overnightStops,
  currentUserId,
  isOrganizer,
  onChange,
}: {
  groupId: string;
  waypoints: any[];
  overnightStops: any[];
  currentUserId?: string;
  isOrganizer: boolean;
  onChange: (patch: { waypoints?: any[]; overnightStops?: any[] }) => void;
}) {
  const [removing, setRemoving] = useState<string | null>(null);

  async function removeWaypoint(id: string) {
    setRemoving(id);
    try {
      const token = getToken();
      const updated = await apiFetch(`/tour-groups/${groupId}/waypoints/${id}`, { method: "DELETE" }, token ?? undefined);
      onChange({ waypoints: updated.waypoints });
    } catch {
    } finally {
      setRemoving(null);
    }
  }

  async function removeOvernight(id: string) {
    setRemoving(id);
    try {
      const token = getToken();
      const updated = await apiFetch(`/tour-groups/${groupId}/overnight-stops/${id}`, { method: "DELETE" }, token ?? undefined);
      onChange({ overnightStops: updated.overnightStops });
    } catch {
    } finally {
      setRemoving(null);
    }
  }

  if (waypoints.length === 0 && overnightStops.length === 0) return null;

  return (
    <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-6">
      <h3 className="font-display font-semibold text-sm text-forest-950 mb-4">Wegpunkte & Übernachtungen</h3>

      {overnightStops.length > 0 && (
        <div className="space-y-2.5 mb-4">
          {overnightStops
            .sort((a, b) => (a.night ?? 0) - (b.night ?? 0))
            .map((stop: any) => {
              const canRemove = stop.addedBy === currentUserId || isOrganizer;
              return (
                <div key={stop.id ?? stop.name} className="flex items-start gap-3 rounded-xl bg-forest-100/40 p-3">
                  <span className="text-base shrink-0 mt-0.5">🌙</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-forest-700 shrink-0">Nacht {stop.night}</span>
                      <p className="text-sm font-medium text-forest-950 truncate">{stop.name}</p>
                    </div>
                    <p className="text-xs text-stone">{OVERNIGHT_LABELS[stop.type] ?? stop.type}{stop.addedByName ? ` · ${stop.addedByName}` : ""}</p>
                    {stop.notes && <p className="text-xs text-forest-950/60 mt-0.5">{stop.notes}</p>}
                  </div>
                  {canRemove && stop.id && (
                    <button
                      onClick={() => removeOvernight(stop.id)}
                      disabled={removing === stop.id}
                      className="text-stone hover:text-alarm transition-colors shrink-0 disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {waypoints.length > 0 && (
        <div className="space-y-2.5">
          {waypoints.map((wp: any) => {
            const Icon = WAYPOINT_ICONS[wp.type] ?? MapPin;
            const canRemove = wp.addedBy === currentUserId || isOrganizer;
            return (
              <div key={wp.id ?? wp.name} className="flex items-start gap-3 rounded-xl bg-forest-100/40 p-3">
                <Icon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-forest-950 truncate">{wp.name}</p>
                  <p className="text-xs text-stone">{WAYPOINT_LABELS[wp.type] ?? "Wegpunkt"}{wp.addedByName ? ` · ${wp.addedByName}` : ""}</p>
                  {wp.notes && <p className="text-xs text-forest-950/60 mt-0.5">{wp.notes}</p>}
                </div>
                {canRemove && wp.id && (
                  <button
                    onClick={() => removeWaypoint(wp.id)}
                    disabled={removing === wp.id}
                    className="text-stone hover:text-alarm transition-colors shrink-0 disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
