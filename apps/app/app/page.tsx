"use client";

import { useEffect, useState } from "react";
import { useAuthGuard } from "@/lib/useAuth";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import { Mountain, Clock, ShieldAlert, Users, TrendingUp, MapPin, ChevronRight } from "lucide-react";

const ACTIVITY_EMOJI: Record<string, string> = {
  Wandern: "🥾", Bergsteigen: "⛰️", Klettern: "🧗", Skitouren: "⛷️",
  Mountainbike: "🚵", Velofahren: "🚴", Laufen: "🏃", Schneeschuhe: "🌨️",
};

export default function DashboardPage() {
  const { user, loading: authLoading, logout } = useAuthGuard();
  const [tours, setTours] = useState<any[]>([]);
  const [activeTour, setActiveTour] = useState<any>(null);
  const [friendsOnTour, setFriendsOnTour] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user) loadData();
  }, [authLoading, user]);

  async function loadData() {
    try {
      const token = getToken();
      const [toursData, friendsData] = await Promise.all([
        apiFetch("/tours", {}, token ?? undefined),
        apiFetch("/friends", {}, token ?? undefined).catch(() => ({ friends: [] })),
      ]);
      setTours(toursData);
      const active = toursData.find((t: any) => t.status === "ACTIVE" || t.status === "ALARM");
      setActiveTour(active ?? null);
      setFriendsOnTour((friendsData.friends ?? []).filter((f: any) => f.activeTour));
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

  return (
    <div className="flex min-h-screen bg-snow">
      <Sidebar onLogout={logout} userName={user?.name} />

      <main className="flex-1 px-12 py-11 max-w-5xl">
        <PageHeader
          title={`Willkommen zurück${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
          subtitle="Hier ist der aktuelle Stand deiner Sicherheit."
        />

        {dataLoading ? (
          <div className="text-stone text-sm">Lädt Touren…</div>
        ) : (
          <>
            {/* ── Active tour hero ── */}
            {activeTour ? (
              <div
                className={`relative overflow-hidden rounded-2xl p-8 mb-10 border ${
                  isAlarm
                    ? "bg-alarm-50 border-alarm-100"
                    : "bg-forest-900 border-forest-900"
                }`}
              >
                {!isAlarm && <div className="absolute inset-0 contour-texture pointer-events-none" />}
                <div className="relative">
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldAlert className={`w-4 h-4 ${isAlarm ? "text-alarm" : "text-forest-500"}`} strokeWidth={2} />
                    <span className={`text-xs font-bold uppercase tracking-wide ${isAlarm ? "text-alarm" : "text-forest-500"}`}>
                      {isAlarm ? "Alarm — überfällig" : "Tour aktiv"}
                    </span>
                  </div>
                  <h2 className={`font-display text-2xl font-semibold mb-1 ${isAlarm ? "text-forest-950" : "text-white"}`}>
                    {ACTIVITY_EMOJI[activeTour.activity] ?? "🏔️"} {activeTour.routeName || activeTour.activity || "Tour"}
                  </h2>
                  {activeTour.eta && (
                    <div className={`flex items-center gap-1.5 text-sm mt-3 ${isAlarm ? "text-forest-950/65" : "text-forest-100/70"}`}>
                      <Clock className="w-3.5 h-3.5" />
                      Rückkehr bis{" "}
                      {new Date(activeTour.eta).toLocaleString("de-CH", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}{" "}
                      Uhr
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Mountain}
                title="Keine aktive Tour"
                body="Starte eine neue Tour in der Trailtag-App, sobald du losgehst."
              />
            )}

            {/* ── Stats ── */}
            <div className="grid grid-cols-3 gap-4 mb-10 mt-8">
              <StatCard label="Touren" value={completedTours.length} icon={Mountain} />
              <StatCard label="Distanz" value={totalKm.toFixed(0)} unit="km" icon={MapPin} />
              <StatCard label="Höhenmeter" value={totalEle.toFixed(0)} unit="hm" icon={TrendingUp} />
            </div>

            {/* ── Friends on tour ── */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-stone uppercase tracking-wide">
                Freunde unterwegs {friendsOnTour.length > 0 && `· ${friendsOnTour.length}`}
              </h3>
            </div>
            {friendsOnTour.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {friendsOnTour.map((f: any) => {
                  const fIsAlarm = f.activeTour?.status === "ALARM";
                  return (
                    <div
                      key={f.friendshipId}
                      className={`rounded-xl p-4 border flex items-center gap-3 transition-shadow hover:shadow-card-hover ${
                        fIsAlarm ? "bg-alarm-50 border-alarm-100" : "bg-white border-forest-950/[0.07] shadow-card"
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-forest-800 text-white flex items-center justify-center font-semibold text-sm shrink-0">
                        {(f.name ?? "?")[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-forest-950 truncate">{f.name}</p>
                        <p className={`text-xs ${fIsAlarm ? "text-alarm font-medium" : "text-stone"}`}>
                          {fIsAlarm ? "Überfällig" : f.activeTour?.activity ?? "Unterwegs"}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-forest-950/25 shrink-0" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-stone">Aktuell ist niemand aus deinem Freundeskreis unterwegs.</p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
