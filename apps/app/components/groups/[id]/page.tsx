"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuth";
import { apiFetch, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRealtimeConnection } from "@/lib/realtime";
import Sidebar from "@/components/Sidebar";
import GroupMap, { GroupParticipant } from "@/components/groups/GroupMap";
import { ArrowLeft, Users, Clock, UserPlus, Radio } from "lucide-react";

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
  return { text: "Noch nicht gestartet", cls: "text-stone" };
}

export default function TourGroupPage() {
  const { user, loading: authLoading, logout } = useAuthGuard();
  const params = useParams();
  const router = useRouter();
  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user]);

  // Live: reflect position/status changes from any group participant
  // immediately — this view exists specifically to watch the whole group
  // at once, so it needs to update without a manual reload.
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
      const data = await apiFetch(`/tour-groups/${params.id}`, {}, token ?? undefined);
      setGroup(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gruppe konnte nicht geladen werden");
    } finally {
      setLoading(false);
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

  const participants: GroupParticipant[] = group.tours.map((t: any) => ({
    userId: t.userId,
    name: t.user?.name ?? "?",
    lat: t.lastLat ?? t.startLat ?? null,
    lng: t.lastLng ?? t.startLng ?? null,
    status: t.status,
  }));
  const pendingInvites = group.invites?.filter((i: any) => i.status === "PENDING") ?? [];

  return (
    <div className="flex min-h-screen bg-snow">
      <Sidebar onLogout={logout} userName={user?.name} />

      <main className="flex-1 px-12 py-11 max-w-4xl">
        <button onClick={() => router.push("/dashboard/touren")} className="flex items-center gap-1.5 text-sm text-stone hover:text-forest-950 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Zurück zu Touren
        </button>

        <div className="mb-7">
          <p className="text-xs font-semibold text-forest-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Gemeinsame Tour
          </p>
          <h1 className="font-display text-3xl font-semibold text-forest-950 tracking-tight">
            {ACTIVITY_EMOJI[group.activity] ?? "🏔️"} {group.routeName || "Gemeinsame Tour"}
          </h1>
          <p className="text-stone text-sm mt-1">Organisiert von {group.organizer?.name}</p>
        </div>

        {/* Group live map — everyone at once */}
        <div className="rounded-2xl overflow-hidden border border-forest-950/[0.07] shadow-card h-96 mb-6">
          <GroupMap participants={participants} />
        </div>

        {/* Participants list, each with their own status — never a shared
            group ETA, since each person's safety timer is independent. */}
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
                    <p className="text-sm font-semibold text-forest-950 truncate">{t.user?.name}</p>
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

        <p className="text-xs text-stone flex items-center gap-1.5">
          <Radio className="w-3 h-3" /> Jede Person hat ihre eigene Rückkehrzeit und eigene Notfallkontakte — eine Verspätung bei einer Person wird unabhängig von den anderen erkannt.
        </p>
      </main>
    </div>
  );
}
