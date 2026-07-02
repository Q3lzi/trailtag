"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuth";
import { apiFetch, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRealtimeConnection } from "@/lib/realtime";
import Sidebar from "@/components/Sidebar";
import InteractivePlanningMap, { InteractivePlanningMapHandle } from "@/components/InteractivePlanningMap";
import GroupMap, { GroupParticipant } from "@/components/groups/GroupMap";
import GroupParticipantStrip from "@/components/groups/GroupParticipantStrip";
import RouteTimeline from "@/components/groups/RouteTimeline";
import ElevationChart from "@/components/ElevationChart";
import EditGroupModal from "@/components/groups/EditGroupModal";
import GroupPrepPanel from "@/components/groups/GroupPrepPanel";
import AddPointModal from "@/components/groups/AddPointModal";
import WeatherSummaryCard from "@/components/weather/WeatherSummaryCard";
import TourEmergencyContactPicker from "@/components/TourEmergencyContactPicker";
import {
  ArrowLeft, Users, Clock, Play, Loader2, MapPin, TrendingUp, Flag, Moon, Car, Pencil,
} from "lucide-react";

const ACTIVITY_EMOJI: Record<string, string> = {
  WANDERN: "🥾", BERGTOUR: "⛰️", KLETTERN: "🧗", KLETTERSTEIG: "🪢",
  TRAILRUNNING: "🏃", MOUNTAINBIKE: "🚵", RADSPORT: "🚴",
  SKI_SNOWBOARD: "🎿", SKITOUR: "⛷️", KANU_KAJAK: "🛶",
  PARAGLIDING: "🪂", ANDERE: "🏔️",
};

