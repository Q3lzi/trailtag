"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuth";
import { apiFetch, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRealtimeConnection } from "@/lib/realtime";
import Sidebar from "@/components/Sidebar";
import InteractivePlanningMap from "@/components/InteractivePlanningMap";
import GroupMap, { GroupParticipant } from "@/components/groups/GroupMap";
import GroupMessageBoard from "@/components/groups/GroupMessageBoard";
import GroupChecklist from "@/components/groups/GroupChecklist";
import WeatherSummaryCard from "@/components/weather/WeatherSummaryCard";
import {
  ArrowLeft, Users, Clock, UserPlus, Radio, Play, Loader2, MapPin, TrendingUp, Flag,
  Calendar, ShieldCheck, AlertCircle, Car,
} from "lucide-react";

const ACTIVITY_EMOJI: Record<string, string> = {
  WANDERN: "🥾", BERGTOUR: "⛰️", KLETTERN: "🧗", KLETTERSTEIG: "🪢",
  TRAILRUNNING: "🏃", MOUNTAINBIKE: "🚵", RADSPORT: "🚴",
  SKI_SNOWBOARD: "🎿", SKITOUR: "⛷️", KANU_KAJAK: "🛶",
  PARAGLIDING: "🪂", ANDERE: "🏔️",
};

const PARTICIPANT_COLORS = ["#2c694e", "#1d4ed8", "#dc2626", "#ea580c", "#7c3aed", "#0891b2"];

