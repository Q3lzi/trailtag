"use client";

import type { WeatherData } from "./types";
import { weatherCodeInfo } from "./types";
import { Droplets } from "lucide-react";

/**
 * Hour-by-hour preview for the next 24h. Alpine weather can turn within an
 * hour, so a 3-hour sample (the previous version) silently hid exactly the
 * kind of rapid swing someone on a mountain needs to see — every hour is
 * shown here, scrollable, rather than sampled down to fit a fixed grid.
 */
export default function HourlyForecastStrip({ weather }: { weather: WeatherData }) {
  const now = new Date();
  const hourly = weather.hourly;

  const nowIdx = hourly.time.findIndex((t) => new Date(t) >= now);
  const startIdx = nowIdx >= 0 ? nowIdx : 0;
  const hours = Array.from({ length: 24 }, (_, i) => startIdx + i).filter((i) => i < hourly.time.length);

  if (hours.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] font-bold text-stone uppercase tracking-wide mb-3">Stündlich · nächste 24h</p>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {hours.map((i) => {
          const time = new Date(hourly.time[i]);
          const info = weatherCodeInfo(hourly.weather_code[i]);
          const cape = hourly.cape[i] ?? 0;
          const rainChance = hourly.precipitation_probability[i] ?? 0;
          const isThunderRisk = cape >= 1000;
          return (
            <div
              key={i}
              className={`flex flex-col items-center gap-1 shrink-0 rounded-xl p-2.5 w-[58px] ${
                isThunderRisk ? "bg-alarm-50" : "bg-forest-100/40"
              }`}
            >
              <span className="text-[10px] font-medium text-stone">
                {time.toLocaleTimeString("de-CH", { hour: "2-digit" })}
              </span>
              <span className="text-base leading-none">{isThunderRisk ? "⛈️" : info.emoji}</span>
              <span className="text-xs font-semibold text-forest-950 font-display">{Math.round(hourly.temperature_2m[i])}°</span>
              {rainChance >= 30 ? (
                <span className="flex items-center gap-0.5 text-[10px] text-blue-700 font-medium">
                  <Droplets className="w-2.5 h-2.5" />{rainChance}%
                </span>
              ) : (
                <span className="text-[10px] text-transparent">—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
