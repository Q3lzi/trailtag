"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { distanceAlongRoute } from "@/lib/routeDistance";
import { useWeather } from "@/lib/useWeather";
import { weatherCodeInfo } from "@/components/weather/types";
import {
  Flag, Droplets, Mountain, AlertTriangle, Coffee, MapPin, Trash2, Navigation, Moon,
} from "lucide-react";

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

function addDays(d: Date, days: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmtDate(d: Date) {
  return d.toLocaleDateString("de-CH", { weekday: "short", day: "2-digit", month: "2-digit" });
}

/**
 * The route as one connected story instead of two disconnected lists: a
 * vertical timeline where each day gets a marker (with its destination and
 * that day's actual weather), and the waypoints for that day nest directly
 * underneath it. Someone reading this should understand the whole plan
 * without cross-referencing a separate stages table against a separate
 * waypoints table.
 */
export default function RouteTimeline({
  groupId,
  startAt,
  overnightStops,
  waypoints,
  routePoints,
  activity,
  currentUserId,
  isOrganizer,
  onChange,
  onJumpToMap,
}: {
  groupId: string;
  startAt: string | Date | null;
  overnightStops: any[];
  waypoints: any[];
  routePoints: { lat: number; lng: number }[];
  activity?: string;
  currentUserId?: string;
  isOrganizer: boolean;
  onChange: (patch: { waypoints?: any[]; overnightStops?: any[] }) => void;
  onJumpToMap: (lat: number, lng: number) => void;
}) {
  const [removing, setRemoving] = useState<string | null>(null);
  const sortedStops = [...overnightStops].sort((a, b) => (a.night ?? 0) - (b.night ?? 0));
  const totalDays = sortedStops.length + 1;
  const start = startAt ? new Date(startAt) : null;

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

  // Group waypoints by their assigned day; unassigned ones (no day field,
  // e.g. from a single-day tour) show under day 1.
  function waypointsForDay(day: number) {
    return waypoints
      .map((wp, i) => ({ ...wp, _globalIndex: i }))
      .filter((wp) => (wp.day ?? 1) === day);
  }

  return (
    <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-6">
      <h3 className="font-display font-semibold text-forest-950 mb-1">Routenverlauf</h3>
      <p className="text-xs text-stone mb-5">Klick auf einen Punkt, um ihn auf der Karte zu zeigen.</p>

      <div className="relative">
        {/* Connecting line */}
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-forest-950/10" />

        {Array.from({ length: totalDays }, (_, dayIdx) => {
          const day = dayIdx + 1;
          const stop = sortedStops[dayIdx]; // the overnight AFTER this day, if any
          const dayWaypoints = totalDays > 1 ? waypointsForDay(day) : waypoints.map((wp, i) => ({ ...wp, _globalIndex: i }));
          const dayDate = start ? addDays(start, dayIdx) : null;

          return (
            <div key={day} className="mb-2 last:mb-0">
              {totalDays > 1 && (
                <div className="relative flex items-center gap-3 mb-3">
                  <span className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-forest-950 text-white text-xs font-bold shrink-0">
                    {day}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-forest-950">
                      Tag {day}{dayDate && ` · ${fmtDate(dayDate)}`}
                    </p>
                    {stop && <p className="text-xs text-stone">Ziel: {stop.name} ({OVERNIGHT_LABELS[stop.type] ?? stop.type})</p>}
                  </div>
                </div>
              )}

              <div className={totalDays > 1 ? "pl-11 space-y-2 mb-4" : "space-y-2 mb-4"}>
                {dayWaypoints.map((wp: any) => {
                  const Icon = WAYPOINT_ICONS[wp.type] ?? MapPin;
                  const canRemove = wp.addedBy === currentUserId || isOrganizer;
                  const lat = wp.lat != null ? Number(wp.lat) : null;
                  const lng = wp.lng != null ? Number(wp.lng) : null;
                  const km = lat && lng && routePoints.length > 1 ? distanceAlongRoute({ lat, lng }, routePoints) : null;
                  return (
                    <div
                      key={wp.id ?? wp._globalIndex}
                      onClick={() => lat && lng && onJumpToMap(lat, lng)}
                      className="group flex items-start gap-3 rounded-xl bg-forest-100/40 hover:bg-forest-100/70 p-3 cursor-pointer transition-colors"
                    >
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-600 text-white text-[10px] font-bold shrink-0 mt-0.5">{wp._globalIndex + 1}</span>
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

              {stop && (
                <OvernightRow
                  stop={stop}
                  activity={activity}
                  dayDate={dayDate}
                  canRemove={stop.addedBy === currentUserId || isOrganizer}
                  removing={removing === stop.id}
                  onRemove={(e) => stop.id && removeOvernight(e, stop.id)}
                  onJumpToMap={onJumpToMap}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OvernightRow({
  stop, activity, dayDate, canRemove, removing, onRemove, onJumpToMap,
}: {
  stop: any; activity?: string; dayDate: Date | null; canRemove: boolean; removing: boolean;
  onRemove: (e: React.MouseEvent) => void; onJumpToMap: (lat: number, lng: number) => void;
}) {
  const lat = stop.lat != null ? Number(stop.lat) : null;
  const lng = stop.lng != null ? Number(stop.lng) : null;
  const { data } = useWeather(lat, lng, activity);
  const dayIdx = dayDate && data?.weather?.daily?.time?.findIndex((t: string) => isSameDay(new Date(t), dayDate));
  const hasForecast = dayIdx != null && dayIdx >= 0;

  return (
    <div
      onClick={() => lat && lng && onJumpToMap(lat, lng)}
      className="relative flex items-center gap-3 rounded-xl bg-forest-950 p-3.5 cursor-pointer hover:bg-forest-950/90 transition-colors"
    >
      <span className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-white/15 text-white shrink-0">
        <Moon className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{stop.name}</p>
        <p className="text-xs text-white/60">{OVERNIGHT_LABELS[stop.type] ?? stop.type}{stop.addedByName ? ` · ${stop.addedByName}` : ""}</p>
        {stop.notes && <p className="text-xs text-white/50 mt-0.5">{stop.notes}</p>}
      </div>
      {hasForecast && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-base">{weatherCodeInfo(data.weather.daily.weather_code[dayIdx]).emoji}</span>
          <span className="text-sm font-semibold text-white font-display">
            {Math.round(data.weather.daily.temperature_2m_max[dayIdx])}°
          </span>
        </div>
      )}
      {canRemove && stop.id && (
        <button onClick={onRemove} disabled={removing} className="text-white/40 hover:text-alarm transition-colors shrink-0 disabled:opacity-40">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
