"use client";

import { useRouter } from "next/navigation";
import { useWeather } from "@/lib/useWeather";
import { weatherCodeInfo, thunderstormRisk, uvRiskLabel, heatRiskLabel, AVALANCHE_LABELS } from "./types";
import { AlertTriangle, ChevronRight } from "lucide-react";

/**
 * Compact weather tile matching the dashboard's existing small-box pattern
 * (rounded-2xl bg-white border shadow-card) — sits inline with the other
 * stat cards instead of towering over them. Shows current temperature and,
 * if anything is concerning, the single most urgent warning; tapping opens
 * the full weather detail page for everything else (hourly trend, days
 * ahead, all metrics, avalanche bulletin link).
 */
export default function WeatherSummaryCard({
  lat,
  lng,
  activity,
  detailHref,
}: {
  lat: number | null | undefined;
  lng: number | null | undefined;
  activity?: string;
  /** Where tapping the card navigates — caller decides since dashboard vs.
   *  tour-detail need different routes (generic vs. tour-specific). */
  detailHref: string;
}) {
  const router = useRouter();
  const { data, loading, error } = useWeather(lat, lng, activity);

  if (lat == null || lng == null) return null;

  if (loading || error || !data) {
    return (
      <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-4">
        <div className="text-xs text-stone mb-1.5">Wetter</div>
        <div className="text-sm text-stone">{loading ? "Lädt…" : "Nicht verfügbar"}</div>
      </div>
    );
  }

  const { weather, avalanche } = data;
  const cur = weather.current;
  const info = weatherCodeInfo(cur.weather_code);
  const storm = thunderstormRisk(Math.max(...weather.hourly.cape.slice(0, 12)));
  const uv = uvRiskLabel(weather.daily.uv_index_max[0] ?? cur.uv_index);
  const heat = heatRiskLabel(weather.daily.temperature_2m_max[0] ?? cur.temperature_2m);

  // Pick just the single most urgent thing to show — the compact card has
  // room for one signal, not a list; severity order: danger > warn.
  type Warning = { text: string; danger: boolean };
  const candidates: Warning[] = [];
  if (storm.level === "high") candidates.push({ text: "Hohes Gewitterrisiko", danger: true });
  else if (storm.level === "moderate") candidates.push({ text: "Gewitterrisiko möglich", danger: false });
  if (cur.wind_gusts_10m >= 60) candidates.push({ text: `Sturmböen ${Math.round(cur.wind_gusts_10m)} km/h`, danger: true });
  else if (cur.wind_gusts_10m >= 40) candidates.push({ text: `Starke Böen ${Math.round(cur.wind_gusts_10m)} km/h`, danger: false });
  if (heat?.label === "Starke Hitze") candidates.push({ text: "Starke Hitze", danger: true });
  else if (heat?.label === "Hitze") candidates.push({ text: "Hitze", danger: false });
  if (uv.label === "Extrem") candidates.push({ text: "UV extrem", danger: true });
  else if (uv.isWarning) candidates.push({ text: `UV ${uv.label.toLowerCase()}`, danger: false });
  if (avalanche?.maxDangerLevel && avalanche.maxDangerLevel >= 3) {
    candidates.push({ text: `Lawine Stufe ${avalanche.maxDangerLevel}`, danger: avalanche.maxDangerLevel >= 4 });
  }
  const topWarning = candidates.sort((a, b) => Number(b.danger) - Number(a.danger))[0];

  return (
    <button
      onClick={() => router.push(detailHref)}
      className={`text-left w-full rounded-2xl border shadow-card p-4 transition-shadow hover:shadow-card-hover ${
        topWarning?.danger ? "bg-alarm-50 border-alarm-100" : "bg-white border-forest-950/[0.06]"
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-stone">Wetter</span>
        <ChevronRight className="w-3 h-3 text-forest-950/30" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xl leading-none">{info.emoji}</span>
        <span className="font-display text-lg font-semibold text-forest-950">{Math.round(cur.temperature_2m)}°C</span>
      </div>
      {topWarning && (
        <div className={`flex items-center gap-1 mt-1.5 text-[11px] font-semibold ${topWarning.danger ? "text-alarm" : "text-amber-700"}`}>
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span className="truncate">{topWarning.text}</span>
        </div>
      )}
    </button>
  );
}
