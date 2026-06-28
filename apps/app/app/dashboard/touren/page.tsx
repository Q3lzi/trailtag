"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuth";
import { apiFetch, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import EmptyState from "@/components/EmptyState";
import { Mountain, Clock, MapPin, TrendingUp, ChevronRight, Plus, Search, Trash2 } from "lucide-react";

const ACTIVITY_EMOJI: Record<string, string> = {
  WANDERN: "🥾", BERGTOUR: "⛰️", KLETTERN: "🧗", KLETTERSTEIG: "🪢",
  TRAILRUNNING: "🏃", MOUNTAINBIKE: "🚵", RADSPORT: "🚴",
  SKI_SNOWBOARD: "🎿", SKITOUR: "⛷️", KANU_KAJAK: "🛶",
  PARAGLIDING: "🪂", ANDERE: "🏔️",
};

function statusBadge(status: string) {
  if (status === "ACTIVE") return { text: "Aktiv", cls: "bg-forest-100 text-forest-700", dot: "bg-forest-500 pulse-active" };
  if (status === "ALARM") return { text: "Alarm", cls: "bg-alarm-50 text-alarm", dot: "bg-alarm pulse-alarm" };
  if (status === "COMPLETED") return { text: "Abgeschlossen", cls: "bg-forest-950/[0.05] text-stone", dot: "" };
  if (status === "PLANNED") return { text: "Entwurf", cls: "bg-amber-50 text-amber-700", dot: "" };
  return { text: status, cls: "bg-forest-950/[0.05] text-stone", dot: "" };
}

type FilterTab = "alle" | "aktiv" | "entwuerfe" | "vergangen";
type SortBy = "neueste" | "aelteste" | "name";

export default function TourenPage() {
  const { user, loading: authLoading, logout } = useAuthGuard();
  const router = useRouter();
  const [tours, setTours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>("alle");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("neueste");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user]);

  async function load() {
    try {
      const token = getToken();
      const data = await apiFetch("/tours", {}, token ?? undefined);
      setTours(data);
    } catch {
      // empty state
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteDraft(e: React.MouseEvent, tourId: string) {
    e.stopPropagation(); // don't trigger the card's own onClick navigation
    if (!confirm("Diesen Entwurf wirklich löschen?")) return;
    setDeletingId(tourId);
    try {
      const token = getToken();
      await apiFetch(`/tours/${tourId}`, { method: "DELETE" }, token ?? undefined);
      setTours((prev) => prev.filter((t) => t.id !== tourId));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Entwurf konnte nicht gelöscht werden");
    } finally {
      setDeletingId(null);
    }
  }

  const counts = useMemo(() => {
    return {
      alle: tours.length,
      aktiv: tours.filter((t) => t.status === "ACTIVE" || t.status === "ALARM").length,
      entwuerfe: tours.filter((t) => t.status === "PLANNED").length,
      vergangen: tours.filter((t) => t.status === "COMPLETED").length,
    };
  }, [tours]);

  const visibleTours = useMemo(() => {
    let list = tours;
    if (tab === "aktiv") list = list.filter((t) => t.status === "ACTIVE" || t.status === "ALARM");
    if (tab === "entwuerfe") list = list.filter((t) => t.status === "PLANNED");
    if (tab === "vergangen") list = list.filter((t) => t.status === "COMPLETED");

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) => (t.routeName ?? "").toLowerCase().includes(q) || (t.activity ?? "").toLowerCase().includes(q)
      );
    }

    const sorted = [...list];
    if (sortBy === "neueste") sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (sortBy === "aelteste") sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (sortBy === "name") sorted.sort((a, b) => (a.routeName || a.activity || "").localeCompare(b.routeName || b.activity || ""));
    return sorted;
  }, [tours, tab, search, sortBy]);

  if (authLoading) {
    return <div className="min-h-screen bg-snow flex items-center justify-center text-stone text-sm">Lädt…</div>;
  }

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "alle", label: "Alle" },
    { key: "aktiv", label: "Aktiv" },
    { key: "entwuerfe", label: "Entwürfe" },
    { key: "vergangen", label: "Vergangen" },
  ];

  return (
    <div className="flex min-h-screen bg-snow">
      <Sidebar onLogout={logout} userName={user?.name} />

      <main className="flex-1 px-12 py-11 max-w-3xl">
        <div className="flex items-start justify-between mb-7">
          <div>
            <p className="text-xs font-semibold text-forest-700 uppercase tracking-wide mb-1.5">
              {tours.length} {tours.length === 1 ? "Tour" : "Touren"} insgesamt
            </p>
            <h1 className="font-display text-3xl font-semibold text-forest-950 tracking-tight">Deine Touren</h1>
          </div>
          <button
            onClick={() => router.push("/dashboard/touren/neu")}
            className="flex items-center gap-2 bg-forest-700 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-forest-600 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" /> Neue Tour
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1.5 mb-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                tab === t.key ? "bg-forest-950 text-white" : "bg-white text-forest-950/60 border border-forest-950/10 hover:border-forest-950/25"
              }`}
            >
              {t.label}
              {counts[t.key] > 0 && (
                <span className={`text-[10px] ${tab === t.key ? "text-white/70" : "text-forest-950/40"}`}>{counts[t.key]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Search + sort */}
        <div className="flex items-center gap-2.5 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-forest-950/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Touren durchsuchen…"
              className="w-full rounded-xl border border-forest-950/10 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/20 focus:border-forest-700"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="rounded-xl border border-forest-950/10 bg-white px-3 py-2 text-sm text-forest-950/70 focus:outline-none focus:ring-2 focus:ring-forest-700/20"
          >
            <option value="neueste">Neueste zuerst</option>
            <option value="aelteste">Älteste zuerst</option>
            <option value="name">Nach Name</option>
          </select>
        </div>

        {loading ? (
          <div className="text-stone text-sm">Lädt…</div>
        ) : visibleTours.length === 0 ? (
          <EmptyState
            icon={Mountain}
            title={tours.length === 0 ? "Noch keine Touren" : "Nichts gefunden"}
            body={tours.length === 0 ? "Plane deine erste Tour direkt hier im Browser." : "Versuch einen anderen Filter oder Suchbegriff."}
          />
        ) : (
          <div className="space-y-2.5">
            {visibleTours.map((tour: any, i: number) => {
              const status = statusBadge(tour.status);
              const isDraft = tour.status === "PLANNED";
              return (
                <div
                  key={tour.id}
                  onClick={() =>
                    router.push(isDraft ? `/dashboard/touren/neu?edit=${tour.id}` : `/dashboard/touren/${tour.id}`)
                  }
                  className="group rounded-2xl bg-white border border-forest-950/[0.06] shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 p-5 flex items-center gap-4 cursor-pointer animate-rise"
                  style={{ animationDelay: `${Math.min(i * 40, 300)}ms` }}
                >
                  <div className="w-12 h-12 rounded-2xl bg-forest-100 flex items-center justify-center text-2xl shrink-0">
                    {ACTIVITY_EMOJI[tour.activity] ?? "🏔️"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-display font-semibold text-forest-950 truncate">
                        {tour.routeName || tour.activity || "Tour"}
                      </h3>
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${status.cls}`}>
                        {status.dot && <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />}
                        {status.text}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-stone">
                      {tour.distanceKm && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {tour.distanceKm} km
                        </span>
                      )}
                      {tour.elevationUp && (
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> {tour.elevationUp} hm
                        </span>
                      )}
                      {tour.eta && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(tour.eta).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" })}
                        </span>
                      )}
                    </div>
                  </div>
                  {isDraft && (
                    <button
                      onClick={(e) => handleDeleteDraft(e, tour.id)}
                      disabled={deletingId === tour.id}
                      className="p-2 text-stone hover:text-alarm transition-colors shrink-0 disabled:opacity-40"
                      title="Entwurf löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <ChevronRight className="w-4 h-4 text-forest-950/20 group-hover:text-forest-950/45 group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
