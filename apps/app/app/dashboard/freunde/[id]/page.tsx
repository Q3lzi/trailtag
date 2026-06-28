"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuth";
import { apiFetch, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import EmptyState from "@/components/EmptyState";
import { ArrowLeft, Phone, Mountain, ExternalLink, MapPin, TrendingUp, Award, Clock } from "lucide-react";

const ACTIVITY_EMOJI: Record<string, string> = {
  WANDERN: "🥾", BERGTOUR: "⛰️", KLETTERN: "🧗", KLETTERSTEIG: "🪢",
  TRAILRUNNING: "🏃", MOUNTAINBIKE: "🚵", RADSPORT: "🚴",
  SKI_SNOWBOARD: "🎿", SKITOUR: "⛷️", KANU_KAJAK: "🛶",
  PARAGLIDING: "🪂", ANDERE: "🏔️",
};

export default function FriendProfilePage() {
  const { user, loading: authLoading, logout } = useAuthGuard();
  const params = useParams();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user]);

  async function load() {
    try {
      const token = getToken();
      const data = await apiFetch(`/friends/${params.id}/profile`, {}, token ?? undefined);
      setProfile(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Profil konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || loading) {
    return <div className="min-h-screen bg-snow flex items-center justify-center text-stone text-sm">Lädt…</div>;
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-screen bg-snow">
        <Sidebar onLogout={logout} userName={user?.name} />
        <main className="flex-1 px-12 py-11 max-w-2xl">
          <button onClick={() => router.push("/dashboard/freunde")} className="flex items-center gap-1.5 text-sm text-stone hover:text-forest-950 mb-6">
            <ArrowLeft className="w-4 h-4" /> Zurück zu Freunden
          </button>
          <p className="text-alarm text-sm">{error || "Profil nicht gefunden"}</p>
        </main>
      </div>
    );
  }

  const isAlarm = profile.activeTour?.status === "ALARM";
  const isActive = !!profile.activeTour;

  return (
    <div className="flex min-h-screen bg-snow">
      <Sidebar onLogout={logout} userName={user?.name} />

      <main className="flex-1 px-12 py-11 max-w-2xl">
        <button onClick={() => router.push("/dashboard/freunde")} className="flex items-center gap-1.5 text-sm text-stone hover:text-forest-950 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Zurück zu Freunden
        </button>

        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-forest-950 p-8 mb-5">
          <div
            className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-[0.15] pointer-events-none"
            style={{ background: "radial-gradient(circle, #4a8f6f, transparent 70%)" }}
          />
          <div className="relative flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full text-white flex items-center justify-center font-display font-semibold text-2xl shrink-0 ${isAlarm ? "bg-alarm" : "bg-gradient-to-br from-forest-600 to-forest-800"}`}>
              {(profile.name ?? "?")[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="font-display font-semibold text-xl text-white">{profile.name}</h1>
              {profile.birthYear && <p className="text-sm text-white/55">Jahrgang {profile.birthYear}</p>}
              {profile.stats?.favActivity && (
                <span className="inline-flex items-center gap-1.5 text-xs text-forest-200 bg-white/10 px-2.5 py-1 rounded-full mt-2">
                  <Award className="w-3 h-3" /> {ACTIVITY_EMOJI[profile.stats.favActivity] ?? "🏔️"} Lieblingsaktivität
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        {profile.phone && (
          <a
            href={`tel:${profile.phone}`}
            className="flex items-center justify-center gap-2 bg-white border border-forest-950/[0.06] shadow-card rounded-2xl p-4 mb-5 hover:shadow-card-hover transition-shadow"
          >
            <Phone className="w-4 h-4 text-forest-700" />
            <span className="text-sm font-semibold text-forest-950">{profile.phone}</span>
          </a>
        )}

        {/* Active tour */}
        {isActive ? (
          <div className={`rounded-2xl p-6 mb-5 ${isAlarm ? "bg-alarm" : "bg-forest-950"}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`relative flex h-2 w-2 rounded-full ${isAlarm ? "bg-white pulse-alarm" : "bg-forest-500 pulse-active"}`} />
              <span className="text-xs font-bold uppercase tracking-wide text-white/85">
                {isAlarm ? "Alarm — überfällig" : "Gerade unterwegs"}
              </span>
            </div>
            <h3 className="font-display text-xl font-semibold text-white mb-1">
              {ACTIVITY_EMOJI[profile.activeTour.activity] ?? "🏔️"} {profile.activeTour.activity}
            </h3>
            {profile.activeTour.eta && (
              <p className="text-sm text-white/60 flex items-center gap-1.5 mt-2">
                <Clock className="w-3.5 h-3.5" />
                Rückkehr bis {new Date(profile.activeTour.eta).toLocaleString("de-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} Uhr
              </p>
            )}
            {profile.activeTour.qrUrl && (
              <a
                href={profile.activeTour.qrUrl}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white text-forest-950 rounded-xl px-4 py-2.5 text-sm font-semibold mt-4 hover:bg-forest-100 transition-colors"
              >
                <ExternalLink className="w-4 h-4" /> Ersthelfer-Portal öffnen
              </a>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-6 mb-5 text-center">
            <Mountain className="w-7 h-7 text-forest-950/20 mx-auto mb-2" />
            <p className="text-sm text-stone">Aktuell keine aktive Tour</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-4">
            <p className="text-[11px] text-stone mb-1">Touren</p>
            <p className="font-display text-2xl font-semibold text-forest-950">{profile.stats?.totalTours ?? 0}</p>
          </div>
          <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-4">
            <p className="text-[11px] text-stone mb-1">Distanz</p>
            <p className="font-display text-2xl font-semibold text-forest-950">{profile.stats?.totalKm ?? 0} <span className="text-sm text-stone">km</span></p>
          </div>
          <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-4">
            <p className="text-[11px] text-stone mb-1">Höhenmeter</p>
            <p className="font-display text-2xl font-semibold text-forest-950">{profile.stats?.totalElevation ?? 0} <span className="text-sm text-stone">hm</span></p>
          </div>
        </div>

        {/* Recent tours */}
        {profile.recentTours?.length > 0 && (
          <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-6">
            <h3 className="font-display font-semibold text-sm text-forest-950 mb-4">Letzte Touren</h3>
            <div className="space-y-3">
              {profile.recentTours.map((t: any) => (
                <div key={t.id} className="flex items-center gap-3">
                  <span className="text-lg">{ACTIVITY_EMOJI[t.activity] ?? "🏔️"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-forest-950 truncate">{t.routeName || t.activity}</p>
                    <div className="flex items-center gap-3 text-xs text-stone">
                      {t.distanceKm && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{t.distanceKm} km</span>}
                      {t.elevationUp && <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{t.elevationUp} hm</span>}
                    </div>
                  </div>
                  {t.checkedOutAt && (
                    <span className="text-xs text-stone shrink-0">
                      {new Date(t.checkedOutAt).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
