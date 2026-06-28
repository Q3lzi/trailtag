"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { getToken } from "./auth";
import type { WeatherResponse } from "@/components/weather/types";

export function useWeather(lat: number | null | undefined, lng: number | null | undefined, activity?: string) {
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (lat == null || lng == null) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");

    (async () => {
      try {
        const token = getToken();
        const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
        if (activity) params.set("activity", activity);
        const result = await apiFetch(`/weather?${params}`, {}, token ?? undefined);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError("Wetterdaten nicht verfügbar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lat, lng, activity]);

  return { data, loading, error };
}