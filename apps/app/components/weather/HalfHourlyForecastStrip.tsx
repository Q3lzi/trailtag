"use client";

import type { WeatherData } from "./types";
import { weatherCodeInfo } from "./types";
import { Droplets } from "lucide-react";

/**
 * 30-minute resolution for the next 6 hours — alpine conditions can flip
 * within the hour, so this samples Open-Meteo's 15-minutely series (real
 * sub-hourly data for Central Europe via DWD ICON-D2/AROME, not just
 * interpolation) every other step to get a true 30-min cadence.
 */
export default function HalfHourlyForecastStrip({ weather }: { weather: WeatherData }) {
  const now = new Date();
  const m15 = weather.minutely_15;
  if (!m15?.time?.length) return null;

  const nowIdx = m15.time.findIndex((t) => new Date(t) >= now);
  const startIdx = nowIdx >= 0 ? nowIdx : 0;
  // Sample every 2nd 15-min step -> 30-min cadence, for the next 6h (12 steps).
  const steps = Array.from({ length: 12 }, (_, i) => startIdx + i * 2).filter((i) => i < m15.time.length);

  if (steps.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] font-bold text-stone uppercase tracking-wide mb-3">Alle 30 Minuten · nächste 6h</p>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {steps.map((i) => {
          const time = new Date(m15.time[i]);
          const info = weatherCodeInfo(m15.weather_code[i]);
          const cape = m15.cape[i] ?? 0;
          const isThunderRisk = cape >= 1000;
          return (
            <div
              key={i}
              className={`flex flex-col items-center gap-1 shrink-0 rounded-xl p-2.5 w-[58px] ${
                isThunderRisk ? "bg-alarm-50" : "bg-forest-100/40"
              }`}
            >
              <span className="text-[10px] font-medium text-stone">
                {time.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="text-base leading-none">{isThunderRisk ? "⛈️" : info.emoji}</span>
              <span className="text-xs font-semibold text-forest-950 font-display">{Math.round(m15.temperature_2m[i])}°</span>
              {m15.precipitation[i] >= 0.1 ? (
                <span className="flex items-center gap-0.5 text-[10px] text-blue-700 font-medium">
                  <Droplets className="w-2.5 h-2.5" />{m15.precipitation[i].toFixed(1)}
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
