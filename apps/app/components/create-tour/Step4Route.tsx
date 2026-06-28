"use client";

import { useRef, useState } from "react";
import { TourFormState, Waypoint, OvernightStop, OVERNIGHT_TYPES } from "./types";
import { Upload, MapPin, Plus, Trash2, CheckCircle2, X, TrendingDown, TrendingUp, Clock, ParkingSquare, Moon, Flag, Navigation } from "lucide-react";
import InteractivePlanningMap from "@/components/InteractivePlanningMap";
import WeatherPanel from "@/components/weather/WeatherPanel";

type Mode = "parking" | "overnight" | "waypoint" | null;

export default function Step4Route({
  form,
  update,
  onUseMyLocation,
}: {
  form: TourFormState;
  update: (patch: Partial<TourFormState>) => void;
  onUseMyLocation: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [gpxError, setGpxError] = useState("");
  const [parsing, setParsing] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  // Tracks which overnight night the next map click should fill in, when
  // there are multiple nights still missing a location.
  const [pendingOvernightIndex, setPendingOvernightIndex] = useState<number | null>(null);

  async function handleGpxUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setGpxError("");
    setParsing(true);
    try {
      const text = await file.text();
      const { apiFetch } = await import("@/lib/api");
      const { getToken } = await import("@/lib/auth");
      const token = getToken();
      const data = await apiFetch("/gpx/parse", { method: "POST", body: JSON.stringify({ gpxContent: text }) }, token ?? undefined);

      const gpxWaypoints: Waypoint[] = (data.waypoints ?? []).map((w: any) => ({
        name: w.name || "Wegpunkt",
        lat: String(w.lat),
        lng: String(w.lng),
        notes: w.notes || "",
      }));

      update({
        gpxData: data,
        gpxRawContent: text,
        distanceKm: data.distanceKm ? String(data.distanceKm) : form.distanceKm,
        elevationUp: data.elevationUp ? String(data.elevationUp) : form.elevationUp,
        startLat: data.startLat ? String(data.startLat) : form.startLat,
        startLng: data.startLng ? String(data.startLng) : form.startLng,
        // The route's own name becomes the tour name automatically — no
        // separate "tour name" field to fill in by hand.
        routeName: data.routeName || form.routeName || "",
        waypoints: form.waypoints.length > 0 ? form.waypoints : gpxWaypoints,
      });
    } catch (err: any) {
      setGpxError(err.message ?? "GPX-Datei konnte nicht gelesen werden");
    } finally {
      setParsing(false);
    }
  }

  // OpenStreetMap Nominatim reverse geocoding — free, no API key, used to
  // pre-fill a human-readable name when a point is placed on the map.
  // Nominatim's usage policy asks for ~1 request/second max, which is fine
  // here since this only fires on individual user clicks, never in a loop.
  async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&addressdetails=1`,
        { headers: { "Accept-Language": "de" } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const a = data.address ?? {};
      // Prefer a specific named place, fall back to road + village.
      return a.tourism || a.amenity || a.leisure || a.parking ||
        [a.road, a.village || a.town || a.city].filter(Boolean).join(", ") ||
        data.display_name || null;
    } catch {
      return null;
    }
  }

  async function handleSetParking(lat: number, lng: number) {
    update({ parkingLat: String(lat), parkingLng: String(lng) });
    setMode(null);
    if (!form.parkingLocation) {
      const name = await reverseGeocode(lat, lng);
      if (name) update({ parkingLocation: name });
    }
  }

  async function handleAddOvernightAt(lat: number, lng: number) {
    setMode(null);
    const name = await reverseGeocode(lat, lng);

    if (pendingOvernightIndex != null) {
      const next = [...form.overnightStops];
      next[pendingOvernightIndex] = {
        ...next[pendingOvernightIndex],
        lat: String(lat), lng: String(lng),
        name: next[pendingOvernightIndex].name || name || "",
      };
      update({ overnightStops: next });
      setPendingOvernightIndex(null);
    } else {
      const night = form.overnightStops.length + 1;
      update({
        overnightStops: [
          ...form.overnightStops,
          { night, type: "huette", name: name || "", address: name || "", lat: String(lat), lng: String(lng), notes: "" },
        ],
      });
    }
  }

  function handleAddWaypointAt(lat: number, lng: number) {
    update({ waypoints: [...form.waypoints, { name: `Wegpunkt ${form.waypoints.length + 1}`, lat: String(lat), lng: String(lng), notes: "" }] });
    setMode(null);
  }

  function updateWaypoint(i: number, patch: Partial<Waypoint>) {
    const next = [...form.waypoints];
    next[i] = { ...next[i], ...patch };
    update({ waypoints: next });
  }
  function removeWaypoint(i: number) {
    update({ waypoints: form.waypoints.filter((_, j) => j !== i) });
  }

  function updateOvernightStop(i: number, patch: Partial<OvernightStop>) {
    const next = [...form.overnightStops];
    next[i] = { ...next[i], ...patch };
    update({ overnightStops: next });
  }
  function removeOvernightStop(i: number) {
    update({ overnightStops: form.overnightStops.filter((_, j) => j !== i) });
  }
  function addOvernightStopManually() {
    const night = form.overnightStops.length + 1;
    update({ overnightStops: [...form.overnightStops, { night, type: "huette", name: "", address: "", lat: "", lng: "", notes: "" }] });
  }

  function formatDuration(minutes?: number) {
    if (!minutes) return null;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return h > 0 ? `${h} Std ${m} Min` : `${m} Min`;
  }

  const routePoints = form.gpxData?.points ?? [];
  const hasRoute = routePoints.length > 1;

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold text-forest-950 mb-1.5">Wohin geht's?</h2>
      <p className="text-stone text-sm mb-7">Lade deine Route hoch und markiere Parkplatz, Übernachtungen und Wegpunkte direkt auf der Karte.</p>

      {/* Tour name — auto-filled from GPX once uploaded, editable manually otherwise */}
      <div className="mb-6">
        <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Name der Tour</label>
        <input
          type="text"
          value={form.routeName}
          onChange={(e) => update({ routeName: e.target.value })}
          placeholder="z. B. Lidernenhütte – Spilauer See"
          className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700"
        />
        {form.gpxData?.routeName && (
          <p className="text-xs text-stone mt-1.5">Aus der GPX-Datei übernommen — du kannst den Namen anpassen.</p>
        )}
      </div>

      {/* GPX upload */}
      {!form.gpxData ? (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={parsing}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-forest-950/15 hover:border-forest-700/40 py-8 text-sm text-stone transition-colors disabled:opacity-60"
          >
            <Upload className="w-4 h-4" />
            {parsing ? "Lese Datei…" : "GPX-Datei hochladen"}
          </button>
          <input ref={fileInputRef} type="file" accept=".gpx" onChange={handleGpxUpload} className="hidden" />
          {gpxError && <p className="text-xs text-alarm mt-2">{gpxError}</p>}
          <p className="text-xs text-stone mt-2">
            Ohne GPX-Datei kannst du den Startpunkt unten manuell setzen.
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between mb-3 rounded-xl border border-forest-700/20 bg-forest-100 px-4 py-2.5">
          <div className="flex items-center gap-2 text-forest-700">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-semibold">{form.routeName || "Route geladen"}</span>
          </div>
          <button type="button" onClick={() => update({ gpxData: null, gpxRawContent: null })} className="text-stone hover:text-alarm transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* The interactive map — always visible once we have at least a route
          or a start point, since parking/waypoints/overnight all need it. */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => { setMode(mode === "parking" ? null : "parking"); setPendingOvernightIndex(null); }}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-colors ${
              mode === "parking" ? "bg-forest-950 text-white border-forest-950" : "bg-white text-forest-950/70 border-forest-950/15 hover:border-forest-950/30"
            }`}
          >
            <ParkingSquare className="w-3.5 h-3.5" /> Parkplatz setzen
          </button>
          {form.multiDay && (
            <button
              type="button"
              onClick={() => { setMode(mode === "overnight" ? null : "overnight"); setPendingOvernightIndex(null); }}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-colors ${
                mode === "overnight" ? "bg-forest-950 text-white border-forest-950" : "bg-white text-forest-950/70 border-forest-950/15 hover:border-forest-950/30"
              }`}
            >
              <Moon className="w-3.5 h-3.5" /> Übernachtung setzen
            </button>
          )}
          <button
            type="button"
            onClick={() => { setMode(mode === "waypoint" ? null : "waypoint"); setPendingOvernightIndex(null); }}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-colors ${
              mode === "waypoint" ? "bg-forest-950 text-white border-forest-950" : "bg-white text-forest-950/70 border-forest-950/15 hover:border-forest-950/30"
            }`}
          >
            <Flag className="w-3.5 h-3.5" /> Wegpunkt setzen
          </button>
          {!hasRoute && (
            <button
              type="button"
              onClick={onUseMyLocation}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold border border-forest-950/15 bg-white text-forest-700 hover:border-forest-700/30 transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" /> Mein Standort als Start
            </button>
          )}
        </div>
        {mode && (
          <p className="text-xs text-forest-700 font-medium mb-2">
            Klick auf die Karte, um {mode === "parking" ? "den Parkplatz" : mode === "overnight" ? "die Übernachtung" : "den Wegpunkt"} zu setzen.
          </p>
        )}
        <div className="rounded-2xl overflow-hidden border border-forest-950/[0.07] shadow-card h-72">
          <InteractivePlanningMap
            routePoints={routePoints}
            startLat={form.startLat ? Number(form.startLat) : null}
            startLng={form.startLng ? Number(form.startLng) : null}
            parking={{ lat: form.parkingLat ? Number(form.parkingLat) : null, lng: form.parkingLng ? Number(form.parkingLng) : null }}
            overnightStops={form.overnightStops}
            waypoints={form.waypoints}
            activeMode={mode}
            onSetParking={handleSetParking}
            onAddOvernightAt={handleAddOvernightAt}
            onAddWaypointAt={handleAddWaypointAt}
          />
        </div>
      </div>

      {/* GPX stats, shown below the map once loaded */}
      {form.gpxData && (
        <div className="grid grid-cols-2 gap-2 text-xs mb-7 px-1">
          <div className="flex items-center gap-1.5 text-forest-950/70">
            <MapPin className="w-3 h-3 text-forest-700" /> {form.gpxData.distanceKm} km
          </div>
          <div className="flex items-center gap-1.5 text-forest-950/70">
            <TrendingUp className="w-3 h-3 text-forest-700" /> {form.gpxData.elevationUp} hm Aufstieg
          </div>
          {form.gpxData.elevationDown != null && (
            <div className="flex items-center gap-1.5 text-forest-950/70">
              <TrendingDown className="w-3 h-3 text-forest-700" /> {form.gpxData.elevationDown} hm Abstieg
            </div>
          )}
          {formatDuration(form.gpxData.durationMinutes) && (
            <div className="flex items-center gap-1.5 text-forest-950/70">
              <Clock className="w-3 h-3 text-forest-700" /> {formatDuration(form.gpxData.durationMinutes)}
            </div>
          )}
        </div>
      )}

      {/* Weather + thunderstorm + UV + (seasonal) avalanche context for the
          planned start point — this is the moment someone decides whether
          the tour is actually a good idea, so it belongs right where the
          route is being finalized, not buried later. */}
      {(form.startLat || form.gpxData?.startLat) && (
        <div className="mb-7">
          <WeatherPanel
            lat={form.startLat ? Number(form.startLat) : form.gpxData?.startLat}
            lng={form.startLng ? Number(form.startLng) : form.gpxData?.startLng}
            activity={form.activity}
            compact
          />
        </div>
      )}

      {/* Manual start coordinates, only if no GPX and not yet set via map */}
      {!hasRoute && !form.startLat && (
        <div className="mb-7">
          <label className="block text-xs font-semibold text-forest-950/70 mb-2">Startpunkt (manuell)</label>
          <div className="flex gap-2">
            <input
              type="text" value={form.startLat} onChange={(e) => update({ startLat: e.target.value })} placeholder="Breitengrad"
              className="flex-1 rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700"
            />
            <input
              type="text" value={form.startLng} onChange={(e) => update({ startLng: e.target.value })} placeholder="Längengrad"
              className="flex-1 rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700"
            />
          </div>
        </div>
      )}

      {/* Parking details (location set via map above) */}
      <div className="mb-7">
        <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Parkplatz-Name (optional)</label>
        <input
          type="text"
          value={form.parkingLocation}
          onChange={(e) => update({ parkingLocation: e.target.value })}
          placeholder="z. B. Parkplatz Lidernen"
          className="w-full rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 focus:border-forest-700"
        />
        {form.parkingLat && (
          <p className="text-xs text-forest-700 mt-1.5 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Position auf der Karte gesetzt
          </p>
        )}
      </div>

      {/* Waypoints list */}
      {form.waypoints.length > 0 && (
        <div className="mb-7">
          <label className="block text-xs font-semibold text-forest-950/70 mb-2">
            Wegpunkte ({form.waypoints.length})
          </label>
          <div className="space-y-2">
            {form.waypoints.map((w, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl border border-forest-950/[0.08] bg-white p-3">
                <Flag className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <input
                  type="text" value={w.name} onChange={(e) => updateWaypoint(i, { name: e.target.value })} placeholder="Name"
                  className="flex-1 rounded-lg border border-forest-950/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30"
                />
                <button type="button" onClick={() => removeWaypoint(i)} className="p-1.5 text-stone hover:text-alarm transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overnight stops — prominent, not buried */}
      {form.multiDay && (
        <div className="rounded-xl border border-forest-700/20 bg-forest-100/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-1.5 text-sm font-semibold text-forest-950">
              <Moon className="w-4 h-4 text-forest-700" /> Übernachtungen ({form.overnightStops.length})
            </label>
            <button
              type="button"
              onClick={addOvernightStopManually}
              className="flex items-center gap-1 text-xs text-forest-700 font-semibold hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Manuell hinzufügen
            </button>
          </div>
          {form.overnightStops.length === 0 ? (
            <p className="text-sm text-forest-950/60">
              Nutze den Button "Übernachtung setzen" oben, um eine Übernachtung direkt auf der Karte zu platzieren.
            </p>
          ) : (
            <div className="space-y-2.5">
              {form.overnightStops.map((stop, i) => (
                <div key={i} className="rounded-xl border border-forest-950/[0.08] bg-white p-3.5">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-bold text-forest-700">Nacht {stop.night}</span>
                    <div className="flex items-center gap-2">
                      {!stop.lat && (
                        <button
                          type="button"
                          onClick={() => { setMode("overnight"); setPendingOvernightIndex(i); }}
                          className="text-xs text-forest-700 font-medium hover:underline"
                        >
                          Auf Karte setzen
                        </button>
                      )}
                      <button type="button" onClick={() => removeOvernightStop(i)} className="text-stone hover:text-alarm transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <select
                      value={stop.type} onChange={(e) => updateOvernightStop(i, { type: e.target.value })}
                      className="rounded-lg border border-forest-950/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30"
                    >
                      {OVERNIGHT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                    <input
                      type="text" value={stop.name} onChange={(e) => updateOvernightStop(i, { name: e.target.value })} placeholder="Name"
                      className="rounded-lg border border-forest-950/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30"
                    />
                  </div>
                  <input
                    type="text" value={stop.notes} onChange={(e) => updateOvernightStop(i, { notes: e.target.value })} placeholder="Notizen"
                    className="w-full rounded-lg border border-forest-950/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
