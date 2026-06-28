"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

type TimelineEntry = {
  kind: "checkout" | "eta" | "last" | "point" | "start";
  label: string;
  time: string;
  desc?: string;
  lat?: number | null;
  lng?: number | null;
  dotColor: string;
  isUrgent?: boolean;
};

/**
 * Chronological GPS history, mirroring the mobile app's "Live Tracking Log" —
 * every reported point, newest first, each one jumping the map to that spot
 * when clicked. This is what lets an observer tell "still on track" from
 * "last seen somewhere unexpected an hour ago" at a glance.
 */
export default function TrackingTimeline({
  tour,
  onJumpToMap,
}: {
  tour: any;
  onJumpToMap: (lat: number, lng: number) => void;
}) {
  const [showAll, setShowAll] = useState(false);

  const isOverdue = tour.eta && new Date(tour.eta).getTime() < Date.now() && tour.status !== "COMPLETED";
  const minutesSinceUpdate = tour.locationUpdatedAt
    ? Math.floor((Date.now() - new Date(tour.locationUpdatedAt).getTime()) / 60000)
    : null;

  const entries: TimelineEntry[] = [];

  if (tour.checkedOutAt) {
    entries.push({
      kind: "checkout",
      label: "Ausgecheckt ✓",
      time: fmtTime(tour.checkedOutAt),
      dotColor: "#2c694e",
    });
  }

  if (tour.eta) {
    entries.push({
      kind: "eta",
      label: "Geplante Rückkehr",
      time: fmtDateTime(tour.eta),
      dotColor: isOverdue ? "#ba1a1a" : "#2c694e",
      isUrgent: isOverdue,
    });
  }

  if (tour.locationUpdatedAt && tour.lastLat && tour.lastLng) {
    entries.push({
      kind: "last",
      label: "Letzter Standort",
      time: fmtTime(tour.locationUpdatedAt),
      desc:
        minutesSinceUpdate != null
          ? `vor ${minutesSinceUpdate} Min` + (minutesSinceUpdate > 30 ? " — möglicherweise kein Signal" : " — aktuell")
          : undefined,
      lat: tour.lastLat,
      lng: tour.lastLng,
      dotColor: "#f59e0b",
    });
  }

  const gpsPoints = [...(tour.locations ?? [])].reverse(); // newest first
  const shownPoints = showAll ? gpsPoints : gpsPoints.slice(0, 3);

  if (tour.startedAt) {
    entries.push({
      kind: "start",
      label: "Start",
      time: fmtTime(tour.startedAt),
      desc: tour.parkingLocation || undefined,
      lat: tour.startLat,
      lng: tour.startLng,
      dotColor: "#2c694e",
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-forest-950/[0.06] shadow-card p-6">
      <h3 className="font-display font-semibold text-sm text-forest-950 mb-4">Live Tracking Log</h3>

      <div className="space-y-0">
        {entries.slice(0, entries.length > 1 && entries[1].kind === "eta" ? 2 : 1).map((entry, i) => (
          <TimelineRow key={i} entry={entry} onJumpToMap={onJumpToMap} isLast={false} />
        ))}

        {entries.slice(2).filter((e) => e.kind === "last").map((entry, i) => (
          <TimelineRow key={`last-${i}`} entry={entry} onJumpToMap={onJumpToMap} isLast={false} />
        ))}

        {shownPoints.map((loc: any, idx: number) => (
          <TimelineRow
            key={loc.id ?? idx}
            entry={{
              kind: "point",
              label: "GPS-Punkt",
              time: fmtTime(loc.timestamp, true),
              desc: [
                loc.ele ? `⛰ ${Math.round(loc.ele)} m` : null,
                `${loc.lat?.toFixed(4)}, ${loc.lng?.toFixed(4)}`,
                loc.accuracy ? `±${Math.round(loc.accuracy)} m` : null,
              ].filter(Boolean).join(" · "),
              lat: loc.lat,
              lng: loc.lng,
              dotColor: "#f59e0b",
              isUrgent: loc.accuracy > 100,
            }}
            onJumpToMap={onJumpToMap}
            isLast={false}
            small
          />
        ))}

        {gpsPoints.length > 3 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-forest-700 font-medium hover:underline py-2"
          >
            {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showAll ? "Weniger anzeigen" : `Alle ${gpsPoints.length} GPS-Punkte anzeigen`}
          </button>
        )}

        {entries.filter((e) => e.kind === "start").map((entry, i) => (
          <TimelineRow key={`start-${i}`} entry={entry} onJumpToMap={onJumpToMap} isLast />
        ))}
      </div>
    </div>
  );
}

function TimelineRow({
  entry,
  onJumpToMap,
  isLast,
  small,
}: {
  entry: TimelineEntry;
  onJumpToMap: (lat: number, lng: number) => void;
  isLast: boolean;
  small?: boolean;
}) {
  const clickable = entry.lat != null && entry.lng != null;
  return (
    <div
      onClick={() => clickable && onJumpToMap(entry.lat!, entry.lng!)}
      className={`flex gap-3 ${clickable ? "cursor-pointer group" : ""}`}
    >
      <div className="flex flex-col items-center shrink-0 pt-1">
        <span
          className="rounded-full"
          style={{ width: small ? 6 : 9, height: small ? 6 : 9, background: entry.dotColor }}
        />
        {!isLast && <span className="w-px flex-1 bg-forest-950/[0.08] my-1" style={{ minHeight: small ? 16 : 22 }} />}
      </div>
      <div className={`flex-1 pb-3 ${small ? "pb-2.5" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[11px] font-bold uppercase tracking-wide ${entry.isUrgent ? "text-alarm" : small ? "text-stone" : "text-forest-950/70"}`}>
            {entry.label}
          </span>
          <span className={`text-xs ${entry.isUrgent ? "text-alarm font-bold" : "text-stone"}`}>{entry.time}</span>
        </div>
        {entry.desc && <p className="text-xs text-forest-950/55 mt-0.5">{entry.desc}</p>}
        {clickable && (
          <span className="text-[11px] text-forest-700 group-hover:underline">↗ Auf Karte zeigen</span>
        )}
      </div>
    </div>
  );
}

function fmtTime(d: string, withSeconds = false) {
  return new Date(d).toLocaleTimeString("de-CH", {
    hour: "2-digit", minute: "2-digit", ...(withSeconds ? { second: "2-digit" } : {}),
  });
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("de-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