function statusLabel(status: string) {
  if (status === "ACTIVE") return { text: "Unterwegs", cls: "text-forest-700" };
  if (status === "ALARM") return { text: "Überfällig", cls: "text-alarm font-semibold" };
  if (status === "COMPLETED") return { text: "Zurück", cls: "text-stone" };
  return { text: "Bereit zum Start", cls: "text-stone" };
}

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
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehiclePlate, setNewVehiclePlate] = useState("");
  const [joining, setJoining] = useState(false);
  const [starting, setStarting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [waypointMode, setWaypointMode] = useState(false);
  // Editable only at the moment of actually starting — before that, the
  // group's suggested return time is shown as a fixed preview, not
  // something to fiddle with ahead of time.
  const [startEta, setStartEta] = useState("17:00");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user]);

  // Poll for changes others make (new joins, checklist, waypoints) — the
  // realtime socket only covers location/status events, not every kind of
  // group edit, so this fills the gap without requiring a manual reload.
  useEffect(() => {
    pollRef.current = setInterval(() => load(true), 12000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [params.id]);

  useRealtimeConnection((event) => {
    if (event.type === "location_update") {
      setGroup((prev: any) => {
        if (!prev) return prev;
        const tours = prev.tours.map((t: any) =>
          t.id === event.tourId ? { ...t, lastLat: event.lat, lastLng: event.lng } : t
        );
        return { ...prev, tours };
      });
    }
    if (event.type === "tour_status_change") {
      setGroup((prev: any) => {
        if (!prev) return prev;
        const tours = prev.tours.map((t: any) =>
          t.id === event.tourId ? { ...t, status: event.status } : t
        );
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

  // Joining no longer asks for a return time — that's the group's
  // suggestion, shown as a fixed preview. Only the vehicle (and, later at
  // actual start, the real ETA) is genuinely individual right now.
  async function handleJoin() {
    setJoining(true);
    setActionError("");
    try {
      const token = getToken();
      await apiFetch(
        `/tour-groups/${group.id}/join`,
        { method: "POST", body: JSON.stringify({ eta: group.suggestedEta, vehicleId }) },
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

  async function handleAddWaypoint(lat: number, lng: number) {
    setWaypointMode(false);
    try {
      const token = getToken();
      const updated = await apiFetch(
        `/tour-groups/${group.id}/waypoints`,
        { method: "POST", body: JSON.stringify({ lat, lng }) },
        token ?? undefined
      );
      setGroup((prev: any) => ({ ...prev, waypoints: updated.waypoints }));
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
  const hasEmergencyContacts = (profile?.emergencyContacts?.length ?? 0) > 0;

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

  const canStartMine = hasJoined && myTour.status === "PLANNED" &&
    (group.startMode === "EACH_OWN" || (group.startMode === "ORGANIZER_STARTS_ALL" && isOrganizer));
  const startButtonLabel = group.startMode === "ORGANIZER_STARTS_ALL" && isOrganizer ? "Tour für alle starten" : "Tour starten";

  return (
    <div className="flex min-h-screen bg-snow">
      <Sidebar onLogout={logout} userName={user?.name} />

      <main className="flex-1 px-10 py-9 max-w-[1400px]">
        <button onClick={() => router.push("/dashboard/touren")} className="flex items-center gap-1.5 text-sm text-stone hover:text-forest-950 mb-5 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Zurück zu Touren
        </button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs font-semibold text-forest-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Gemeinsame Tour
            </p>
            <h1 className="font-display text-2xl font-semibold text-forest-950 tracking-tight">
              {ACTIVITY_EMOJI[group.activity] ?? "🏔️"} {group.routeName || "Gemeinsame Tour"}
            </h1>
            <p className="text-stone text-sm mt-1">Organisiert von {group.organizer?.name}</p>
          </div>
        </div>

        {/* Start / return overview — the thing that was completely missing:
            when does this begin, how long does it take, what's the plan.
            Shown as a fixed preview, never an input — that only happens
            once, at the moment of actually starting below. */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-2xl bg-forest-950 p-5">
            <p className="text-[11px] font-bold text-forest-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Geplanter Start
            </p>
            <p className="font-display text-lg font-semibold text-white">
              {group.suggestedStartAt ? fmtDateTime(group.suggestedStartAt) : "Noch nicht festgelegt"}
            </p>
          </div>
          <div className="rounded-2xl bg-forest-950 p-5">
            <p className="text-[11px] font-bold text-forest-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Vorgeschlagene Rückkehr
            </p>
            <p className="font-display text-lg font-semibold text-white">
              {group.suggestedEta ? fmtDateTime(group.suggestedEta) : "Noch nicht festgelegt"}
            </p>
          </div>
        </div>

        {/* Two-column layout: left = map + planning tools (wide), right =
            sticky status/participants/weather (narrow). */}
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 flex flex-col gap-5">
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <button
                  type="button"
                  onClick={() => setWaypointMode(!waypointMode)}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-colors ${
                    waypointMode ? "bg-forest-950 text-white border-forest-950" : "bg-white text-forest-950/70 border-forest-950/15 hover:border-forest-950/30"
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" /> Wegpunkt vorschlagen
                </button>
                {waypointMode && <p className="text-xs text-forest-700 font-medium">Klick auf die Karte, um einen Punkt vorzuschlagen.</p>}
              </div>
              <div className="rounded-2xl overflow-hidden border border-forest-950/[0.07] shadow-card h-96">
                {anyoneStarted ? (
                  <GroupMap participants={participants} />
                ) : (
                  <InteractivePlanningMap
                    routePoints={gpxPoints}
                    startLat={group.startLat}
                    startLng={group.startLng}
                    parking={{ lat: group.parkingLat, lng: group.parkingLng }}
                    overnightStops={group.overnightStops ?? []}
                    waypoints={groupWaypoints}
                    activeMode={waypointMode ? "waypoint" : null}
                    onSetParking={() => {}}
                    onAddOvernightAt={() => {}}
                    onAddWaypointAt={handleAddWaypoint}
                  />
                )}
              </div>
            </div>

            {group.distanceKm && (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-white border border-forest-950/[0.06] shadow-card p-3.5 text-center">
                  <p className="text-[11px] text-stone mb-0.5 flex items-center justify-center gap-1"><MapPin className="w-3 h-3" /> Distanz</p>
                  <p className="font-display text-base font-semibold text-forest-950">{group.distanceKm} km</p>
                </div>
                <div className="rounded-xl bg-white border border-forest-950/[0.06] shadow-card p-3.5 text-center">
                  <p className="text-[11px] text-stone mb-0.5 flex items-center justify-center gap-1"><TrendingUp className="w-3 h-3" /> Höhenmeter</p>
                  <p className="font-display text-base font-semibold text-forest-950">{group.elevationUp ?? "—"} hm</p>
                </div>
                <div className="rounded-xl bg-white border border-forest-950/[0.06] shadow-card p-3.5 text-center">
                  <p className="text-[11px] text-stone mb-0.5 flex items-center justify-center gap-1"><Car className="w-3 h-3" /> Parkplatz</p>
                  <p className="font-display text-sm font-semibold text-forest-950 truncate">{group.parkingLocation || "—"}</p>
                </div>
              </div>
            )}

            {/* Join panel — vehicle only; return time is shown above as a
                fixed group preview, set for real at the moment of starting. */}
            {!hasJoined && (
              <div className="rounded-2xl border border-forest-700/20 bg-forest-100/50 p-6">
                <h3 className="font-display font-semibold text-forest-950 mb-1">Deine Angaben</h3>
                <p className="text-sm text-stone mb-5">
                  Route, Aktivität und die vorgeschlagene Rückkehrzeit sind von {group.organizer?.name} übernommen — nur dein Fahrzeug fehlt noch. Die genaue Rückkehrzeit legst du beim tatsächlichen Start fest.
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

                {/* Emergency contact confirmation — never shows anyone
                    else's contacts (that's what the rescue portal is for),
                    just confirms my own are on file. */}
                <div className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 mb-5 text-sm ${hasEmergencyContacts ? "bg-forest-100/70 text-forest-700" : "bg-amber-50 text-amber-800"}`}>
                  {hasEmergencyContacts ? <ShieldCheck className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  {hasEmergencyContacts
                    ? "Deine Notfallkontakte sind hinterlegt."
                    : <>Noch keine Notfallkontakte hinterlegt — <a href="/dashboard/profil" className="underline font-medium">jetzt im Profil ergänzen</a>.</>}
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

            {/* Start panel — the actual ETA gets set/confirmed right here,
                at the moment it matters, not speculatively days earlier. */}
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
                  <button
                    onClick={handleStart}
                    disabled={starting}
                    className="flex items-center gap-2 bg-forest-700 text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-forest-600 transition-colors disabled:opacity-60"
                  >
                    {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    {starting ? "Wird gestartet…" : startButtonLabel}
                  </button>
                </div>
                {actionError && (
                  <div className="bg-alarm-50 border border-alarm-100 text-alarm text-sm rounded-xl px-4 py-3 mt-4">{actionError}</div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-5">
              <GroupChecklist groupId={group.id} />
              <GroupMessageBoard groupId={group.id} currentUserId={user?.id} />
            </div>
          </div>

          {/* Right column: sticky status overview */}
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-5 sticky top-9">
              <h3 className="font-display font-semibold text-sm text-forest-950 mb-4">Teilnehmer · {group.tours.length}</h3>
              <div className="space-y-3 mb-4">
                {group.tours.map((t: any, i: number) => {
                  const status = statusLabel(t.status);
                  const color = PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length];
                  return (
                    <div
                      key={t.id}
                      onClick={() => router.push(t.userId === user?.id ? `/dashboard/touren/${t.id}` : `/dashboard/freunde/${t.userId}`)}
                      className="flex items-center gap-2.5 cursor-pointer hover:bg-forest-100/30 rounded-xl p-1.5 -mx-1.5 transition-colors"
                    >
                      <div
                        className="w-8 h-8 rounded-full text-white flex items-center justify-center font-display font-semibold text-xs shrink-0"
                        style={{ background: t.status === "ALARM" ? "#ba1a1a" : color }}
                      >
                        {(t.user?.name ?? "?")[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-forest-950 truncate">
                          {t.user?.name}{t.userId === user?.id ? " (du)" : ""}
                        </p>
                        <p className={`text-[11px] ${status.cls}`}>
                          {status.text}{t.userId === group.organizerId ? " · Organisator" : ""}
                        </p>
                      </div>
                      {t.eta && (
                        <span className="text-[11px] text-stone shrink-0">
                          {new Date(t.eta).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {pendingInvites.length > 0 && (
                <div className="pt-3 border-t border-forest-950/[0.06] flex items-start gap-2 text-xs text-stone">
                  <UserPlus className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{pendingInvites.length} Einladung{pendingInvites.length !== 1 ? "en" : ""} ausstehend: {pendingInvites.map((i: any) => i.invitee?.name).join(", ")}</span>
                </div>
              )}
            </div>

            {group.startLat && group.startLng && (
              <WeatherSummaryCard
                lat={group.startLat}
                lng={group.startLng}
                activity={group.activity}
                detailHref={`/dashboard/wetter?lat=${group.startLat}&lng=${group.startLng}&activity=${group.activity ?? ""}&label=${encodeURIComponent(group.routeName || "Gemeinsame Tour")}&back=${encodeURIComponent(`/dashboard/gruppen/${group.id}`)}`}
              />
            )}

            <p className="text-[11px] text-stone flex items-start gap-1.5 px-1">
              <Radio className="w-3 h-3 shrink-0 mt-0.5" /> Jede Person hat ihre eigene Rückkehrzeit und eigene Notfallkontakte — unabhängig erkannt. Notfallkontakte anderer Teilnehmer sind im Ersthelfer-Portal hinterlegt, nicht hier sichtbar.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
