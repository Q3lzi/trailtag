export type Companion = { name: string; age: string; notes: string };

export type OvernightStop = {
  night: number;
  type: string;
  name: string;
  address: string;
  lat: string;
  lng: string;
  notes: string;
};

export type Waypoint = { name: string; lat: string; lng: string; notes: string };

export type TourFormState = {
  // Step 1 — Activity
  activity: string;

  // Step 2 — Time + Vehicle
  startDateTime: Date;
  etaDateTime: Date;
  multiDay: boolean;
  returnDays: number;
  vehicleId: string | null;

  // Step 3 — Emergency + Companions
  selectedContactIds: string[];
  companions: Companion[];

  // Step 4 — Route
  routeName: string;
  startLat: string;
  startLng: string;
  parkingLocation: string;
  parkingLat: string;
  parkingLng: string;
  waypoints: Waypoint[];
  overnightStops: OvernightStop[];
  gpxData: any | null;
  gpxRawContent: string | null;

  // Step 5 — Details
  distanceKm: string;
  elevationUp: string;
  difficulty: string;
  klettersteigGrade: string;
  mtbScale: string;
  pisteLevel: string;
  avalancheRisk: string;
  trailType: string;
  notes: string;
};

// `key` MUST match the backend's ActivityType enum exactly (see
// apps/api/prisma/schema.prisma) — these are sent as-is in the create-tour
// request body. `label`/`emoji` are display-only.
export const ACTIVITIES = [
  { key: "WANDERN", label: "Wandern", emoji: "🥾", fields: ["sac", "distance", "elevation"] },
  { key: "BERGTOUR", label: "Bergtour", emoji: "⛰️", fields: ["sac", "distance", "elevation"] },
  { key: "KLETTERN", label: "Klettern", emoji: "🧗", fields: ["equipment"] },
  { key: "KLETTERSTEIG", label: "Klettersteig", emoji: "🪢", fields: ["klettersteig_grade", "equipment"] },
  { key: "TRAILRUNNING", label: "Trailrunning", emoji: "🏃", fields: ["distance", "elevation"] },
  { key: "MOUNTAINBIKE", label: "Mountainbike", emoji: "🚵", fields: ["mtb_scale", "distance", "elevation", "trail_type"] },
  { key: "RADSPORT", label: "Radsport", emoji: "🚴", fields: ["distance", "elevation"] },
  { key: "SKI_SNOWBOARD", label: "Ski/Snowboard", emoji: "🎿", fields: ["piste_level"] },
  { key: "SKITOUR", label: "Skitour", emoji: "⛷️", fields: ["sac", "distance", "elevation", "avalanche"] },
  { key: "KANU_KAJAK", label: "Kanu/Kajak", emoji: "🛶", fields: ["distance"] },
  { key: "PARAGLIDING", label: "Paragliding", emoji: "🪂", fields: [] },
  { key: "ANDERE", label: "Andere", emoji: "🏔️", fields: ["distance"] },
];

export const SAC_LEVELS = [
  { key: "T1", desc: "Wanderweg" }, { key: "T2", desc: "Bergwanderweg" },
  { key: "T3", desc: "Anspruchsvoll" }, { key: "T4", desc: "Alpinwanderweg" },
  { key: "T5", desc: "Anspruchsvoller Alpin" }, { key: "T6", desc: "Schwieriger Alpin" },
];
export const KLETTERSTEIG_GRADES = ["A", "B", "C", "D", "E"];
export const MTB_SCALES = ["S0", "S1", "S2", "S3", "S4", "S5"];
export const PISTE_LEVELS = ["Blau", "Rot", "Schwarz", "Freeride"];
export const AVALANCHE_RISKS = [
  { key: "1", desc: "Gering" }, { key: "2", desc: "Mässig" }, { key: "3", desc: "Erheblich" },
  { key: "4", desc: "Gross" }, { key: "5", desc: "Sehr gross" },
];
export const TRAIL_TYPES = ["Flow Trail", "Enduro", "Downhill", "Cross Country", "Technisch"];
export const OVERNIGHT_TYPES = [
  { key: "huette", label: "SAC Hütte" }, { key: "berghuette", label: "Berghütte" },
  { key: "hotel", label: "Hotel/B&B" }, { key: "zelt", label: "Zelt/Biwak" },
  { key: "camping", label: "Camping" }, { key: "schutz", label: "Schutzhütte" },
  { key: "privat", label: "Privat" },
];

export function defaultFormState(): TourFormState {
  const start = new Date(); start.setHours(8, 0, 0, 0);
  const eta = new Date(); eta.setHours(17, 0, 0, 0);
  return {
    activity: "",
    startDateTime: start,
    etaDateTime: eta,
    multiDay: false,
    returnDays: 2,
    vehicleId: null,
    selectedContactIds: [],
    companions: [],
    routeName: "",
    startLat: "",
    startLng: "",
    parkingLocation: "",
    parkingLat: "",
    parkingLng: "",
    waypoints: [],
    overnightStops: [],
    gpxData: null,
    gpxRawContent: null,
    distanceKm: "",
    elevationUp: "",
    difficulty: "",
    klettersteigGrade: "",
    mtbScale: "",
    pisteLevel: "",
    avalancheRisk: "",
    trailType: "",
    notes: "",
  };
}

// Reconstructs wizard form state from an already-saved (PLANNED) tour, so
// "continue editing a draft" starts from where the user left off instead of
// a blank form. Mirrors buildTourBody()'s shape in the new-tour page in
// reverse.
export function formStateFromTour(tour: any): TourFormState {
  const base = defaultFormState();
  const companions = Array.isArray(tour.companions)
    ? tour.companions.map((c: any) => ({ name: c.name ?? "", age: c.age ?? "", notes: c.notes ?? "" }))
    : [];
  const overnightStops = Array.isArray(tour.overnightStops) ? tour.overnightStops : [];
  const waypoints = Array.isArray(tour.waypoints)
    ? tour.waypoints.map((w: any) => ({ name: w.name ?? "", lat: String(w.lat ?? ""), lng: String(w.lng ?? ""), notes: w.notes ?? "" }))
    : [];

  return {
    ...base,
    activity: tour.activity ?? "",
    vehicleId: tour.vehicleId ?? null,
    companions,
    routeName: tour.routeName ?? "",
    startLat: tour.startLat != null ? String(tour.startLat) : "",
    startLng: tour.startLng != null ? String(tour.startLng) : "",
    parkingLocation: tour.parkingLocation ?? "",
    parkingLat: tour.parkingLat != null ? String(tour.parkingLat) : "",
    parkingLng: tour.parkingLng != null ? String(tour.parkingLng) : "",
    waypoints,
    overnightStops,
    multiDay: overnightStops.length > 0,
    returnDays: overnightStops.length > 0 ? overnightStops.length + 1 : 2,
    gpxData: tour.gpxTrack ?? null,
    // The raw GPX text isn't stored server-side (only the parsed track), so
    // re-attaching on save isn't possible here — that's fine, the track is
    // already saved and won't be touched unless a new file is uploaded.
    gpxRawContent: null,
    distanceKm: tour.distanceKm != null ? String(tour.distanceKm) : "",
    elevationUp: tour.elevationUp != null ? String(tour.elevationUp) : "",
    difficulty: tour.difficulty ?? "",
    notes: tour.notes ?? "",
  };
}