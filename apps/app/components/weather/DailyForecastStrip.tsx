"use client";

import type { WeatherData } from "./types";
import { weatherCodeInfo } from "./types";
import { Droplets } from "lucide-react";

/**
 * Next-days preview (today + up to 4 more) — the thing someone planning a
 * multi-day tour or checking "will tomorrow still be fine" actually needs.
 * Visually matches the hourly strip's tile pattern, so the two look like
 * one connected feature rather than two different widgets bolted together.
 */
export default function DailyForecastStrip({ weather }: { weather: WeatherData }) {
  const daily = weather.daily;
  const days = daily.time.slice(0, 5);

  if (days.length <= 1) return null;

  return (
    <div>
      <p className="text-[10px] font-bold text-stone uppercase tracking-wide mb-3">Nächste Tage</p>
      <div className="flex gap-2">
        {days.map((dateStr, i) => {
          const date = new Date(dateStr);
          const info = weatherCodeInfo(daily.weather_code[i]);
          const isToday = i === 0;
          const rainChance = daily.precipitation_probability_max[i] ?? 0;
          return (
            <div key={dateStr} className="flex flex-col items-center gap-1 rounded-xl bg-forest-100/40 p-2.5 flex-1">
              <span className={`text-[10px] font-medium ${isToday ? "text-forest-700 font-bold" : "text-stone"}`}>
                {isToday ? "Heute" : date.toLocaleDateString("de-CH", { weekday: "short" })}
              </span>
              <span className="text-base leading-none">{info.emoji}</span>
              <span className="text-xs font-semibold text-forest-950 font-display">
                {Math.round(daily.temperature_2m_max[i])}°<span className="text-stone font-normal">/{Math.round(daily.temperature_2m_min[i])}°</span>
              </span>
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
