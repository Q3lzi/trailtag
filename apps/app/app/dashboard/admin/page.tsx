"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuth";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import {
  ShieldCheck, Users, MapPinned, Users2, AlertTriangle, Search, Lock, Unlock,
  Trash2, ShieldOff, Shield,
} from "lucide-react";

type Tab = "overview" | "users" | "tours" | "groups" | "alarms";

/**
 * Admin area — its own auth check (fetches /profile directly) rather than
 * relying on a shared hook, since access here is gated by isAdmin, not
 * just "logged in". Scoped for now to what was asked for: users, tours,
 * groups, alarm history, stats — settings/branding and paid tiers are
 * explicitly future work.
 */
export default function AdminPage() {
  const router = useRouter();
  const { user: authUser, loading: authLoading, logout } = useAuthGuard();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [tours, setTours] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [alarms, setAlarms] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!authLoading && authUser) checkAdminAccess();
    if (!authLoading && !authUser) router.push("/login");
  }, [authLoading, authUser]);

  async function checkAdminAccess() {
    try {
      const token = getToken();
      const profile = await apiFetch("/profile", {}, token ?? undefined);
      if (!profile.isAdmin) {
        router.push("/dashboard");
        return;
      }
      setIsAdmin(true);
      loadTab("overview");
    } catch {
      router.push("/dashboard");
    }
  }

  async function loadTab(t: Tab) {
    setTab(t);
    setLoading(true);
    setActionError("");
    try {
      const token = getToken();
      if (t === "overview") setStats(await apiFetch("/admin/stats", {}, token ?? undefined));
      if (t === "users") setUsers(await apiFetch(`/admin/users${search ? `?search=${encodeURIComponent(search)}` : ""}`, {}, token ?? undefined));
      if (t === "tours") setTours(await apiFetch("/admin/tours", {}, token ?? undefined));
      if (t === "groups") setGroups(await apiFetch("/admin/groups", {}, token ?? undefined));
      if (t === "alarms") setAlarms(await apiFetch("/admin/alarms", {}, token ?? undefined));
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function toggleLock(u: any) {
    setActionError("");
    try {
      const token = getToken();
      const updated = await apiFetch(`/admin/users/${u.id}`, { method: "PUT", body: JSON.stringify({ isLocked: !u.isLocked }) }, token ?? undefined);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...updated } : x)));
    } catch (err: any) {
      setActionError(err?.message ?? "Fehlgeschlagen");
    }
  }

  async function toggleAdmin(u: any) {
    setActionError("");
    try {
      const token = getToken();
      const updated = await apiFetch(`/admin/users/${u.id}`, { method: "PUT", body: JSON.stringify({ isAdmin: !u.isAdmin }) }, token ?? undefined);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...updated } : x)));
    } catch (err: any) {
      setActionError(err?.message ?? "Fehlgeschlagen");
    }
  }

  async function deleteUser(u: any) {
    if (!confirm(`${u.name} (${u.email}) wirklich endgültig löschen?`)) return;
    setActionError("");
    try {
      const token = getToken();
      await apiFetch(`/admin/users/${u.id}`, { method: "DELETE" }, token ?? undefined);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (err: any) {
      setActionError(err?.message ?? "Fehlgeschlagen");
    }
  }

  if (authLoading || isAdmin === null) {
    return <div className="min-h-screen bg-snow flex items-center justify-center text-stone text-sm">Lädt…</div>;
  }

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: "overview", label: "Übersicht", icon: ShieldCheck },
    { key: "users", label: "Nutzer", icon: Users },
    { key: "tours", label: "Touren", icon: MapPinned },
    { key: "groups", label: "Gruppen", icon: Users2 },
    { key: "alarms", label: "Alarme", icon: AlertTriangle },
  ];

  return (
    <div className="flex min-h-screen bg-snow">
      <Sidebar onLogout={logout} userName={authUser?.name} isAdmin />

      <main className="flex-1 px-10 py-9 max-w-[1400px]">
        <div className="mb-7">
          <p className="text-xs font-semibold text-forest-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Admin
          </p>
          <h1 className="font-display text-3xl font-semibold text-forest-950 tracking-tight">Verwaltung</h1>
        </div>

        <div className="flex items-center gap-1.5 mb-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => loadTab(t.key)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                tab === t.key ? "bg-forest-950 text-white" : "bg-white text-forest-950/60 border border-forest-950/10 hover:border-forest-950/25"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {actionError && (
          <div className="bg-alarm-50 border border-alarm-100 text-alarm text-sm rounded-xl px-4 py-3 mb-5">{actionError}</div>
        )}

        {loading ? (
          <div className="text-stone text-sm">Lädt…</div>
        ) : tab === "overview" && stats ? (
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Nutzer gesamt" value={stats.totalUsers} />
            <StatCard label="Aktive Touren" value={stats.activeTours} accent />
            <StatCard label="Touren gesamt" value={stats.totalTours} />
            <StatCard label="Gemeinsame Touren" value={stats.totalGroups} />
            <StatCard label="Alarme (30 Tage)" value={stats.alarmsLast30d} accent={stats.alarmsLast30d > 0} />
            <StatCard label="Gesperrte Konten" value={stats.lockedUsers} />
          </div>
        ) : tab === "users" ? (
          <div>
            <div className="relative mb-4 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-forest-950/30" />
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadTab("users")}
                placeholder="Name oder E-Mail suchen…"
                className="w-full rounded-xl border border-forest-950/10 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/20"
              />
            </div>
            <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card overflow-hidden">
              {users.map((u, i) => (
                <div key={u.id} className={`flex items-center gap-3 px-5 py-3.5 ${i > 0 ? "border-t border-forest-950/[0.05]" : ""} ${u.isLocked ? "bg-alarm-50/40" : ""}`}>
                  <div className="w-9 h-9 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center text-sm font-bold shrink-0">
                    {u.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-forest-950 truncate">{u.name}</p>
                      {u.isAdmin && <span className="text-[9px] font-bold text-forest-700 bg-forest-100 px-1.5 py-0.5 rounded-full">ADMIN</span>}
                      {u.isLocked && <span className="text-[9px] font-bold text-alarm bg-alarm-50 px-1.5 py-0.5 rounded-full">GESPERRT</span>}
                    </div>
                    <p className="text-xs text-stone">{u.email} · {u._count?.tours ?? 0} Touren</p>
                  </div>
                  <button onClick={() => toggleAdmin(u)} title={u.isAdmin ? "Admin entziehen" : "Zu Admin machen"} className="p-2 text-forest-950/40 hover:text-forest-700 transition-colors">
                    {u.isAdmin ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                  </button>
                  <button onClick={() => toggleLock(u)} title={u.isLocked ? "Entsperren" : "Sperren"} className="p-2 text-forest-950/40 hover:text-forest-700 transition-colors">
                    {u.isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </button>
                  <button onClick={() => deleteUser(u)} title="Löschen" className="p-2 text-forest-950/40 hover:text-alarm transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : tab === "tours" ? (
          <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card overflow-hidden">
            {tours.map((t, i) => (
              <div key={t.id} className={`flex items-center gap-3 px-5 py-3.5 ${i > 0 ? "border-t border-forest-950/[0.05]" : ""}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-forest-950 truncate">{t.routeName || t.activity}</p>
                  <p className="text-xs text-stone">{t.user?.name} · {t.user?.email}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-forest-100 text-forest-700 shrink-0">{t.status}</span>
                <span className="text-xs text-stone shrink-0">{new Date(t.createdAt).toLocaleDateString("de-CH")}</span>
              </div>
            ))}
          </div>
        ) : tab === "groups" ? (
          <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card overflow-hidden">
            {groups.map((g, i) => (
              <div key={g.id} className={`flex items-center gap-3 px-5 py-3.5 ${i > 0 ? "border-t border-forest-950/[0.05]" : ""}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-forest-950 truncate">{g.routeName || "Gemeinsame Tour"}</p>
                  <p className="text-xs text-stone">Organisator: {g.organizer?.name} · {g.tours.length} Teilnehmer</p>
                </div>
                <span className="text-xs text-stone shrink-0">{new Date(g.createdAt).toLocaleDateString("de-CH")}</span>
              </div>
            ))}
          </div>
        ) : tab === "alarms" ? (
          <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card overflow-hidden">
            {alarms.length === 0 ? (
              <p className="text-sm text-stone px-5 py-6">Keine Alarme aufgezeichnet.</p>
            ) : (
              alarms.map((a, i) => (
                <div key={a.id} className={`flex items-center gap-3 px-5 py-3.5 ${i > 0 ? "border-t border-forest-950/[0.05]" : ""}`}>
                  <AlertTriangle className="w-4 h-4 text-alarm shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-forest-950 truncate">{a.tour?.user?.name} · Stufe {a.stage}</p>
                    <p className="text-xs text-stone">{a.tour?.routeName || a.tour?.activity} · {a.channel}{a.delivered ? " · zugestellt" : ""}</p>
                  </div>
                  <span className="text-xs text-stone shrink-0">{new Date(a.triggeredAt).toLocaleString("de-CH")}</span>
                </div>
              ))
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}

function StatCard({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border shadow-card p-5 ${accent ? "bg-forest-950 border-forest-950" : "bg-white border-forest-950/[0.06]"}`}>
      <p className={`text-xs mb-1.5 ${accent ? "text-white/60" : "text-stone"}`}>{label}</p>
      <p className={`font-display text-3xl font-semibold ${accent ? "text-white" : "text-forest-950"}`}>{value}</p>
    </div>
  );
}
