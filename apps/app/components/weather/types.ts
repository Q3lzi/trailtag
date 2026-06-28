export type WeatherData = {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    wind_direction_10m: number;
    cloud_cover: number;
    uv_index: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    precipitation: number[];
    weather_code: number[];
    wind_speed_10m: number[];
    wind_gusts_10m: number[];
    cloud_cover: number[];
    visibility: number[];
    uv_index: number[];
    cape: number[];
    freezing_level_height: number[];
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    uv_index_max: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
    wind_speed_10m_max: number[];
    wind_gusts_10m_max: number[];
    sunrise: string[];
    sunset: string[];
    weather_code: number[];
  };
};

export type AvalancheData = {
  maxDangerLevel: number | null;
  validUntil: string | null;
  bulletinUrl: string;
} | null;

export type WeatherResponse = {
  weather: WeatherData;
  avalanche: AvalancheData;
  fetchedAt: string;
};

// WMO weather codes -> emoji + short German label. Open-Meteo uses the
// standard WMO code table; this covers the ranges relevant to alpine
// conditions (clear/cloudy/fog/rain/snow/thunderstorm).
export function weatherCodeInfo(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: "☀️", label: "Klar" };
  if (code <= 2) return { emoji: "🌤️", label: "Teilweise bewölkt" };
  if (code === 3) return { emoji: "☁️", label: "Bewölkt" };
  if (code === 45 || code === 48) return { emoji: "🌫️", label: "Nebel" };
  if (code >= 51 && code <= 57) return { emoji: "🌦️", label: "Leichter Regen" };
  if (code >= 61 && code <= 67) return { emoji: "🌧️", label: "Regen" };
  if (code >= 71 && code <= 77) return { emoji: "🌨️", label: "Schneefall" };
  if (code >= 80 && code <= 82) return { emoji: "🌧️", label: "Regenschauer" };
  if (code >= 85 && code <= 86) return { emoji: "❄️", label: "Schneeschauer" };
  if (code >= 95) return { emoji: "⛈️", label: "Gewitter" };
  return { emoji: "🌡️", label: "—" };
}

export function thunderstormRisk(cape: number): { level: "low" | "moderate" | "high"; label: string } {
  if (cape >= 2500) return { level: "high", label: "Hohes Gewitterrisiko" };
  if (cape >= 1000) return { level: "moderate", label: "Mässiges Gewitterrisiko" };
  return { level: "low", label: "Geringes Gewitterrisiko" };
}

export function uvRiskLabel(uv: number): { label: string; advice: string } {
  if (uv >= 11) return { label: "Extrem", advice: "Sonnenschutz unbedingt nötig" };
  if (uv >= 8) return { label: "Sehr hoch", advice: "Sonnenschutz nötig" };
  if (uv >= 6) return { label: "Hoch", advice: "Sonnenschutz empfohlen" };
  if (uv >= 3) return { label: "Mässig", advice: "Sonnenschutz bei längerer Exposition" };
  return { label: "Gering", advice: "Sonnenschutz meist nicht nötig" };
}

export const AVALANCHE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Gering", color: "#16a34a" },
  2: { label: "Mässig", color: "#eab308" },
  3: { label: "Erheblich", color: "#f97316" },
  4: { label: "Gross", color: "#dc2626" },
  5: { label: "Sehr gross", color: "#7f1d1d" },
};