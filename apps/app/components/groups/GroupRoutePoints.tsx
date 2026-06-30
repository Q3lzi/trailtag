"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { distanceAlongRoute } from "@/lib/routeDistance";
import { Flag, Droplets, Mountain, AlertTriangle, Coffee, MapPin, Trash2, Navigation } from "lucide-react";

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
 * Shows what was actually placed on the map with full context AND a way
 * back to it — clicking an entry flies the map to that exact point and
 * opens its popup. A list disconnected from the map is just text; this is
 * what makes it part of actually planning the route, not just decoration.
 * Entries are numbered to match the numbered markers on the map.
 */
export default function GroupRoutePoints({
  groupId,
  waypoints,
  overnightStops,
  routePoints,
  currentUserId,
  isOrganizer,
  onChange,
  onJumpToMap,
}: {
  groupId: string;
  waypoints: any[];
  overnightStops: any[];
  routePoints: { lat: number; lng: number }[];
  currentUserId?: string;
  isOrganizer: boolean;
  onChange: (patch: { waypoints?: any[]; overnightStops?: any[] }) => void;
  onJumpToMap: (lat: number, lng: number) => void;
}) {
  const [removing, setRemoving] = useState<string | null>(null);

  async function removeWaypoint(e: React.MouseEvent, id: string) {
    e.stopPropagation();
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

  async function removeOvernight(e: React.MouseEvent, id: string) {
    e.stopPropagation();
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
      <h3 className="font-display font-semibold text-sm text-forest-950 mb-1">Wegpunkte & Übernachtungen</h3>
      <p className="text-xs text-stone mb-4">Klick auf einen Eintrag, um ihn auf der Karte zu zeigen.</p>

      {overnightStops.length > 0 && (
        <div className="space-y-2.5 mb-4">
          {overnightStops
            .sort((a, b) => (a.night ?? 0) - (b.night ?? 0))
            .map((stop: any) => {
              const canRemove = stop.addedBy === currentUserId || isOrganizer;
              const lat = stop.lat != null ? Number(stop.lat) : null;
              const lng = stop.lng != null ? Number(stop.lng) : null;
              return (
                <div
                  key={stop.id ?? stop.name}
                  onClick={() => lat && lng && onJumpToMap(lat, lng)}
                  className="group flex items-start gap-3 rounded-xl bg-forest-100/40 hover:bg-forest-100/70 p-3 cursor-pointer transition-colors"
                >
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-forest-950 text-white text-[10px] font-bold shrink-0 mt-0.5">N{stop.night}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-forest-950 truncate">{stop.name}</p>
                    <p className="text-xs text-stone">{OVERNIGHT_LABELS[stop.type] ?? stop.type}{stop.addedByName ? ` · ${stop.addedByName}` : ""}</p>
                    {stop.notes && <p className="text-xs text-forest-950/60 mt-0.5">{stop.notes}</p>}
                  </div>
                  <Navigation className="w-3.5 h-3.5 text-forest-950/0 group-hover:text-forest-700/60 transition-colors shrink-0 mt-1" />
                  {canRemove && stop.id && (
                    <button
                      onClick={(e) => removeOvernight(e, stop.id)}
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
          {waypoints.map((wp: any, i: number) => {
            const Icon = WAYPOINT_ICONS[wp.type] ?? MapPin;
            const canRemove = wp.addedBy === currentUserId || isOrganizer;
            const lat = wp.lat != null ? Number(wp.lat) : null;
            const lng = wp.lng != null ? Number(wp.lng) : null;
            const km = lat && lng && routePoints.length > 1 ? distanceAlongRoute({ lat, lng }, routePoints) : null;
            return (
              <div
                key={wp.id ?? wp.name}
                onClick={() => lat && lng && onJumpToMap(lat, lng)}
                className="group flex items-start gap-3 rounded-xl bg-forest-100/40 hover:bg-forest-100/70 p-3 cursor-pointer transition-colors"
              >
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-600 text-white text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                <Icon className="w-4 h-4 text-amber-600 shrink-0 mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-forest-950 truncate">{wp.name}</p>
                    {km != null && <span className="text-[11px] text-forest-700 font-semibold shrink-0">bei km {km}</span>}
                  </div>
                  <p className="text-xs text-stone">{WAYPOINT_LABELS[wp.type] ?? "Wegpunkt"}{wp.addedByName ? ` · ${wp.addedByName}` : ""}</p>
                  {wp.notes && <p className="text-xs text-forest-950/60 mt-0.5">{wp.notes}</p>}
                </div>
                <Navigation className="w-3.5 h-3.5 text-forest-950/0 group-hover:text-forest-700/60 transition-colors shrink-0 mt-1" />
                {canRemove && wp.id && (
                  <button
                    onClick={(e) => removeWaypoint(e, wp.id)}
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
