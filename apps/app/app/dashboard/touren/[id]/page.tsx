"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuth";
import { apiFetch, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRealtimeConnection } from "@/lib/realtime";
import Sidebar from "@/components/Sidebar";
import LicensePlate from "@/components/LicensePlate";
import RouteMap, { RouteMapHandle } from "@/components/RouteMap";
import ElevationChart from "@/components/ElevationChart";
import TrackingTimeline from "@/components/TrackingTimeline";
import WeatherSummaryCard from "@/components/weather/WeatherSummaryCard";
import { ArrowLeft, Clock, MapPin, TrendingUp, TrendingDown, Car, CheckCircle2, Radio, ParkingSquare, Users, FileText, Moon, ExternalLink } from "lucide-react";

const ACTIVITY_EMOJI: Record<string, string> = {
  WANDERN: "🥾", BERGTOUR: "⛰️", KLETTERN: "🧗", KLETTERSTEIG: "🪢",
  TRAILRUNNING: "🏃", MOUNTAINBIKE: "🚵", RADSPORT: "🚴",
  SKI_SNOWBOARD: "🎿", SKITOUR: "⛷️", KANU_KAJAK: "🛶",
  PARAGLIDING: "🪂", ANDERE: "🏔️",
};

function statusBadge(status: string) {
  if (status === "ACTIVE") return { text: "Aktiv", cls: "bg-forest-100 text-forest-700", dot: "bg-forest-500 pulse-active" };
  if (status === "ALARM") return { text: "Alarm", cls: "bg-alarm-50 text-alarm", dot: "bg-alarm pulse-alarm" };
  if (status === "COMPLETED") return { text: "Abgeschlossen", cls: "bg-forest-950/[0.05] text-stone", dot: "" };
  return { text: status, cls: "bg-forest-950/[0.05] text-stone", dot: "" };
}

const OVERNIGHT_LABELS: Record<string, string> = {
  huette: "SAC Hütte", berghuette: "Berghütte", hotel: "Hotel/B&B",
  zelt: "Zelt/Biwak", camping: "Camping", schutz: "Schutzhütte", privat: "Privat",
};

