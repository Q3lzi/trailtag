/** Shared time-formatting helpers for the dashboard's "mission control" view —
 *  centralizing this avoids subtly different relative-time math across
 *  components, which matters when a few minutes' difference changes how
 *  alarming a status appears to someone watching from home. */

export function relativeTimeFromNow(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return "gerade jetzt";
  if (diffMin < 60) return `vor ${diffMin} Min`;
  const diffH = Math.floor(diffMin / 60);
  const remMin = diffMin % 60;
  if (diffH < 24) return remMin > 0 ? `vor ${diffH} Std ${remMin} Min` : `vor ${diffH} Std`;
  const diffD = Math.floor(diffH / 24);
  return `vor ${diffD} Tag${diffD > 1 ? "en" : ""}`;
}

export function timeUntil(date: Date | string): { label: string; isPast: boolean; isUrgent: boolean } {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = d.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 0) {
    const overdueMin = Math.abs(diffMin);
    const h = Math.floor(overdueMin / 60);
    const m = overdueMin % 60;
    return { label: h > 0 ? `${h} Std ${m} Min überfällig` : `${m} Min überfällig`, isPast: true, isUrgent: true };
  }
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  const label = h > 0 ? `noch ${h} Std ${m} Min` : `noch ${m} Min`;
  return { label, isPast: false, isUrgent: diffMin < 30 };
}

export function elapsedSince(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return h > 0 ? `${h} Std ${m} Min` : `${m} Min`;
}