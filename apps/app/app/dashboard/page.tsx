"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuth";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRealtimeConnection } from "@/lib/realtime";
import { relativeTimeFromNow, timeUntil, elapsedSince } from "@/lib/timeFormat";
import Sidebar from "@/components/Sidebar";
import LicensePlate from "@/components/LicensePlate";
import SituationMap from "@/components/SituationMap";
import WeatherSummaryCard from "@/components/weather/WeatherSummaryCard";
import {
  Mountain, Clock, TrendingUp, MapPin, ArrowUpRight, Plus, Phone,
  Car, Users, ExternalLink, Radio, AlertTriangle,
} from "lucide-react";

const ACTIVITY_EMOJI: Record<string, string> = {
  WANDERN: "🥾", BERGTOUR: "⛰️", KLETTERN: "🧗", KLETTERSTEIG: "🪢",
  TRAILRUNNING: "🏃", MOUNTAINBIKE: "🚵", RADSPORT: "🚴",
  SKI_SNOWBOARD: "🎿", SKITOUR: "⛷️", KANU_KAJAK: "🛶",
  PARAGLIDING: "🪂", ANDERE: "🏔️",
};

export default function DashboardPage() {
  const { user, loading: authLoading, logout } = useAuthGuard();
  const router = useRouter();
  const [tours, setTours] = useState<any[]>([]);
  const [activeTour, setActiveTour] = useState<any>(null);
  const [vehicle, setVehicle] = useState<any>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<any[]>([]);
  const [friendsOnTour, setFriendsOnTour] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [, forceTick] = useState(0); // re-render every minute so countdowns stay live

  useEffect(() => {
    if (!authLoading && user) loadData();
  }, [authLoading, user]);

  // Tick once a minute so "vor X Min" / "noch X Min" labels stay accurate
  // without anyone needing to reload — this is a passive observer's screen.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  // Live: reflect new GPS points and status changes immediately — this is
  // the core promise of a "situation board" for someone watching from home.
  useRealtimeConnection((event) => {
    if (event.type === "location_update") {
      setActiveTour((prev: any) => (prev && prev.id === event.tourId ? { ...prev, lastLat: event.lat, lastLng: event.lng, locationUpdatedAt: event.timestamp } : prev));
    }
    if (event.type === "tour_status_change") {
      setActiveTour((prev: any) => (prev && prev.id === event.tourId ? { ...prev, status: event.status } : prev));
      setFriendsOnTour((prev) =>
        event.status === "COMPLETED"
          ? prev.filter((f) => f.activeTour?.id !== event.tourId)
          : prev.map((f) => (f.activeTour?.id === event.tourId ? { ...f, activeTour: { ...f.activeTour, status: event.status } } : f))
      );
    }
  });

  async function loadData() {
    try {
      const token = getToken();
      const [toursData, friendsData, profileData] = await Promise.all([
        apiFetch("/tours", {}, token ?? undefined),
        apiFetch("/friends", {}, token ?? undefined).catch(() => ({ friends: [] })),
        apiFetch("/profile", {}, token ?? undefined).catch(() => ({})),
      ]);
      setTours(toursData);
      const active = toursData.find((t: any) => t.status === "ACTIVE" || t.status === "ALARM");
      setEmergencyContacts(profileData.emergencyContacts ?? []);
      setFriendsOnTour((friendsData.friends ?? []).filter((f: any) => f.activeTour));

      if (active) {
        // The list endpoint doesn't include the full gpxTrack/waypoints —
        // fetch the full record so the situation map can show the planned
        // route, not just the bare list fields.
        const full = await apiFetch(`/tours/${active.id}`, {}, token ?? undefined).catch(() => active);
        setActiveTour(full);
        if (full.vehicleId) {
          const vehicles = await apiFetch("/vehicles", {}, token ?? undefined).catch(() => []);
          setVehicle(vehicles.find((v: any) => v.id === full.vehicleId) ?? null);
        }
      } else {
        setActiveTour(null);
      }
    } catch {
      // dashboard still renders empty state
    } finally {
      setDataLoading(false);
    }
  }

  if (authLoading) {
    return <div className="min-h-screen bg-snow flex items-center justify-center text-stone text-sm">Lädt…</div>;
  }

  const isAlarm = activeTour?.status === "ALARM";
  const completedTours = tours.filter((t) => t.status === "COMPLETED");
  const totalKm = completedTours.reduce((s, t) => s + (t.distanceKm ?? 0), 0);
  const totalEle = completedTours.reduce((s, t) => s + (t.elevationUp ?? 0), 0);
  const hasLocation = activeTour?.lastLat && activeTour?.lastLng;
  const primaryContact = emergencyContacts[0];

  return (
    <div className="flex min-h-screen bg-snow">
      <Sidebar onLogout={logout} userName={user?.name} />

      <main className="flex-1 px-10 py-9 max-w-[1400px]">
        <div className="flex items-baseline justify-between mb-7">
          <div>
            <p className="text-xs font-semibold text-forest-700 uppercase tracking-wide mb-1.5">
              {new Date().toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 className="font-display text-2xl font-semibold text-forest-950 tracking-tight">
              Lagebild{user?.name ? ` — ${user.name.split(" ")[0]}` : ""}
            </h1>
          </div>
          {!activeTour && !dataLoading && (
            <button
              onClick={() => router.push("/dashboard/touren/neu")}
              className="flex items-center gap-2 bg-forest-700 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-forest-600 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" /> Neue Tour
            </button>
          )}
        </div>

        {dataLoading ? (
          <div className="text-stone text-sm">Lädt…</div>
        ) : activeTour ? (
          // ── Mission-control layout: huge map (left, 2/3) + status column (right, 1/3) ──
          <div className="grid grid-cols-3 gap-5">
            <div className="col-span-2 flex flex-col gap-4">
              {/* The map is the dominant element — this is what someone watching keeps looking at. */}
              <div
                className={`relative overflow-hidden rounded-2xl border-2 h-[480px] ${
                  isAlarm ? "border-alarm" : "border-forest-950/[0.07]"
                }`}
              >
                {hasLocation ? (
                  <SituationMap
                    lat={activeTour.lastLat}
                    lng={activeTour.lastLng}
                    plannedRoute={activeTour.gpxTrack?.points}
                    startLat={activeTour.startLat}
                    startLng={activeTour.startLng}
                    waypoints={activeTour.gpxTrack?.waypoints ?? activeTour.waypoints}
                    overnightStops={activeTour.overnightStops}
                    parking={{ lat: activeTour.parkingLat, lng: activeTour.parkingLng, name: activeTour.parkingLocation }}
                  />
                ) : (
                  <div className="w-full h-full bg-forest-100 flex items-center justify-center">
                    <p className="text-sm text-stone">Noch kein GPS-Signal empfangen.</p>
                  </div>
                )}

                {/* Status overlay, top-left of the map */}
                <div className="absolute top-4 left-4 right-4 flex items-start justify-between pointer-events-none">
                  <div
                    className={`pointer-events-auto flex items-center gap-2 rounded-full px-3.5 py-2 backdrop-blur-md shadow-lg ${
                      isAlarm ? "bg-alarm text-white" : "bg-white/95 text-forest-950"
                    }`}
                  >
                    <span className={`relative flex h-2 w-2 rounded-full ${isAlarm ? "bg-white pulse-alarm" : "bg-forest-500 pulse-active"}`} />
                    <span className="text-xs font-bold uppercase tracking-wide">
                      {isAlarm ? "Alarm — überfällig" : "Unterwegs"}
                    </span>
                  </div>
                  {isAlarm && vehicle && (
                    <a
                      href={`https://trailtag-production.up.railway.app/r/${vehicle.qrToken}`}
                      target="_blank" rel="noopener noreferrer"
                      className="pointer-events-auto flex items-center gap-1.5 bg-white text-alarm rounded-full px-3.5 py-2 text-xs font-bold shadow-lg hover:bg-alarm-50 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Ersthelfer-Portal
                    </a>
                  )}
                </div>

                {/* Last update timestamp, bottom-left */}
                {activeTour.locationUpdatedAt && (
                  <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-white/95 backdrop-blur-md rounded-full px-3 py-1.5 shadow-lg">
                    <Radio className="w-3 h-3 text-forest-700" />
                    <span className="text-[11px] font-medium text-forest-950/80">
                      Letztes Signal: {relativeTimeFromNow(activeTour.locationUpdatedAt)}
                    </span>
                  </div>
                )}
              </div>

              {/* Tour identity row below the map */}
              <div
                onClick={() => router.push(`/dashboard/touren/${activeTour.id}`)}
                className="flex items-center justify-between bg-white rounded-2xl border border-forest-950/[0.06] shadow-card p-5 cursor-pointer hover:shadow-card-hover transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{ACTIVITY_EMOJI[activeTour.activity] ?? "🏔️"}</span>
                  <div>
                    <h2 className="font-display font-semibold text-forest-950">
                      {activeTour.routeName || activeTour.activity}
                    </h2>
                    <p className="text-xs text-stone">
                      Gestartet {activeTour.startedAt ? elapsedSince(activeTour.startedAt) + " vor" : ""}
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-forest-950/30" />
              </div>
            </div>

            {/* ── Right column: countdown, contact, stats — what matters while watching ── */}
            <div className="flex flex-col gap-4">
              {/* Countdown / overdue — the single most important number on the page */}
              {activeTour.eta && (
                <div className={`rounded-2xl p-6 ${isAlarm ? "bg-alarm" : "bg-forest-950"}`}>
                  <p className={`text-[11px] font-bold uppercase tracking-wide mb-2 ${isAlarm ? "text-white/80" : "text-forest-500"}`}>
                    {isAlarm ? "Überfällig seit" : "Erwartete Rückkehr"}
                  </p>
                  <p className="font-display text-2xl font-semibold text-white mb-1">
                    {timeUntil(activeTour.eta).label}
                  </p>
                  <p className="text-xs text-white/60">
                    {new Date(activeTour.eta).toLocaleString("de-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} Uhr
                  </p>
                </div>
              )}

              {/* Quick contact — the action someone watching actually wants */}
              {primaryContact && (
                <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-5">
                  <p className="text-[11px] font-bold text-stone uppercase tracking-wide mb-3">Primärer Notfallkontakt</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center text-sm font-bold shrink-0">
                      {primaryContact.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-forest-950 truncate">{primaryContact.name}</p>
                      <p className="text-xs text-stone">{primaryContact.relation}</p>
                    </div>
                    <a href={`tel:${primaryContact.phone}`} className="p-2 rounded-full bg-forest-100 text-forest-700 hover:bg-forest-700 hover:text-white transition-colors shrink-0">
                      <Phone className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              )}

              {/* Vehicle */}
              {vehicle && (
                <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-5">
                  <p className="text-[11px] font-bold text-stone uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5" /> Fahrzeug am Trailhead
                  </p>
                  <LicensePlate text={vehicle.plate} size="md" />
                  {(vehicle.make || vehicle.model) && (
                    <p className="text-xs text-stone mt-2">{vehicle.make} {vehicle.model}</p>
                  )}
                </div>
              )}

              {/* Quick stats, compact — weather sits inline with the other
                  small stat tiles instead of as an oversized standalone
                  block; tapping it opens the full weather detail page. */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-4">
                  <div className="flex items-center gap-1.5 text-[11px] text-stone mb-1">
                    <MapPin className="w-3 h-3" /> Distanz
                  </div>
                  <p className="font-display text-lg font-semibold text-forest-950">{activeTour.distanceKm ?? "—"} km</p>
                </div>
                <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-4">
                  <div className="flex items-center gap-1.5 text-[11px] text-stone mb-1">
                    <TrendingUp className="w-3 h-3" /> Höhenmeter
                  </div>
                  <p className="font-display text-lg font-semibold text-forest-950">{activeTour.elevationUp ?? "—"} hm</p>
                </div>
                {hasLocation && (
                  <div className="col-span-2">
                    <WeatherSummaryCard
                      lat={activeTour.lastLat}
                      lng={activeTour.lastLng}
                      activity={activeTour.activity}
                      detailHref={`/dashboard/touren/${activeTour.id}/wetter`}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          // ── No active tour: planning-focused empty state ──
          <div className="grid grid-cols-3 gap-5">
            <button
              onClick={() => router.push("/dashboard/touren/neu")}
              className="col-span-2 relative overflow-hidden rounded-2xl bg-forest-950 h-[320px] flex items-center text-left group"
            >
              <div className="relative px-9 py-10 max-w-md">
                <Mountain className="w-9 h-9 text-forest-500 mb-5" strokeWidth={1.4} />
                <h2 className="font-display text-2xl font-semibold text-white mb-2.5">Keine aktive Tour</h2>
                <p className="text-white/55 text-sm leading-relaxed mb-5">
                  Plane deine nächste Tour hier im Browser — Route, Notfallkontakte und Sicherheits-Timer in einem Schritt.
                </p>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-forest-500 group-hover:text-forest-400 transition-colors">
                  <Plus className="w-4 h-4" /> Tour planen
                </span>
              </div>
            </button>

            <div className="flex flex-col gap-4">
              <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-5 flex-1">
                <p className="text-[11px] font-bold text-stone uppercase tracking-wide mb-2">Touren</p>
                <p className="font-display text-3xl font-semibold text-forest-950">{completedTours.length}</p>
              </div>
              <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-5 flex-1">
                <p className="text-[11px] font-bold text-stone uppercase tracking-wide mb-2">Gesamtdistanz</p>
                <p className="font-display text-3xl font-semibold text-forest-950">{Math.round(totalKm)} <span className="text-base text-stone">km</span></p>
              </div>
            </div>
          </div>
        )}

        {/* ── Friends row — only relevant content below the fold ── */}
        {!dataLoading && (
          <div className="mt-6">
            <h3 className="text-xs font-bold text-stone uppercase tracking-wide mb-3">
              Freunde unterwegs {friendsOnTour.length > 0 && `· ${friendsOnTour.length}`}
            </h3>
            {friendsOnTour.length > 0 ? (
              <div className="grid grid-cols-4 gap-3">
                {friendsOnTour.map((f: any) => {
                  const fIsAlarm = f.activeTour?.status === "ALARM";
                  return (
                    <div
                      key={f.friendshipId}
                      onClick={() => router.push(`/dashboard/freunde/${f.friendshipId}`)}
                      className={`group rounded-xl p-4 border flex items-center gap-3 cursor-pointer transition-all hover:-translate-y-0.5 ${
                        fIsAlarm ? "bg-alarm-50 border-alarm-100" : "bg-white border-forest-950/[0.06] shadow-card hover:shadow-card-hover"
                      }`}
                    >
                      <div className="relative w-9 h-9 rounded-full bg-forest-800 text-white flex items-center justify-center font-display font-semibold text-sm shrink-0">
                        {(f.name ?? "?")[0]?.toUpperCase()}
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${fIsAlarm ? "bg-alarm" : "bg-forest-500"}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-forest-950 truncate">{f.name}</p>
                        <p className={`text-xs ${fIsAlarm ? "text-alarm font-medium" : "text-stone"}`}>
                          {fIsAlarm ? "Überfällig" : f.activeTour?.activity ?? "Unterwegs"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-stone">Aktuell ist niemand aus deinem Freundeskreis unterwegs.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