export default function TourDetailPage() {
  const { user, loading: authLoading, logout } = useAuthGuard();
  const params = useParams();
  const router = useRouter();
  const [tour, setTour] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState("");
  const [justUpdated, setJustUpdated] = useState(false);
  const mapRef = useRef<RouteMapHandle>(null);
  const mapSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user]);

  // Live updates: when the mobile app sends a new GPS point or changes the
  // tour status (e.g. checkout, ALARM), reflect it here immediately —
  // no manual reload needed.
  const { connected } = useRealtimeConnection((event) => {
    if (event.type === "location_update" && event.tourId === params.id) {
      setTour((prev: any) => {
        if (!prev) return prev;
        const newLocation = { lat: event.lat, lng: event.lng, timestamp: event.timestamp };
        return {
          ...prev,
          lastLat: event.lat,
          lastLng: event.lng,
          locations: [...(prev.locations ?? []), newLocation],
        };
      });
      setJustUpdated(true);
      setTimeout(() => setJustUpdated(false), 2000);
    }
    if (event.type === "tour_status_change" && event.tourId === params.id) {
      setTour((prev: any) => prev ? { ...prev, status: event.status } : prev);
    }
  });

  function showOnMap(lat: number, lng: number) {
    mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => mapRef.current?.flyTo(lat, lng), 350);
  }

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

  async function handleCheckout() {
    if (!tour) return;
    setCheckingOut(true);
    try {
      const token = getToken();
      await apiFetch(`/tours/${tour.id}/checkout`, { method: "POST" }, token ?? undefined);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Auschecken fehlgeschlagen");
    } finally {
      setCheckingOut(false);
    }
  }

  if (authLoading || loading) {
    return <div className="min-h-screen bg-snow flex items-center justify-center text-stone text-sm">Lädt…</div>;
  }

  if (error || !tour) {
    return (
      <div className="flex min-h-screen bg-snow">
        <Sidebar onLogout={logout} userName={user?.name} />
        <main className="flex-1 px-12 py-11 max-w-3xl">
          <button onClick={() => router.push("/dashboard/touren")} className="flex items-center gap-1.5 text-sm text-stone hover:text-forest-950 mb-6">
            <ArrowLeft className="w-4 h-4" /> Zurück zu Touren
          </button>
          <p className="text-alarm text-sm">{error || "Tour nicht gefunden"}</p>
        </main>
      </div>
    );
  }

  const status = statusBadge(tour.status);
  const isActive = tour.status === "ACTIVE" || tour.status === "ALARM";
  const gpxPoints = tour.gpxTrack?.points ?? [];
  const gpxWaypoints = tour.gpxTrack?.waypoints ?? tour.waypoints ?? [];
  const overnightStops = tour.overnightStops ?? [];

  return (
    <div className="flex min-h-screen bg-snow">
      <Sidebar onLogout={logout} userName={user?.name} />

      <main className="flex-1 px-12 py-11 max-w-4xl">
        <button onClick={() => router.push("/dashboard/touren")} className="flex items-center gap-1.5 text-sm text-stone hover:text-forest-950 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Zurück zu Touren
        </button>

        <div className="flex items-start justify-between mb-7">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${status.cls}`}>
                {status.dot && <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />}
                {status.text}
              </span>
              {isActive && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${connected ? "text-stone" : "text-stone/50"}`}>
                  <Radio className="w-3 h-3" />
                  {connected ? "Live verbunden" : "Verbinde…"}
                </span>
              )}
            </div>
            <h1 className="font-display text-3xl font-semibold text-forest-950 tracking-tight">
              {ACTIVITY_EMOJI[tour.activity] ?? "🏔️"} {tour.routeName || tour.activity || "Tour"}
            </h1>
          </div>
          {isActive && (
            <button
              onClick={handleCheckout}
              disabled={checkingOut}
              className="flex items-center gap-2 bg-forest-700 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-forest-600 transition-colors disabled:opacity-60 shrink-0"
            >
              <CheckCircle2 className="w-4 h-4" />
              {checkingOut ? "Wird ausgecheckt…" : "Sicher zurück melden"}
            </button>
          )}
        </div>

        {tour.groupId && (
          <button
            onClick={() => router.push(`/dashboard/gruppen/${tour.groupId}`)}
            className="flex items-center gap-2 rounded-xl border border-forest-700/20 bg-forest-100/50 px-4 py-2.5 text-sm font-medium text-forest-700 hover:bg-forest-100 transition-colors mb-6"
          >
            <Users className="w-4 h-4" /> Teil einer gemeinsamen Tour — alle Teilnehmer anzeigen
          </button>
        )}

        {error && (
          <div className="bg-alarm-50 border border-alarm-100 text-alarm text-sm rounded-xl px-4 py-3 mb-6">
            {error}
          </div>
        )}

        {/* Map — radius/overflow live on this outer wrapper; the inner
            div passed to RouteMap stays a plain, unclipped block so Leaflet's
            own panes (which use translate3d) don't fight a clipping context.
            Ring flashes briefly when a fresh GPS point arrives over the WebSocket. */}
        <div
          ref={mapSectionRef}
          className={`rounded-2xl border shadow-card h-80 mb-6 overflow-hidden transition-shadow ${
            justUpdated ? "border-forest-500 ring-2 ring-forest-500/30" : "border-forest-950/[0.07]"
          }`}
        >
          <div className="w-full h-full relative">
            <RouteMap
              ref={mapRef}
              locations={tour.locations ?? []}
              startLat={tour.startLat}
              startLng={tour.startLng}
              plannedRoute={gpxPoints}
              waypoints={gpxWaypoints}
              overnightStops={overnightStops}
              parking={{ lat: tour.parkingLat, lng: tour.parkingLng, name: tour.parkingLocation }}
            />
          </div>
        </div>


        {/* Elevation profile from the uploaded GPX track */}
        {gpxPoints.length > 1 && (
          <div className="mb-6">
            <ElevationChart points={gpxPoints} />
          </div>
        )}

        {/* Live GPS history — chronological, jump-to-map on click */}
        <div className="mb-6">
          <TrackingTimeline tour={tour} onJumpToMap={showOnMap} />
        </div>

        {/* Stats row — weather sits inline here as one more compact tile,
            matching the others; tapping it opens the full weather page. */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {(tour.lastLat ?? tour.startLat) && (
            <WeatherSummaryCard
              lat={tour.lastLat ?? tour.startLat}
              lng={tour.lastLng ?? tour.startLng}
              activity={tour.activity}
              detailHref={`/dashboard/touren/${tour.id}/wetter`}
            />
          )}
          {tour.distanceKm && (
            <div className="bg-white rounded-xl border border-forest-950/[0.06] shadow-card p-4">
              <div className="flex items-center gap-1.5 text-xs text-stone mb-1.5">
                <MapPin className="w-3.5 h-3.5" /> Distanz
              </div>
              <span className="font-display text-xl font-semibold text-forest-950">{tour.distanceKm} km</span>
            </div>
          )}
          {tour.elevationUp != null && (
            <div className="bg-white rounded-xl border border-forest-950/[0.06] shadow-card p-4">
              <div className="flex items-center gap-1.5 text-xs text-stone mb-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Aufstieg
              </div>
              <span className="font-display text-xl font-semibold text-forest-950">{tour.elevationUp} hm</span>
            </div>
          )}
          {tour.gpxTrack?.elevationDown != null && (
            <div className="bg-white rounded-xl border border-forest-950/[0.06] shadow-card p-4">
              <div className="flex items-center gap-1.5 text-xs text-stone mb-1.5">
                <TrendingDown className="w-3.5 h-3.5" /> Abstieg
              </div>
              <span className="font-display text-xl font-semibold text-forest-950">{tour.gpxTrack.elevationDown} hm</span>
            </div>
          )}
          {tour.eta && (
            <div className="bg-white rounded-xl border border-forest-950/[0.06] shadow-card p-4">
              <div className="flex items-center gap-1.5 text-xs text-stone mb-1.5">
                <Clock className="w-3.5 h-3.5" /> Rückkehr bis
              </div>
              <span className="font-display text-xl font-semibold text-forest-950">
                {new Date(tour.eta).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          )}
          {tour.vehicle && (
            <div className="bg-white rounded-xl border border-forest-950/[0.06] shadow-card p-4">
              <div className="flex items-center gap-1.5 text-xs text-stone mb-2">
                <Car className="w-3.5 h-3.5" /> Fahrzeug
              </div>
              <LicensePlate text={tour.vehicle.plate} size="sm" />
            </div>
          )}
          {tour.difficulty && (
            <div className="bg-white rounded-xl border border-forest-950/[0.06] shadow-card p-4">
              <div className="text-xs text-stone mb-1.5">Schwierigkeit</div>
              <span className="font-display text-xl font-semibold text-forest-950">{tour.difficulty}</span>
            </div>
          )}
        </div>

        {/* Parking */}
        {(tour.parkingLocation || (tour.parkingLat && tour.parkingLng)) && (
          <div className="flex items-center gap-3 bg-white rounded-2xl border border-forest-950/[0.06] shadow-card p-5 mb-6">
            <ParkingSquare className="w-4 h-4 text-forest-700 shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-stone">Parkplatz / Trailhead</p>
              <p className="text-sm font-medium text-forest-950">{tour.parkingLocation || "Position auf der Karte gesetzt"}</p>
              {tour.parkingLat && tour.parkingLng && (
                <div className="flex items-center gap-3 mt-0.5">
                  <button
                    onClick={() => showOnMap(tour.parkingLat, tour.parkingLng)}
                    className="text-xs text-forest-700 hover:underline"
                  >
                    {Number(tour.parkingLat).toFixed(5)}, {Number(tour.parkingLng).toFixed(5)}
                  </button>
                  <a
                    href={`https://maps.google.com/?q=${tour.parkingLat},${tour.parkingLng}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs text-forest-700 font-medium hover:underline flex items-center gap-1"
                  >
                    Navigation öffnen <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Overnight stops */}
        {overnightStops.length > 0 && (
          <div className="bg-white rounded-2xl border border-forest-950/[0.06] shadow-card p-6 mb-6">
            <h3 className="font-display font-semibold text-sm text-forest-950 mb-4 flex items-center gap-2">
              <Moon className="w-4 h-4 text-forest-700" /> Übernachtungen
            </h3>
            <div className="space-y-3">
              {overnightStops.map((stop: any, i: number) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-xs font-bold text-forest-700 bg-forest-100 rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5">
                    {stop.night}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-forest-950">
                      {stop.name || OVERNIGHT_LABELS[stop.type] || "Übernachtung"}
                    </p>
                    {stop.type && stop.name && (
                      <p className="text-xs text-stone">{OVERNIGHT_LABELS[stop.type] ?? stop.type}</p>
                    )}
                    {stop.address && stop.address !== stop.name && (
                      <p className="text-xs text-stone mt-0.5">{stop.address}</p>
                    )}
                    {stop.lat && stop.lng && (
                      <div className="flex items-center gap-3 mt-0.5">
                        <button
                          onClick={() => showOnMap(Number(stop.lat), Number(stop.lng))}
                          className="text-xs text-forest-700 hover:underline"
                        >
                          {Number(stop.lat).toFixed(5)}, {Number(stop.lng).toFixed(5)}
                        </button>
                        <a
                          href={`https://maps.google.com/?q=${stop.lat},${stop.lng}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs text-forest-700 font-medium hover:underline flex items-center gap-1"
                        >
                          Navigation öffnen <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                    {stop.notes && <p className="text-xs text-forest-950/60 mt-0.5">{stop.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {tour.notes && (
          <div className="bg-white rounded-2xl border border-forest-950/[0.06] shadow-card p-6 mb-6">
            <h3 className="font-display font-semibold text-sm text-forest-950 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-forest-700" /> Notizen
            </h3>
            <p className="text-sm text-forest-950/70 leading-relaxed">{tour.notes}</p>
          </div>
        )}

        {/* Companions */}
        {tour.companions?.length > 0 && (
          <div className="bg-white rounded-2xl border border-forest-950/[0.06] shadow-card p-6">
            <h3 className="font-display font-semibold text-sm text-forest-950 mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-forest-700" /> Begleitpersonen
            </h3>
            <div className="space-y-2">
              {tour.companions.map((c: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center text-xs font-bold">
                    {(c.name || "?")[0]?.toUpperCase()}
                  </div>
                  <div>
                    <span className="text-sm text-forest-950/80">{c.name}</span>
                    {c.age && <span className="text-xs text-stone ml-1.5">Jg. {c.age}</span>}
                    {c.notes && <p className="text-xs text-stone">{c.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
