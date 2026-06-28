"use client";

import { useWeather } from "@/lib/useWeather";
import {
  weatherCodeInfo, thunderstormRisk, uvRiskLabel, heatRiskLabel, uvIndexColor, AVALANCHE_LABELS,
} from "./types";
import HalfHourlyForecastStrip from "./HalfHourlyForecastStrip";
import HourlyForecastStrip from "./HourlyForecastStrip";
import DailyForecastStrip from "./DailyForecastStrip";
import {
  Wind, Droplets, Sun, Zap, ExternalLink, ThermometerSun, Mountain,
} from "lucide-react";

/**
 * Full weather detail view, built as several separate cards stacked with
 * normal page spacing — matching how every other detail page in the app
 * (tour detail, friend profile) is composed — rather than one dense panel
 * with everything crammed inside a single bordered box.
 */
export default function WeatherPanel({
  lat,
  lng,
  activity,
}: {
  lat: number | null | undefined;
  lng: number | null | undefined;
  activity?: string;
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
  const heat = heatRiskLabel(weather.daily.temperature_2m_max[0] ?? cur.temperature_2m);
  const freezingLevel = weather.hourly.freezing_level_height[0];

  const warnings: { icon: any; text: string; level: "warn" | "danger" }[] = [];
  if (storm.level === "high") warnings.push({ icon: Zap, text: "Hohes Gewitterrisiko in den nächsten Stunden", level: "danger" });
  else if (storm.level === "moderate") warnings.push({ icon: Zap, text: "Mässiges Gewitterrisiko möglich", level: "warn" });
  if (cur.wind_gusts_10m >= 60) warnings.push({ icon: Wind, text: `Sturmböen bis ${Math.round(cur.wind_gusts_10m)} km/h`, level: "danger" });
  else if (cur.wind_gusts_10m >= 40) warnings.push({ icon: Wind, text: `Starke Böen bis ${Math.round(cur.wind_gusts_10m)} km/h`, level: "warn" });
  if (heat) warnings.push({ icon: ThermometerSun, text: `${heat.label} — bis ${Math.round(weather.daily.temperature_2m_max[0])}°C`, level: heat.label === "Starke Hitze" ? "danger" : "warn" });
  if (uv.isWarning) warnings.push({ icon: Sun, text: `UV-Index ${uv.label.toLowerCase()} — ${uv.advice}`, level: uv.label === "Extrem" ? "danger" : "warn" });
  if (avalanche?.maxDangerLevel && avalanche.maxDangerLevel >= 3) {
    warnings.push({ icon: Mountain, text: `Lawinengefahr ${AVALANCHE_LABELS[avalanche.maxDangerLevel]?.label ?? avalanche.maxDangerLevel}`, level: avalanche.maxDangerLevel >= 4 ? "danger" : "warn" });
  }

  return (
    <div className="space-y-4">
      {/* Warnings — its own card, only rendered if something needs
          attention, so it doesn't compete for space when conditions are fine. */}
      {warnings.length > 0 && (
        <div className="rounded-2xl bg-alarm-50 border border-alarm-100 p-5 space-y-2">
          {warnings.map((w, i) => (
            <div key={i} className={`flex items-center gap-2.5 text-sm font-semibold ${w.level === "danger" ? "text-alarm" : "text-amber-700"}`}>
              <w.icon className="w-4 h-4 shrink-0" />
              {w.text}
            </div>
          ))}
        </div>
      )}

      {/* Current conditions — its own card */}
      <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-6">
        <div className="flex items-center justify-between mb-5">
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

        <div className="grid grid-cols-4 gap-3">
          <Metric icon={Wind} label="Wind" value={`${Math.round(cur.wind_speed_10m)}`} unit="km/h" sub={`Böen ${Math.round(cur.wind_gusts_10m)}`} />
          <Metric icon={Droplets} label="Niederschlag" value={`${weather.daily.precipitation_probability_max[0] ?? 0}`} unit="%" sub={`${weather.daily.precipitation_sum[0]?.toFixed(1) ?? 0} mm`} />
          <Metric
            icon={Sun}
            label="UV-Index"
            value={`${Math.round(weather.daily.uv_index_max[0] ?? cur.uv_index)}`}
            sub={uv.label}
            accentColor={uvIndexColor(weather.daily.uv_index_max[0] ?? cur.uv_index)}
          />
          <Metric icon={ThermometerSun} label="Nullgradgrenze" value={freezingLevel ? `${Math.round(freezingLevel)}` : "—"} unit="m" />
        </div>

        {avalanche?.bulletinUrl && !avalanche.maxDangerLevel && (
          <a
            href={avalanche.bulletinUrl}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-forest-700 hover:underline mt-4"
          >
            Lawinenbulletin (SLF) ansehen <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* 30-minute look-ahead for the next 6h — its own card. Alpine
          weather can flip within an hour, so this sits first, ahead of the
          coarser hourly/daily views. */}
      {weather.minutely_15?.time?.length > 0 && (
        <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-6">
          <HalfHourlyForecastStrip weather={weather} />
        </div>
      )}

      {/* Hourly look-ahead — its own card */}
      <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-6">
        <HourlyForecastStrip weather={weather} />
      </div>

      {/* Daily look-ahead — its own card */}
      <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-6">
        <DailyForecastStrip weather={weather} />
      </div>
    </div>
  );
}

function Metric({
  icon: Icon, label, value, unit, sub, warn, accentColor,
}: {
  icon: any; label: string; value: string; unit?: string; sub?: string; warn?: boolean; accentColor?: string;
}) {
  return (
    <div className="rounded-xl bg-forest-100/40 p-3" style={accentColor ? { boxShadow: `inset 0 0 0 1.5px ${accentColor}30` } : undefined}>
      <div className="flex items-center gap-1.5 text-[10px] text-stone mb-1">
        <Icon className="w-3 h-3" style={accentColor ? { color: accentColor } : undefined} /> {label}
      </div>
      <p
        className={`font-display text-lg font-semibold ${!accentColor && warn ? "text-alarm" : !accentColor ? "text-forest-950" : ""}`}
        style={accentColor ? { color: accentColor } : undefined}
      >
        {value}{unit && <span className="text-xs text-stone ml-0.5">{unit}</span>}
      </p>
      {sub && <p className="text-[10px] text-stone mt-0.5">{sub}</p>}
    </div>
  );
}
