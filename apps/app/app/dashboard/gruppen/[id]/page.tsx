"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuth";
import { apiFetch, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRealtimeConnection } from "@/lib/realtime";
import Sidebar from "@/components/Sidebar";
import RouteMap from "@/components/RouteMap";
import GroupMap, { GroupParticipant } from "@/components/groups/GroupMap";
import GroupMessageBoard from "@/components/groups/GroupMessageBoard";
import { ArrowLeft, Users, Clock, UserPlus, Radio, Play, Loader2, Car } from "lucide-react";

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

export default function TourGroupPage() {
  const { user, loading: authLoading, logout } = useAuthGuard();
  const params = useParams();
  const router = useRouter();
  const [group, setGroup] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [returnTime, setReturnTime] = useState("17:00");
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehiclePlate, setNewVehiclePlate] = useState("");
  const [joining, setJoining] = useState(false);
  const [starting, setStarting] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user]);

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

  async function load() {
    try {
      const token = getToken();
      const [data, vehiclesData] = await Promise.all([
        apiFetch(`/tour-groups/${params.id}`, {}, token ?? undefined),
        apiFetch("/vehicles", {}, token ?? undefined).catch(() => []),
      ]);
      setGroup(data);
      setVehicles(vehiclesData);
      if (vehiclesData.length > 0) setVehicleId(vehiclesData[0].id);
      if (data.suggestedEta) setReturnTime(toTimeInputValue(new Date(data.suggestedEta)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gruppe konnte nicht geladen werden");
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

  // Joining: creates the participant's own Tour pre-filled from the
  // group's route — no route re-entry, just the genuinely individual
  // fields (return time, vehicle).
  async function handleJoin() {
    setJoining(true);
    setActionError("");
    try {
      const token = getToken();
      const [h, m] = returnTime.split(":").map(Number);
      const eta = new Date();
      eta.setHours(h, m, 0, 0);
      if (eta.getTime() < Date.now()) eta.setDate(eta.getDate() + 1);

      await apiFetch(
        `/tour-groups/${group.id}/join`,
        { method: "POST", body: JSON.stringify({ eta: eta.toISOString(), vehicleId }) },
        token ?? undefined
      );
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Beitreten fehlgeschlagen");
    } finally {
      setJoining(false);
    }
  }

  // Starting: behaviour depends on the group's startMode — either starts
  // only my own tour, or (if I'm the organizer with ORGANIZER_STARTS_ALL)
  // starts everyone's at once.
  async function handleStart() {
    setStarting(true);
    setActionError("");
    try {
      const token = getToken();
      await apiFetch(`/tour-groups/${group.id}/start`, { method: "POST" }, token ?? undefined);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Start fehlgeschlagen");
    } finally {
      setStarting(false);
    }
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

  // What can I do right now?
  const canStartMine = hasJoined && myTour.status === "PLANNED" &&
    (group.startMode === "EACH_OWN" || (group.startMode === "ORGANIZER_STARTS_ALL" && isOrganizer));
  const startButtonLabel = group.startMode === "ORGANIZER_STARTS_ALL" && isOrganizer ? "Tour für alle starten" : "Tour starten";

  return (
    <div className="flex min-h-screen bg-snow">
      <Sidebar onLogout={logout} userName={user?.name} />

      <main className="flex-1 px-12 py-11 max-w-4xl">
        <button onClick={() => router.push("/dashboard/touren")} className="flex items-center gap-1.5 text-sm text-stone hover:text-forest-950 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Zurück zu Touren
        </button>

        <div className="flex items-start justify-between mb-7">
          <div>
            <p className="text-xs font-semibold text-forest-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Gemeinsame Tour
            </p>
            <h1 className="font-display text-3xl font-semibold text-forest-950 tracking-tight">
              {ACTIVITY_EMOJI[group.activity] ?? "🏔️"} {group.routeName || "Gemeinsame Tour"}
            </h1>
            <p className="text-stone text-sm mt-1">Organisiert von {group.organizer?.name}</p>
          </div>
          {canStartMine && (
            <button
              onClick={handleStart}
              disabled={starting}
              className="flex items-center gap-2 bg-forest-700 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-forest-600 transition-colors disabled:opacity-60 shrink-0"
            >
              {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {starting ? "Wird gestartet…" : startButtonLabel}
            </button>
          )}
        </div>

        {/* Route map — always from the group itself, shows live positions
            once anyone has started. */}
        <div className="rounded-2xl overflow-hidden border border-forest-950/[0.07] shadow-card h-80 mb-6">
          {anyoneStarted ? (
            <GroupMap participants={participants} />
          ) : (
            <RouteMap
              locations={[]}
              startLat={group.startLat}
              startLng={group.startLng}
              plannedRoute={gpxPoints}
              waypoints={group.waypoints}
              overnightStops={group.overnightStops}
              parking={{ lat: group.parkingLat, lng: group.parkingLng, name: group.parkingLocation }}
            />
          )}
        </div>

        {group.distanceKm && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="rounded-xl bg-white border border-forest-950/[0.06] shadow-card p-3.5 text-center">
              <p className="text-[11px] text-stone mb-0.5">Distanz</p>
              <p className="font-display text-base font-semibold text-forest-950">{group.distanceKm} km</p>
            </div>
            <div className="rounded-xl bg-white border border-forest-950/[0.06] shadow-card p-3.5 text-center">
              <p className="text-[11px] text-stone mb-0.5">Höhenmeter</p>
              <p className="font-display text-base font-semibold text-forest-950">{group.elevationUp ?? "—"} hm</p>
            </div>
            <div className="rounded-xl bg-white border border-forest-950/[0.06] shadow-card p-3.5 text-center">
              <p className="text-[11px] text-stone mb-0.5">Vorgeschlagene Rückkehr</p>
              <p className="font-display text-base font-semibold text-forest-950">
                {group.suggestedEta ? new Date(group.suggestedEta).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" }) : "—"}
              </p>
            </div>
          </div>
        )}

        {/* Join panel — only shown before I've joined. */}
        {!hasJoined && (
          <div className="rounded-2xl border border-forest-700/20 bg-forest-100/50 p-6 mb-6">
            <h3 className="font-display font-semibold text-forest-950 mb-1">Deine Angaben</h3>
            <p className="text-sm text-stone mb-5">
              Route und Aktivität sind von {group.organizer?.name} übernommen — nur deine Rückkehrzeit und dein Fahrzeug fehlen noch.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Erwartete Rückkehr</label>
                <input
                  type="time"
                  value={returnTime}
                  onChange={(e) => setReturnTime(e.target.value)}
                  className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700"
                />
              </div>
              <div>
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
            <p className="text-xs text-stone mt-2.5">
              {group.startMode === "ORGANIZER_STARTS_ALL"
                ? `${group.organizer?.name} startet die Tour für alle gemeinsam.`
                : "Du startest deine eigene Tour selbst, sobald du am Trailhead bist."}
            </p>
          </div>
        )}

        {hasJoined && myTour.status === "PLANNED" && actionError && (
          <div className="bg-alarm-50 border border-alarm-100 text-alarm text-sm rounded-xl px-4 py-3 mb-6">{actionError}</div>
        )}

        {/* Participants list — each with their own independent status. */}
        <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-6 mb-6">
          <h3 className="font-display font-semibold text-sm text-forest-950 mb-4">Teilnehmer · {group.tours.length}</h3>
          <div className="space-y-3">
            {group.tours.map((t: any, i: number) => {
              const status = statusLabel(t.status);
              const color = PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length];
              return (
                <div
                  key={t.id}
                  onClick={() => router.push(`/dashboard/touren/${t.id}`)}
                  className="flex items-center gap-3 cursor-pointer hover:bg-forest-100/30 rounded-xl p-2 -mx-2 transition-colors"
                >
                  <div
                    className="w-9 h-9 rounded-full text-white flex items-center justify-center font-display font-semibold text-sm shrink-0"
                    style={{ background: t.status === "ALARM" ? "#ba1a1a" : color }}
                  >
                    {(t.user?.name ?? "?")[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-forest-950 truncate">
                      {t.user?.name}{t.userId === user?.id ? " (du)" : ""}
                      {t.userId === group.organizerId && <span className="text-[10px] text-forest-700 font-bold ml-1.5">ORGANISATOR</span>}
                    </p>
                    <p className={`text-xs ${status.cls}`}>{status.text}</p>
                  </div>
                  {t.eta && (
                    <span className="text-xs text-stone flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {new Date(t.eta).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {pendingInvites.length > 0 && (
            <div className="mt-4 pt-4 border-t border-forest-950/[0.06] flex items-center gap-2 text-xs text-stone">
              <UserPlus className="w-3.5 h-3.5" />
              {pendingInvites.length} Einladung{pendingInvites.length !== 1 ? "en" : ""} noch ausstehend
              {pendingInvites.map((i: any) => ` · ${i.invitee?.name}`).join("")}
            </div>
          )}
        </div>

        {/* Prep-phase coordination board */}
        <div className="mb-6">
          <GroupMessageBoard groupId={group.id} currentUserId={user?.id} />
        </div>

        <p className="text-xs text-stone flex items-center gap-1.5">
          <Radio className="w-3 h-3" /> Jede Person hat ihre eigene Rückkehrzeit und eigene Notfallkontakte — eine Verspätung bei einer Person wird unabhängig von den anderen erkannt.
        </p>
      </main>
    </div>
  );
}