function toTimeInputValue(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtDateTime(d: string | Date) {
  return new Date(d).toLocaleString("de-CH", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function TourGroupPage() {
  const { user, loading: authLoading, logout } = useAuthGuard();
  const params = useParams();
  const router = useRouter();
  const [group, setGroup] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehiclePlate, setNewVehiclePlate] = useState("");
  const [joining, setJoining] = useState(false);
  const [starting, setStarting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [placementMode, setPlacementMode] = useState<"waypoint" | "overnight" | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [startEta, setStartEta] = useState("17:00");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapRef = useRef<InteractivePlanningMapHandle>(null);

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user]);

  useEffect(() => {
    pollRef.current = setInterval(() => load(true), 12000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [params.id]);

  useRealtimeConnection((event) => {
    if (event.type === "location_update") {
      setGroup((prev: any) => {
        if (!prev) return prev;
        const tours = prev.tours.map((t: any) => t.id === event.tourId ? { ...t, lastLat: event.lat, lastLng: event.lng } : t);
        return { ...prev, tours };
      });
    }
    if (event.type === "tour_status_change") {
      setGroup((prev: any) => {
        if (!prev) return prev;
        const tours = prev.tours.map((t: any) => t.id === event.tourId ? { ...t, status: event.status } : t);
        return { ...prev, tours };
      });
    }
  });

  async function load(silent = false) {
    try {
      const token = getToken();
      const [data, vehiclesData, profileData] = await Promise.all([
        apiFetch(`/tour-groups/${params.id}`, {}, token ?? undefined),
        apiFetch("/vehicles", {}, token ?? undefined).catch(() => []),
        apiFetch("/profile", {}, token ?? undefined).catch(() => null),
      ]);
      setGroup(data);
      setVehicles(vehiclesData);
      setProfile(profileData);
      if (!silent && vehiclesData.length > 0 && !vehicleId) setVehicleId(vehiclesData[0].id);
      if (data.suggestedEta) setStartEta(toTimeInputValue(new Date(data.suggestedEta)));
    } catch (err) {
      if (!silent) setError(err instanceof ApiError ? err.message : "Gruppe konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddVehicle() {
    if (!newVehiclePlate.trim()) return;
    try {
      const token = getToken();
      const vehicle = await apiFetch("/vehicles", { method: "POST", body: JSON.stringify({ plate: newVehiclePlate.trim() }) }, token ?? undefined);
      setVehicles((prev) => [...prev, vehicle]);
      setVehicleId(vehicle.id);
      setNewVehiclePlate("");
      setShowAddVehicle(false);
    } catch {}
  }

  async function handleJoin() {
    setJoining(true);
    setActionError("");
    try {
      const token = getToken();
      await apiFetch(
        `/tour-groups/${group.id}/join`,
        { method: "POST", body: JSON.stringify({ eta: group.suggestedEta, vehicleId, emergencyContactIds: selectedContactIds }) },
        token ?? undefined
      );
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Beitreten fehlgeschlagen");
    } finally {
      setJoining(false);
    }
  }

  async function handleStart() {
    setStarting(true);
    setActionError("");
    try {
      const token = getToken();
      const [h, m] = startEta.split(":").map(Number);
      const eta = new Date();
      eta.setHours(h, m, 0, 0);
      if (eta.getTime() < Date.now()) eta.setDate(eta.getDate() + 1);
      await apiFetch(`/tour-groups/${group.id}/start`, { method: "POST", body: JSON.stringify({ eta: eta.toISOString() }) }, token ?? undefined);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Start fehlgeschlagen");
    } finally {
      setStarting(false);
    }
  }

  function handleMapClick(lat: number, lng: number) {
    setPendingPoint({ lat, lng });
  }

  async function handleSavePoint(data: { name: string; type: string; notes: string; day?: number }) {
    if (!pendingPoint || !placementMode) return;
    const { lat, lng } = pendingPoint;
    setPendingPoint(null);
    setPlacementMode(null);
    try {
      const token = getToken();
      if (placementMode === "waypoint") {
        const updated = await apiFetch(
          `/tour-groups/${group.id}/waypoints`,
          { method: "POST", body: JSON.stringify({ lat, lng, name: data.name, type: data.type, notes: data.notes, day: data.day }) },
          token ?? undefined
        );
        setGroup((prev: any) => ({ ...prev, waypoints: updated.waypoints }));
      } else {
        const night = (group.overnightStops?.length ?? 0) + 1;
        const updated = await apiFetch(
          `/tour-groups/${group.id}/overnight-stops`,
          { method: "POST", body: JSON.stringify({ lat, lng, name: data.name, stopType: data.type, notes: data.notes, night }) },
          token ?? undefined
        );
        setGroup((prev: any) => ({ ...prev, overnightStops: updated.overnightStops }));
      }
    } catch {}
  }

  if (authLoading || loading) {
    return <div className="min-h-screen bg-snow flex items-center justify-center text-stone text-sm">Lädt…</div>;
  }

  if (error || !group) {
    return (
      <div className="flex min-h-screen bg-snow">
        <Sidebar onLogout={logout} userName={user?.name} />
        <main className="flex-1 px-12 py-11 max-w-3xl">
          <button onClick={() => router.push("/dashboard/touren")} className="flex items-center gap-1.5 text-sm text-stone hover:text-forest-950 mb-6">
            <ArrowLeft className="w-4 h-4" /> Zurück
          </button>
          <p className="text-alarm text-sm">{error || "Gruppe nicht gefunden"}</p>
        </main>
      </div>
    );
  }

  const myTour = group.tours.find((t: any) => t.userId === user?.id);
  const hasJoined = !!myTour;
  const isOrganizer = group.organizerId === user?.id;
  const anyoneStarted = group.tours.some((t: any) => t.status !== "PLANNED");

  const participants: GroupParticipant[] = group.tours.map((t: any) => ({
    userId: t.userId,
    name: t.user?.name ?? "?",
    lat: t.lastLat ?? t.startLat ?? group.startLat ?? null,
    lng: t.lastLng ?? t.startLng ?? group.startLng ?? null,
    status: t.status,
  }));
  const pendingInvites = group.invites?.filter((i: any) => i.status === "PENDING") ?? [];
  const gpxPoints = group.gpxTrack?.points ?? [];
  const groupWaypoints = Array.isArray(group.waypoints) ? group.waypoints : [];
  const groupOvernights = Array.isArray(group.overnightStops) ? group.overnightStops : [];

  const canStartMine = hasJoined && myTour.status === "PLANNED" &&
    (group.startMode === "EACH_OWN" || (group.startMode === "ORGANIZER_STARTS_ALL" && isOrganizer));
  const startButtonLabel = group.startMode === "ORGANIZER_STARTS_ALL" && isOrganizer ? "Für alle starten" : "Tour starten";

  return (
    <div className="flex min-h-screen bg-snow">
      <Sidebar onLogout={logout} userName={user?.name} />

      <main className="flex-1 max-w-[1400px]">
        <div className="px-10 pt-9">
          <button onClick={() => router.push("/dashboard/touren")} className="flex items-center gap-1.5 text-sm text-stone hover:text-forest-950 mb-5 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Zurück zu Touren
          </button>
        </div>

        {/* HERO — the one bold element on this page: a big, dominant map
            with the tour identity and key numbers overlaid, instead of a
            plain heading followed by a modest map card among many other
            equally-weighted boxes. */}
        <div className="mx-10 rounded-3xl overflow-hidden relative shadow-card" style={{ height: "440px" }}>
          {anyoneStarted ? (
            <GroupMap
              participants={participants}
              routePoints={gpxPoints}
              waypoints={groupWaypoints}
              overnightStops={groupOvernights}
              parking={{ lat: group.parkingLat, lng: group.parkingLng, name: group.parkingLocation }}
            />
          ) : (
            <InteractivePlanningMap
              ref={mapRef}
              routePoints={gpxPoints}
              startLat={group.startLat}
              startLng={group.startLng}
              parking={{ lat: group.parkingLat, lng: group.parkingLng }}
              overnightStops={groupOvernights}
              waypoints={groupWaypoints}
              activeMode={placementMode}
              onSetParking={() => {}}
              onAddOvernightAt={handleMapClick}
              onAddWaypointAt={handleMapClick}
            />
          )}

          {/* Floating stat badges */}
          {group.distanceKm && (
            <div className="absolute top-5 right-5 flex gap-2 pointer-events-none">
              <span className="flex items-center gap-1.5 bg-white/95 backdrop-blur-sm rounded-full px-3.5 py-1.5 text-xs font-bold text-forest-950 shadow-md">
                <MapPin className="w-3 h-3 text-forest-700" /> {group.distanceKm} km
              </span>
              <span className="flex items-center gap-1.5 bg-white/95 backdrop-blur-sm rounded-full px-3.5 py-1.5 text-xs font-bold text-forest-950 shadow-md">
                <TrendingUp className="w-3 h-3 text-forest-700" /> {group.elevationUp ?? "—"} hm
              </span>
              {group.difficulty && (
                <span className="flex items-center gap-1.5 bg-white/95 backdrop-blur-sm rounded-full px-3.5 py-1.5 text-xs font-bold text-forest-950 shadow-md">
                  {group.difficulty}
                </span>
              )}
            </div>
          )}

          {/* Placement mode toggles */}
          {!anyoneStarted && (
            <div className="absolute top-5 left-5 flex gap-2">
              <button
                type="button"
                onClick={() => setPlacementMode(placementMode === "waypoint" ? null : "waypoint")}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-md transition-colors ${
                  placementMode === "waypoint" ? "bg-forest-950 text-white" : "bg-white/95 backdrop-blur-sm text-forest-950 hover:bg-white"
                }`}
              >
                <Flag className="w-3.5 h-3.5" /> Wegpunkt
              </button>
              <button
                type="button"
                onClick={() => setPlacementMode(placementMode === "overnight" ? null : "overnight")}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-md transition-colors ${
                  placementMode === "overnight" ? "bg-forest-950 text-white" : "bg-white/95 backdrop-blur-sm text-forest-950 hover:bg-white"
                }`}
              >
                <Moon className="w-3.5 h-3.5" /> Übernachtung
              </button>
              {group.parkingLat && (
                <button
                  type="button"
                  onClick={() => mapRef.current?.flyTo(group.parkingLat, group.parkingLng, 16)}
                  className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-md bg-white/95 backdrop-blur-sm text-forest-950 hover:bg-white transition-colors"
                >
                  <Car className="w-3.5 h-3.5" /> {group.parkingLocation || "Parkplatz"}
                </button>
              )}
            </div>
          )}

          {/* Bottom gradient scrim with title/organizer, and start button */}
          <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-forest-950/90 via-forest-950/40 to-transparent pointer-events-none" />
          <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
            <div>
              <p className="text-[11px] font-bold text-white/70 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                <Users className="w-3 h-3" /> Gemeinsame Tour
              </p>
              <div className="flex items-center gap-2.5">
                <h1 className="font-display text-3xl font-semibold text-white tracking-tight drop-shadow-sm">
                  {ACTIVITY_EMOJI[group.activity] ?? "🏔️"} {group.routeName || "Gemeinsame Tour"}
                </h1>
                {isOrganizer && !anyoneStarted && (
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="flex items-center gap-1 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold px-3 py-1.5 transition-colors shrink-0"
                  >
                    <Pencil className="w-3 h-3" /> Bearbeiten
                  </button>
                )}
              </div>
              <p className="text-white/70 text-sm mt-1">Organisiert von {group.organizer?.name}</p>
            </div>
            {canStartMine && (
              <div className="flex flex-col items-end gap-1.5">
                <button
                  onClick={handleStart}
                  disabled={starting}
                  className="flex items-center gap-2 bg-white text-forest-950 rounded-xl px-5 py-2.5 text-sm font-bold hover:bg-forest-50 transition-colors disabled:opacity-60 shadow-lg"
                >
                  {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {starting ? "Wird gestartet…" : startButtonLabel}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="px-10 py-7">
          {/* Start/return preview strip */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="rounded-2xl bg-forest-100/60 p-4">
              <p className="text-[10px] font-bold text-forest-700 uppercase tracking-wide mb-1">Geplanter Start</p>
              <p className="font-display text-base font-semibold text-forest-950">
                {group.suggestedStartAt ? fmtDateTime(group.suggestedStartAt) : "Noch nicht festgelegt"}
              </p>
            </div>
            <div className="rounded-2xl bg-forest-100/60 p-4">
              <p className="text-[10px] font-bold text-forest-700 uppercase tracking-wide mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Vorgeschlagene Rückkehr</p>
              <p className="font-display text-base font-semibold text-forest-950">
                {group.suggestedEta ? fmtDateTime(group.suggestedEta) : "Noch nicht festgelegt"}
              </p>
            </div>
          </div>

          {/* Participant strip — the roster as a living row of people, not
              a settings-style list. */}
          <div className="mb-7">
            <GroupParticipantStrip
              tours={group.tours}
              pendingInvites={pendingInvites}
              organizerId={group.organizerId}
              currentUserId={user?.id}
            />
          </div>

          <div className="grid grid-cols-3 gap-5">
            <div className="col-span-2 flex flex-col gap-5">
              {(group.parkingLocation || group.parkingLat) && (
                <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-forest-100 text-forest-700 flex items-center justify-center shrink-0">
                    <Car className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-stone uppercase tracking-wide">Parkplatz / Trailhead</p>
                    <p className="text-sm font-semibold text-forest-950 truncate">{group.parkingLocation || "Position auf der Karte gesetzt"}</p>
                    {group.parkingLat && group.parkingLng && (
                      <p className="text-xs text-stone">{Number(group.parkingLat).toFixed(5)}, {Number(group.parkingLng).toFixed(5)}</p>
                    )}
                  </div>
                  {group.parkingLat && group.parkingLng && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => mapRef.current?.flyTo(group.parkingLat, group.parkingLng, 16)}
                        className="text-xs font-semibold text-forest-700 hover:underline"
                      >
                        Auf Karte zeigen
                      </button>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${group.parkingLat},${group.parkingLng}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-lg bg-forest-100 text-forest-700 px-2.5 py-1.5 text-xs font-semibold hover:bg-forest-100/70 transition-colors"
                      >
                        In Karten-App öffnen
                      </a>
                    </div>
                  )}
                </div>
              )}

              {group.notes && (
                <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-5">
                  <h3 className="font-display font-semibold text-sm text-forest-950 mb-2">Notizen vom Organisator</h3>
                  <p className="text-sm text-forest-950/75 whitespace-pre-line">{group.notes}</p>
                </div>
              )}

              {gpxPoints.length > 1 && (
                <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-5">
                  <h3 className="font-display font-semibold text-sm text-forest-950 mb-3">Höhenprofil</h3>
                  <ElevationChart points={gpxPoints} />
                </div>
              )}

              <RouteTimeline
                groupId={group.id}
                startAt={group.suggestedStartAt}
                overnightStops={groupOvernights}
                waypoints={groupWaypoints}
                routePoints={gpxPoints}
                activity={group.activity}
                currentUserId={user?.id}
                isOrganizer={isOrganizer}
                onChange={(patch) => setGroup((prev: any) => ({ ...prev, ...patch }))}
                onJumpToMap={(lat, lng) => mapRef.current?.flyTo(lat, lng)}
              />

              {pendingPoint && placementMode && (
                <AddPointModal
                  kind={placementMode}
                  totalDays={groupOvernights.length + 1}
                  onSave={handleSavePoint}
                  onCancel={() => setPendingPoint(null)}
                />
              )}

              {!hasJoined && (
                <div className="rounded-2xl border border-forest-700/20 bg-forest-100/50 p-6">
                  <h3 className="font-display font-semibold text-forest-950 mb-1">Deine Angaben</h3>
                  <p className="text-sm text-stone mb-5">
                    Route, Aktivität und die vorgeschlagene Rückkehrzeit sind von {group.organizer?.name} übernommen — Fahrzeug und Notfallkontakte fehlen noch. Die genaue Rückkehrzeit legst du beim tatsächlichen Start fest.
                  </p>

                  <div className="mb-5 max-w-xs">
                    <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Fahrzeug</label>
                    {vehicles.length === 0 || showAddVehicle ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newVehiclePlate}
                          onChange={(e) => setNewVehiclePlate(e.target.value)}
                          placeholder="Kennzeichen"
                          className="flex-1 rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-forest-700/30"
                        />
                        <button onClick={handleAddVehicle} className="rounded-xl bg-forest-700 text-white px-3.5 text-sm font-semibold hover:bg-forest-600 transition-colors">
                          OK
                        </button>
                      </div>
                    ) : (
                      <select
                        value={vehicleId ?? ""}
                        onChange={(e) => (e.target.value === "_new" ? setShowAddVehicle(true) : setVehicleId(e.target.value))}
                        className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-forest-700/30"
                      >
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>{v.plate}</option>
                        ))}
                        <option value="_new">+ Neues Fahrzeug</option>
                      </select>
                    )}
                  </div>

                  <div className="mb-5">
                    <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Notfallkontakte für diese Tour</label>
                    <TourEmergencyContactPicker
                      allContacts={profile?.emergencyContacts ?? []}
                      selectedIds={selectedContactIds}
                      onChange={setSelectedContactIds}
                    />
                  </div>

                  {actionError && (
                    <div className="bg-alarm-50 border border-alarm-100 text-alarm text-sm rounded-xl px-4 py-3 mb-4">{actionError}</div>
                  )}

                  <button
                    onClick={handleJoin}
                    disabled={joining}
                    className="flex items-center gap-2 bg-forest-700 text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-forest-600 transition-colors disabled:opacity-60"
                  >
                    {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                    {joining ? "Wird beigetreten…" : "Mitmachen"}
                  </button>
                </div>
              )}

              {canStartMine && (
                <div className="rounded-2xl border border-forest-700/20 bg-forest-100/50 p-6">
                  <h3 className="font-display font-semibold text-forest-950 mb-1">Bereit loszugehen?</h3>
                  <p className="text-sm text-stone mb-4">Bestätige oder passe deine Rückkehrzeit an — das ist dein persönlicher Sicherheits-Timer.</p>
                  <div className="flex items-end gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Meine Rückkehrzeit</label>
                      <input
                        type="time"
                        value={startEta}
                        onChange={(e) => setStartEta(e.target.value)}
                        className="rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-forest-700/30"
                      />
                    </div>
                  </div>
                  {actionError && (
                    <div className="bg-alarm-50 border border-alarm-100 text-alarm text-sm rounded-xl px-4 py-3 mt-4">{actionError}</div>
                  )}
                </div>
              )}
            </div>

            {/* Right column: weather + prep tools */}
            <div className="flex flex-col gap-5">
              {group.startLat && group.startLng && (
                <WeatherSummaryCard
                  lat={group.startLat}
                  lng={group.startLng}
                  activity={group.activity}
                  detailHref={`/dashboard/wetter?lat=${group.startLat}&lng=${group.startLng}&activity=${group.activity ?? ""}&label=${encodeURIComponent(group.routeName || "Gemeinsame Tour")}&back=${encodeURIComponent(`/dashboard/gruppen/${group.id}`)}`}
                />
              )}

              <GroupPrepPanel groupId={group.id} currentUserId={user?.id} />

              <p className="text-[11px] text-stone flex items-start gap-1.5 px-1">
                Jede Person hat ihre eigene Rückkehrzeit und eigene Notfallkontakte — unabhängig erkannt. Notfallkontakte anderer Teilnehmer sind im Ersthelfer-Portal hinterlegt, nicht hier sichtbar.
              </p>
            </div>
          </div>
        </div>
      </main>

      {showEditModal && (
        <EditGroupModal
          group={group}
          onSave={(updated) => { setGroup((prev: any) => ({ ...prev, ...updated })); setShowEditModal(false); }}
          onCancel={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
}
