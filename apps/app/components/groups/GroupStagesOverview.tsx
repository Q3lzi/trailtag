"use client";

import { useWeather } from "@/lib/useWeather";
import { weatherCodeInfo } from "@/components/weather/types";
import { Calendar, MapPin } from "lucide-react";

const OVERNIGHT_LABELS: Record<string, string> = {
  huette: "SAC Hütte", berghuette: "Berghütte", hotel: "Hotel/B&B",
  zelt: "Zelt/Biwak", camping: "Camping", schutz: "Schutzhütte",
};

/**
 * Day-by-day stage overview for multi-day group hikes — combines the
 * planned start date with each overnight stop to answer "where do we sleep
 * on which day, and what's the weather there" in one place, instead of
 * making someone cross-reference a date field with a separate stops list.
 */
export default function GroupStagesOverview({
  startAt,
  overnightStops,
  activity,
}: {
  startAt: string | Date | null;
  overnightStops: any[];
  activity?: string;
}) {
  if (!startAt || overnightStops.length === 0) return null;

  const start = new Date(startAt);
  const sorted = [...overnightStops].sort((a, b) => (a.night ?? 0) - (b.night ?? 0));
  const totalDays = sorted.length + 1;

  return (
    <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-6">
      <h3 className="font-display font-semibold text-sm text-forest-950 mb-1 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-forest-700" /> Etappenplan · {totalDays} Tage
      </h3>
      <p className="text-xs text-stone mb-4">Übernachtungsort und Wetter für jeden Tag der Tour.</p>

      <div className="space-y-3">
        {/* Day 1: start day, no overnight (that's the night AFTER day 1) */}
        <StageRow
          dayLabel={`Tag 1 · ${fmtDate(start)}`}
          destination="Start der Tour"
          lat={null}
          lng={null}
          activity={activity}
          dayOffset={0}
          baseDate={start}
        />
        {sorted.map((stop, i) => (
          <StageRow
            key={stop.id ?? i}
            dayLabel={`Tag ${i + 2} · ${fmtDate(addDays(start, i + 1))}`}
            destination={stop.name || OVERNIGHT_LABELS[stop.type] || "Übernachtung"}
            sub={OVERNIGHT_LABELS[stop.type]}
            lat={stop.lat != null ? Number(stop.lat) : null}
            lng={stop.lng != null ? Number(stop.lng) : null}
            activity={activity}
            dayOffset={i + 1}
            baseDate={start}
          />
        ))}
      </div>
    </div>
  );
}

function StageRow({
  dayLabel, destination, sub, lat, lng, activity, dayOffset, baseDate,
}: {
  dayLabel: string; destination: string; sub?: string;
  lat: number | null; lng: number | null; activity?: string;
  dayOffset: number; baseDate: Date;
}) {
  const { data, loading } = useWeather(lat, lng, activity);
  const dayDate = addDays(baseDate, dayOffset);
  const dayIdx = data?.weather?.daily?.time?.findIndex((t: string) => isSameDay(new Date(t), dayDate)) ?? -1;
  const hasForecast = dayIdx >= 0;

  return (
    <div className="flex items-center gap-3 rounded-xl bg-forest-100/40 p-3.5">
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-forest-700 uppercase tracking-wide">{dayLabel}</p>
        <p className="text-sm font-medium text-forest-950 flex items-center gap-1.5">
          <MapPin className="w-3 h-3 text-stone shrink-0" /> {destination}
        </p>
        {sub && <p className="text-xs text-stone">{sub}</p>}
      </div>
      {lat && lng && (
        <div className="shrink-0 text-right">
          {loading ? (
            <span className="text-xs text-stone">…</span>
          ) : hasForecast ? (
            <div className="flex items-center gap-1.5">
              <span className="text-base">{weatherCodeInfo(data.weather.daily.weather_code[dayIdx]).emoji}</span>
              <span className="text-sm font-semibold text-forest-950 font-display">
                {Math.round(data.weather.daily.temperature_2m_max[dayIdx])}°
                <span className="text-stone font-normal">/{Math.round(data.weather.daily.temperature_2m_min[dayIdx])}°</span>
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-stone">Ausserhalb der Vorhersage</span>
          )}
        </div>
      )}
    </div>
  );
}

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
