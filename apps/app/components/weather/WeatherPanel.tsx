"use client";

import { useWeather } from "@/lib/useWeather";
import {
  weatherCodeInfo, thunderstormRisk, uvRiskLabel, AVALANCHE_LABELS,
} from "./types";
import {
  Wind, Droplets, Sun, AlertTriangle, ExternalLink, ThermometerSun, Eye, Mountain,
} from "lucide-react";

/**
 * The single, comprehensive weather context shown both when planning a tour
 * (forecast for the chosen day) and when observing one (current conditions
 * at the last known/start position). Surfaces every alpine-relevant signal
 * at once — temperature, wind, precipitation, UV, thunderstorm risk, and
 * (seasonally) avalanche danger — rather than splitting them across
 * separate widgets, since a quick glance needs to answer "is anything here
 * a problem?" in one look.
 */
export default function WeatherPanel({
  lat,
  lng,
  activity,
  compact = false,
}: {
  lat: number | null | undefined;
  lng: number | null | undefined;
  activity?: string;
  compact?: boolean;
}) {
  const { data, loading, error } = useWeather(lat, lng, activity);

  if (lat == null || lng == null) return null;

  if (loading) {
    return (
      <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-6 animate-pulse">
        <div className="h-4 w-32 bg-forest-950/10 rounded mb-4" />
        <div className="h-16 bg-forest-950/5 rounded" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-5">
        <p className="text-sm text-stone">Wetterdaten momentan nicht verfügbar.</p>
      </div>
    );
  }

  const { weather, avalanche } = data;
  const cur = weather.current;
  const info = weatherCodeInfo(cur.weather_code);
  const storm = thunderstormRisk(Math.max(...weather.hourly.cape.slice(0, 12)));
  const uv = uvRiskLabel(weather.daily.uv_index_max[0] ?? cur.uv_index);
  const freezingLevel = weather.hourly.freezing_level_height[0];

  // Collect active warnings — this list IS the safety summary, shown
  // prominently before the detailed numbers.
  const warnings: { icon: any; text: string; level: "warn" | "danger" }[] = [];
  if (storm.level === "high") warnings.push({ icon: AlertTriangle, text: "Hohes Gewitterrisiko in den nächsten Stunden", level: "danger" });
  else if (storm.level === "moderate") warnings.push({ icon: AlertTriangle, text: "Mässiges Gewitterrisiko möglich", level: "warn" });
  if (cur.wind_gusts_10m >= 60) warnings.push({ icon: Wind, text: `Sturmböen bis ${Math.round(cur.wind_gusts_10m)} km/h`, level: "danger" });
  else if (cur.wind_gusts_10m >= 40) warnings.push({ icon: Wind, text: `Starke Böen bis ${Math.round(cur.wind_gusts_10m)} km/h`, level: "warn" });
  if (uv.label === "Extrem" || uv.label === "Sehr hoch") warnings.push({ icon: Sun, text: `UV-Index ${uv.label.toLowerCase()} — ${uv.advice}`, level: "warn" });
  if (avalanche?.maxDangerLevel && avalanche.maxDangerLevel >= 3) {
    warnings.push({ icon: Mountain, text: `Lawinengefahr ${AVALANCHE_LABELS[avalanche.maxDangerLevel]?.label ?? avalanche.maxDangerLevel}`, level: avalanche.maxDangerLevel >= 4 ? "danger" : "warn" });
  }

  return (
    <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card overflow-hidden">
      {/* Warnings banner — only rendered if something needs attention */}
      {warnings.length > 0 && (
        <div className="bg-alarm-50 border-b border-alarm-100 px-5 py-3 space-y-1.5">
          {warnings.map((w, i) => (
            <div key={i} className={`flex items-center gap-2 text-xs font-semibold ${w.level === "danger" ? "text-alarm" : "text-amber-700"}`}>
              <w.icon className="w-3.5 h-3.5 shrink-0" />
              {w.text}
            </div>
          ))}
        </div>
      )}

      <div className="p-5">
        {/* Current conditions hero */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{info.emoji}</span>
            <div>
              <p className="font-display text-2xl font-semibold text-forest-950">{Math.round(cur.temperature_2m)}°C</p>
              <p className="text-xs text-stone">{info.label} · Gefühlt {Math.round(cur.apparent_temperature)}°C</p>
            </div>
          </div>
          {avalanche?.maxDangerLevel && (
            <a
              href={avalanche.bulletinUrl}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shrink-0"
              style={{
                background: `${AVALANCHE_LABELS[avalanche.maxDangerLevel]?.color}15`,
                color: AVALANCHE_LABELS[avalanche.maxDangerLevel]?.color,
              }}
            >
              <Mountain className="w-3.5 h-3.5" />
              Stufe {avalanche.maxDangerLevel} · {AVALANCHE_LABELS[avalanche.maxDangerLevel]?.label}
            </a>
          )}
        </div>

        {/* Key metrics grid */}
        <div className={`grid ${compact ? "grid-cols-3" : "grid-cols-4"} gap-3`}>
          <Metric icon={Wind} label="Wind" value={`${Math.round(cur.wind_speed_10m)}`} unit="km/h" sub={`Böen ${Math.round(cur.wind_gusts_10m)}`} />
          <Metric icon={Droplets} label="Niederschlag" value={`${weather.daily.precipitation_probability_max[0] ?? 0}`} unit="%" sub={`${weather.daily.precipitation_sum[0]?.toFixed(1) ?? 0} mm`} />
          <Metric icon={Sun} label="UV-Index" value={`${Math.round(weather.daily.uv_index_max[0] ?? cur.uv_index)}`} sub={uv.label} warn={uv.label === "Extrem" || uv.label === "Sehr hoch"} />
          {!compact && (
            <Metric icon={ThermometerSun} label="Nullgradgrenze" value={freezingLevel ? `${Math.round(freezingLevel)}` : "—"} unit="m" />
          )}
        </div>

        {avalanche?.bulletinUrl && !avalanche.maxDangerLevel && (
          <a
            href={avalanche.bulletinUrl}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-forest-700 hover:underline mt-3"
          >
            Lawinenbulletin (SLF) ansehen <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function Metric({
  icon: Icon, label, value, unit, sub, warn,
}: {
  icon: any; label: string; value: string; unit?: string; sub?: string; warn?: boolean;
}) {
  return (
    <div className="rounded-xl bg-forest-100/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] text-stone mb-1">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <p className={`font-display text-lg font-semibold ${warn ? "text-alarm" : "text-forest-950"}`}>
        {value}{unit && <span className="text-xs text-stone ml-0.5">{unit}</span>}
      </p>
      {sub && <p className="text-[10px] text-stone mt-0.5">{sub}</p>}
    </div>
  );
}
