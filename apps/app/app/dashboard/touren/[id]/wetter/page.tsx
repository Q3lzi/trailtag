"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuth";
import { apiFetch, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import WeatherPanel from "@/components/weather/WeatherPanel";
import { ArrowLeft } from "lucide-react";

export default function TourWeatherPage() {
  const { user, loading: authLoading, logout } = useAuthGuard();
  const params = useParams();
  const router = useRouter();
  const [tour, setTour] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user]);

  async function load() {
    try {
      const token = getToken();
      const data = await apiFetch(`/tours/${params.id}`, {}, token ?? undefined);
      setTour(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Tour konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || loading) {
    return <div className="min-h-screen bg-snow flex items-center justify-center text-stone text-sm">Lädt…</div>;
  }

  if (error || !tour) {
    return (
      <div className="flex min-h-screen bg-snow">
        <Sidebar onLogout={logout} userName={user?.name} />
        <main className="flex-1 px-12 py-11 max-w-2xl">
          <button onClick={() => router.push(`/dashboard/touren/${params.id}`)} className="flex items-center gap-1.5 text-sm text-stone hover:text-forest-950 mb-6">
            <ArrowLeft className="w-4 h-4" /> Zurück zur Tour
          </button>
          <p className="text-alarm text-sm">{error || "Tour nicht gefunden"}</p>
        </main>
      </div>
    );
  }

  // Prefer the live/last position; fall back to the planned start point —
  // same priority as the tour detail page's own map and weather usage.
  const lat = tour.lastLat ?? tour.startLat;
  const lng = tour.lastLng ?? tour.startLng;

  return (
    <div className="flex min-h-screen bg-snow">
      <Sidebar onLogout={logout} userName={user?.name} />

      <main className="flex-1 px-12 py-11 max-w-2xl">
        <button
          onClick={() => router.push(`/dashboard/touren/${tour.id}`)}
          className="flex items-center gap-1.5 text-sm text-stone hover:text-forest-950 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Zurück zur Tour
        </button>

        <div className="mb-7">
          <p className="text-xs font-semibold text-forest-700 uppercase tracking-wide mb-1.5">Wetterbericht</p>
          <h1 className="font-display text-3xl font-semibold text-forest-950 tracking-tight">
            {tour.routeName || tour.activity || "Tour"}
          </h1>
        </div>

        {lat != null && lng != null ? (
          <WeatherPanel lat={lat} lng={lng} activity={tour.activity} />
        ) : (
          <p className="text-sm text-stone">Kein Standort für diese Tour hinterlegt.</p>
        )}
      </main>
    </div>
  );
}
