"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuth";
import { apiFetch, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import InteractivePlanningMap from "@/components/InteractivePlanningMap";
import { ACTIVITIES, SAC_LEVELS, KLETTERSTEIG_GRADES, MTB_SCALES, AVALANCHE_RISKS } from "@/components/create-tour/types";
import {
  ArrowLeft, Upload, CheckCircle2, X, Users, MapPin, TrendingUp, TrendingDown,
  Clock, ParkingSquare, Loader2, Play,
} from "lucide-react";

function toTimeInputValue(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function toDateInputValue(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function mergeDateTime(dateStr: string, timeStr: string, fallback: Date) {
  const [y, mo, da] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  const next = new Date(fallback);
  if (y && mo && da) next.setFullYear(y, mo - 1, da);
  if (!isNaN(h) && !isNaN(mi)) next.setHours(h, mi, 0, 0);
  return next;
}
function addDays(d: Date, days: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Standalone flow for organizing a shared hike — deliberately separate
 * from the solo wizard, since a group hike has different concepts
 * (route lives on the group itself, a start mode, a suggested return time
 * instead of a personal one) that don't map onto the per-person fields
 * the solo wizard collects.
 */
export default function NewGroupTourPage() {
  const { user, loading: authLoading, logout } = useAuthGuard();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activity, setActivity] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [groupNotes, setGroupNotes] = useState("");
  const [routeName, setRouteName] = useState("");
  const [gpxData, setGpxData] = useState<any | null>(null);
  const [gpxRawContent, setGpxRawContent] = useState<string | null>(null);
  const [parking, setParking] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [parkingName, setParkingName] = useState("");
  const [mapMode, setMapMode] = useState<"parking" | null>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [inviteeIds, setInviteeIds] = useState<string[]>([]);
  const [startMode, setStartMode] = useState<"EACH_OWN" | "ORGANIZER_STARTS_ALL">("EACH_OWN");

  const [startAt, setStartAt] = useState(() => {
    const d = new Date();
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    return d;
  });
  const [multiDay, setMultiDay] = useState(false);
  const [returnDays, setReturnDays] = useState(2);
  const [suggestedEta, setSuggestedEta] = useState(() => new Date(Date.now() + 6 * 60 * 60 * 1000));

  const [dataLoading, setDataLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [gpxError, setGpxError] = useState("");
  const [error, setError] = useState("");

  function handleStartChange(next: Date) {
    const offsetDays = multiDay ? Math.max(1, returnDays - 1) : 0;
    const targetDate = addDays(next, offsetDays);
    const alignedEta = new Date(targetDate);
    alignedEta.setHours(suggestedEta.getHours(), suggestedEta.getMinutes(), 0, 0);
    setStartAt(next);
    setSuggestedEta(alignedEta);
  }

  function handleMultiDayToggle(checked: boolean) {
    const days = checked ? Math.max(2, returnDays) : 1;
    setMultiDay(checked);
    setReturnDays(days);
    const offsetDays = checked ? Math.max(1, days - 1) : 0;
    const targetDate = addDays(startAt, offsetDays);
    const aligned = new Date(targetDate);
    aligned.setHours(suggestedEta.getHours(), suggestedEta.getMinutes(), 0, 0);
    setSuggestedEta(aligned);
  }

  function handleReturnDaysChange(days: number) {
    const clamped = Math.max(2, Math.min(14, days || 2));
    setReturnDays(clamped);
    const targetDate = addDays(startAt, clamped - 1);
    const aligned = new Date(targetDate);
    aligned.setHours(suggestedEta.getHours(), suggestedEta.getMinutes(), 0, 0);
    setSuggestedEta(aligned);
  }

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user]);

  async function load() {
    try {
      const token = getToken();
      const data = await apiFetch("/friends", {}, token ?? undefined).catch(() => ({ friends: [] }));
      setFriends(data.friends ?? []);
    } finally {
      setDataLoading(false);
    }
  }

  async function handleGpxUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setGpxError("");
    try {
      const text = await file.text();
      const token = getToken();
      const data = await apiFetch("/gpx/parse", { method: "POST", body: JSON.stringify({ gpxContent: text }) }, token ?? undefined);
      setGpxData(data);
      setGpxRawContent(text);
      if (!routeName) setRouteName(data.routeName || "");
    } catch (err: any) {
      setGpxError(err.message ?? "GPX-Datei konnte nicht gelesen werden");
    }
  }

  function toggleInvitee(id: string) {
    setInviteeIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  async function handleCreate() {
    if (!activity) {
      setError("Wähle eine Aktivität.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const token = getToken();

      const group = await apiFetch(
        "/tour-groups",
        {
          method: "POST",
          body: JSON.stringify({
            routeName: routeName || null,
            activity,
            inviteeIds,
            startMode,
            suggestedStartAt: startAt.toISOString(),
            suggestedEta: suggestedEta.toISOString(),
            startLat: gpxData?.startLat ?? null,
            startLng: gpxData?.startLng ?? null,
            distanceKm: gpxData?.distanceKm ?? null,
            elevationUp: gpxData?.elevationUp ?? null,
            parkingLocation: parkingName || null,
            parkingLat: parking.lat,
            parkingLng: parking.lng,
            waypoints: gpxData?.waypoints ?? null,
            difficulty: difficulty || null,
            notes: groupNotes || null,
          }),
        },
        token ?? undefined
      );

      // Attach the full GPX track separately, same pattern as the solo
      // wizard — the parsed summary above only carries distance/elevation,
      // not the full point-by-point route for the map.
      if (gpxRawContent) {
        await apiFetch(`/gpx/attach-group/${group.id}`, { method: "POST", body: JSON.stringify({ gpxContent: gpxRawContent }) }, token ?? undefined).catch(() => {});
      }

      router.push(`/dashboard/gruppen/${group.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gruppe konnte nicht erstellt werden");
      setSubmitting(false);
    }
  }

  if (authLoading || dataLoading) {
    return <div className="min-h-screen bg-snow flex items-center justify-center text-stone text-sm">Lädt…</div>;
  }

  const routePoints = gpxData?.points ?? [];

  return (
    <div className="flex min-h-screen bg-snow">
      <Sidebar onLogout={logout} userName={user?.name} />

      <main className="flex-1 px-12 py-11 max-w-2xl">
        <button
          onClick={() => router.push("/dashboard/touren/neu")}
          className="flex items-center gap-1.5 text-sm text-stone hover:text-forest-950 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Zurück
        </button>

        <div className="mb-7">
          <p className="text-xs font-semibold text-forest-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Gemeinsame Tour
          </p>
          <h1 className="font-display text-2xl font-semibold text-forest-950 tracking-tight">Wanderung organisieren</h1>
          <p className="text-stone text-sm mt-1.5">
            Plane die Route einmal — jeder Eingeladene sieht sie und ergänzt nur seine eigene Rückkehrzeit und sein Fahrzeug.
          </p>
        </div>

        {/* Activity */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-forest-950/70 mb-2">Aktivität</label>
          <div className="grid grid-cols-4 gap-2">
            {ACTIVITIES.slice(0, 8).map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => setActivity(a.key)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all ${
                  activity === a.key ? "border-forest-700 bg-forest-100" : "border-forest-950/[0.08] bg-white hover:border-forest-950/20"
                }`}
              >
                <span className="text-xl">{a.emoji}</span>
                <span className={`text-[10px] font-medium ${activity === a.key ? "text-forest-700" : "text-forest-950/60"}`}>{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Route name */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Name der Tour</label>
          <input
            type="text"
            value={routeName}
            onChange={(e) => setRouteName(e.target.value)}
            placeholder="z. B. Lidernenhütte – Spilauer See"
            className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700"
          />
        </div>

        {/* GPX upload + map */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-forest-950/70 mb-2">Route</label>
          {!gpxData ? (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-forest-950/15 hover:border-forest-700/40 py-6 text-sm text-stone transition-colors"
              >
                <Upload className="w-4 h-4" /> GPX-Datei hochladen
              </button>
              <input ref={fileInputRef} type="file" accept=".gpx" onChange={handleGpxUpload} className="hidden" />
              {gpxError && <p className="text-xs text-alarm mt-2">{gpxError}</p>}
            </>
          ) : (
            <div className="flex items-center justify-between mb-3 rounded-xl border border-forest-700/20 bg-forest-100 px-4 py-2.5">
              <div className="flex items-center gap-2 text-forest-700">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-semibold">{gpxData.routeName || "Route geladen"}</span>
              </div>
              <button onClick={() => { setGpxData(null); setGpxRawContent(null); }} className="text-stone hover:text-alarm transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {gpxData && (
            <>
              <div className="flex items-center gap-2 mb-2.5">
                <button
                  type="button"
                  onClick={() => setMapMode(mapMode === "parking" ? null : "parking")}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-colors ${
                    mapMode === "parking" ? "bg-forest-950 text-white border-forest-950" : "bg-white text-forest-950/70 border-forest-950/15"
                  }`}
                >
                  <ParkingSquare className="w-3.5 h-3.5" /> Parkplatz setzen
                </button>
              </div>
              <div className="rounded-2xl overflow-hidden border border-forest-950/[0.07] shadow-card h-64 mb-3">
                <InteractivePlanningMap
                  routePoints={routePoints}
                  startLat={gpxData.startLat}
                  startLng={gpxData.startLng}
                  parking={parking}
                  overnightStops={[]}
                  waypoints={gpxData.waypoints ?? []}
                  activeMode={mapMode}
                  onSetParking={(lat, lng) => { setParking({ lat, lng }); setMapMode(null); }}
                  onAddOvernightAt={() => {}}
                  onAddWaypointAt={() => {}}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-3 px-1">
                <div className="flex items-center gap-1.5 text-forest-950/70">
                  <MapPin className="w-3 h-3 text-forest-700" /> {gpxData.distanceKm} km
                </div>
                <div className="flex items-center gap-1.5 text-forest-950/70">
                  <TrendingUp className="w-3 h-3 text-forest-700" /> {gpxData.elevationUp} hm Aufstieg
                </div>
              </div>
              {parking.lat && (
                <input
                  type="text"
                  value={parkingName}
                  onChange={(e) => setParkingName(e.target.value)}
                  placeholder="Parkplatz-Name (optional)"
                  className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30"
                />
              )}
            </>
          )}
        </div>

        {/* Activity-specific difficulty — same logic as the solo wizard:
            only the field that matches the chosen activity is shown. */}
        {activity === "WANDERN" || activity === "BERGTOUR" || activity === "SKITOUR" ? (
          <div className="mb-6">
            <label className="block text-xs font-semibold text-forest-950/70 mb-2">Schwierigkeit (SAC-Skala)</label>
            <div className="flex gap-2 flex-wrap">
              {SAC_LEVELS.map((s) => (
                <button
                  key={s.key} type="button" onClick={() => setDifficulty(s.key)} title={s.desc}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors ${
                    difficulty === s.key ? "border-forest-700 bg-forest-100 text-forest-700" : "border-forest-950/15 text-forest-950/70"
                  }`}
                >
                  {s.key}
                </button>
              ))}
            </div>
          </div>
        ) : activity === "KLETTERSTEIG" ? (
          <div className="mb-6">
            <label className="block text-xs font-semibold text-forest-950/70 mb-2">Klettersteig-Schwierigkeit</label>
            <div className="flex gap-2">
              {KLETTERSTEIG_GRADES.map((g) => (
                <button
                  key={g} type="button" onClick={() => setDifficulty(g)}
                  className={`w-10 h-10 rounded-lg text-sm font-bold border transition-colors ${
                    difficulty === g ? "border-forest-700 bg-forest-100 text-forest-700" : "border-forest-950/15 text-forest-950/70"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        ) : activity === "MOUNTAINBIKE" ? (
          <div className="mb-6">
            <label className="block text-xs font-semibold text-forest-950/70 mb-2">MTB-Schwierigkeit</label>
            <div className="flex gap-2">
              {MTB_SCALES.map((s) => (
                <button
                  key={s} type="button" onClick={() => setDifficulty(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    difficulty === s ? "border-forest-700 bg-forest-100 text-forest-700" : "border-forest-950/15 text-forest-950/70"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {activity === "SKITOUR" && (
          <div className="mb-6">
            <label className="block text-xs font-semibold text-forest-950/70 mb-2">Lawinengefahr</label>
            <div className="flex gap-2">
              {AVALANCHE_RISKS.map((r) => (
                <button
                  key={r.key} type="button" onClick={() => setDifficulty(`${difficulty ? difficulty + " · " : ""}Lawine ${r.key}`)} title={r.desc}
                  className="w-10 h-10 rounded-lg text-sm font-bold border border-forest-950/15 text-forest-950/70 hover:border-forest-700/40"
                >
                  {r.key}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Organizer safety/equipment notes — what to bring, known
            hazards, anything not captured by a waypoint pin. */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Notizen für die Gruppe</label>
          <textarea
            value={groupNotes}
            onChange={(e) => setGroupNotes(e.target.value)}
            rows={3}
            placeholder="z. B. Ausrüstung, bekannte Gefahrenstellen, besondere Hinweise…"
            className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 resize-none"
          />
        </div>

        {/* Suggested return time */}
        <div className="mb-3">
          <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Geplanter Start</label>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={toDateInputValue(startAt)}
              onChange={(e) => handleStartChange(mergeDateTime(e.target.value, toTimeInputValue(startAt), startAt))}
              className="rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30"
            />
            <input
              type="time"
              value={toTimeInputValue(startAt)}
              onChange={(e) => handleStartChange(mergeDateTime(toDateInputValue(startAt), e.target.value, startAt))}
              className="rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30"
            />
          </div>
        </div>

        <label className="flex items-center gap-2.5 mb-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={multiDay}
            onChange={(e) => handleMultiDayToggle(e.target.checked)}
            className="w-4 h-4 rounded accent-forest-700"
          />
          <span className="text-sm text-forest-950/80">Mehrtägige Tour mit Übernachtung</span>
        </label>

        {multiDay && (
          <div className="mb-3">
            <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Anzahl Tage</label>
            <input
              type="number"
              min={2}
              max={14}
              value={returnDays}
              onChange={(e) => handleReturnDaysChange(Number(e.target.value))}
              className="w-24 rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30"
            />
          </div>
        )}

        <div className="mb-6">
          <label className="block text-xs font-semibold text-forest-950/70 mb-1.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Vorgeschlagene Rückkehr
          </label>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={toDateInputValue(suggestedEta)}
              onChange={(e) => setSuggestedEta(mergeDateTime(e.target.value, toTimeInputValue(suggestedEta), suggestedEta))}
              disabled={multiDay}
              className="rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 disabled:bg-forest-950/[0.03] disabled:text-forest-950/40"
            />
            <input
              type="time"
              value={toTimeInputValue(suggestedEta)}
              onChange={(e) => setSuggestedEta(mergeDateTime(toDateInputValue(suggestedEta), e.target.value, suggestedEta))}
              className="rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30"
            />
          </div>
          <p className="text-xs text-stone mt-1.5">Jeder Teilnehmer kann diesen Vorschlag beim Beitreten übernehmen oder für sich anpassen.</p>
        </div>

        {/* Start mode */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-forest-950/70 mb-2">Wer startet die Tour?</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setStartMode("EACH_OWN")}
              className={`text-left rounded-xl border p-3.5 transition-all ${
                startMode === "EACH_OWN" ? "border-forest-700 bg-forest-100" : "border-forest-950/[0.08] bg-white hover:border-forest-950/20"
              }`}
            >
              <p className={`text-sm font-medium mb-0.5 ${startMode === "EACH_OWN" ? "text-forest-700" : "text-forest-950/80"}`}>Jeder selbst</p>
              <p className="text-xs text-stone">Jeder startet, sobald er am Trailhead ist.</p>
            </button>
            <button
              type="button"
              onClick={() => setStartMode("ORGANIZER_STARTS_ALL")}
              className={`text-left rounded-xl border p-3.5 transition-all ${
                startMode === "ORGANIZER_STARTS_ALL" ? "border-forest-700 bg-forest-100" : "border-forest-950/[0.08] bg-white hover:border-forest-950/20"
              }`}
            >
              <p className={`text-sm font-medium mb-0.5 ${startMode === "ORGANIZER_STARTS_ALL" ? "text-forest-700" : "text-forest-950/80"}`}>Ich starte für alle</p>
              <p className="text-xs text-stone">Ein Klick startet die Tour für die ganze Gruppe.</p>
            </button>
          </div>
        </div>

        {/* Invite friends */}
        <div className="mb-7">
          <label className="block text-xs font-semibold text-forest-950/70 mb-2">Wen einladen?</label>
          <div className="flex flex-wrap gap-2">
            {friends.map((f) => {
              const selected = inviteeIds.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => toggleInvitee(f.id)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                    selected ? "bg-forest-700 text-white border-forest-700" : "bg-white text-forest-950/75 border-forest-950/10 hover:border-forest-700/40"
                  }`}
                >
                  <Users className="w-3 h-3" /> {f.name}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="bg-alarm-50 border border-alarm-100 text-alarm text-sm rounded-xl px-4 py-3 mb-5">{error}</div>
        )}

        <button
          onClick={handleCreate}
          disabled={submitting}
          className="flex items-center gap-2 bg-forest-700 text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-forest-600 transition-colors disabled:opacity-60"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {submitting ? "Wird erstellt…" : "Gruppe erstellen & einladen"}
        </button>
      </main>
    </div>
  );
}
