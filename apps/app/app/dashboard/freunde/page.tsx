"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuth";
import { apiFetch, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import EmptyState from "@/components/EmptyState";
import AddFriendCard from "@/components/friends/AddFriendCard";
import PendingRequests from "@/components/friends/PendingRequests";
import { Users, Phone, ChevronRight, Plus, FolderPlus, MoreVertical, Trash2 } from "lucide-react";

const GROUP_COLORS = ["#2c694e", "#1d4ed8", "#dc2626", "#ea580c", "#7c3aed", "#0891b2", "#374151"];

export default function FreundePage() {
  const { user, loading: authLoading, logout } = useAuthGuard();
  const router = useRouter();
  const [friends, setFriends] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [myCode, setMyCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0]);
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user]);

  async function load() {
    try {
      const token = getToken();
      const [friendsData, qrData] = await Promise.all([
        apiFetch("/friends", {}, token ?? undefined).catch(() => ({ friends: [], pending: [], groups: [] })),
        apiFetch("/friends/qr", {}, token ?? undefined).catch(() => ({})),
      ]);
      setFriends(friendsData.friends ?? []);
      setPending(friendsData.pending ?? []);
      setGroups(friendsData.groups ?? []);
      setMyCode(qrData.qrCode ? String(qrData.qrCode).slice(0, 8).toUpperCase() : null);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    try {
      const token = getToken();
      const group = await apiFetch("/friends/groups", { method: "POST", body: JSON.stringify({ name: newGroupName.trim(), color: newGroupColor }) }, token ?? undefined);
      setGroups((prev) => [...prev, group]);
      setNewGroupName("");
      setShowNewGroup(false);
    } catch {}
  }

  async function handleAssignGroup(friendshipId: string, groupId: string | null) {
    setOpenMenuFor(null);
    try {
      const token = getToken();
      await apiFetch(`/friends/${friendshipId}/group`, { method: "PUT", body: JSON.stringify({ groupId }) }, token ?? undefined);
      load();
    } catch {}
  }

  async function handleRemoveFriend(friendshipId: string) {
    setOpenMenuFor(null);
    if (!confirm("Diese Verbindung wirklich entfernen?")) return;
    try {
      const token = getToken();
      await apiFetch(`/friends/${friendshipId}`, { method: "DELETE" }, token ?? undefined);
      load();
    } catch {}
  }

  const grouped = useMemo(() => {
    const byGroup = new Map<string, any[]>();
    const ungrouped: any[] = [];
    for (const f of friends) {
      if (f.groupId) {
        if (!byGroup.has(f.groupId)) byGroup.set(f.groupId, []);
        byGroup.get(f.groupId)!.push(f);
      } else {
        ungrouped.push(f);
      }
    }
    return { byGroup, ungrouped };
  }, [friends]);

  if (authLoading) {
    return <div className="min-h-screen bg-snow flex items-center justify-center text-stone text-sm">Lädt…</div>;
  }

  const onTourCount = friends.filter((f) => f.activeTour).length;

  function FriendRow({ f }: { f: any }) {
    const isOnTour = !!f.activeTour;
    const isAlarm = f.activeTour?.status === "ALARM";
    return (
      <div
        className={`group relative flex items-center gap-3 rounded-xl border p-3.5 transition-all hover:-translate-y-0.5 cursor-pointer ${
          isAlarm ? "bg-alarm-50 border-alarm-100" : "bg-white border-forest-950/[0.08] shadow-card hover:shadow-card-hover"
        }`}
        onClick={() => router.push(`/dashboard/freunde/${f.friendshipId}`)}
      >
        <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-forest-700 to-forest-900 text-white flex items-center justify-center font-display font-semibold text-sm shrink-0">
          {(f.name ?? "?")[0]?.toUpperCase()}
          {isOnTour && (
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${isAlarm ? "bg-alarm" : "bg-forest-500"}`} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-forest-950 truncate">{f.name}</p>
          {isOnTour ? (
            <p className={`text-[11px] font-medium ${isAlarm ? "text-alarm" : "text-forest-700"}`}>
              {isAlarm ? "Alarm — überfällig" : "Unterwegs"}
            </p>
          ) : (
            f.phone && <p className="text-[11px] text-stone">{f.phone}</p>
          )}
        </div>
        {f.phone && (
          <a
            href={`tel:${f.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 text-forest-950/30 hover:text-forest-700 transition-colors shrink-0"
          >
            <Phone className="w-3.5 h-3.5" />
          </a>
        )}
        <div className="relative shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setOpenMenuFor(openMenuFor === f.friendshipId ? null : f.friendshipId); }}
            className="p-1.5 text-forest-950/30 hover:text-forest-950/60 transition-colors"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
          {openMenuFor === f.friendshipId && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-1 z-10 bg-white rounded-xl border border-forest-950/10 shadow-lg py-1.5 w-44"
            >
              <p className="text-[10px] font-bold text-stone uppercase px-3 pt-1 pb-1.5">Gruppe</p>
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => handleAssignGroup(f.friendshipId, g.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-forest-950/80 hover:bg-forest-100/60 text-left"
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: g.color }} />
                  {g.name}
                </button>
              ))}
              {f.groupId && (
                <button onClick={() => handleAssignGroup(f.friendshipId, null)} className="w-full px-3 py-1.5 text-xs text-stone hover:bg-forest-100/60 text-left">
                  Aus Gruppe entfernen
                </button>
              )}
              <div className="border-t border-forest-950/5 mt-1 pt-1">
                <button onClick={() => handleRemoveFriend(f.friendshipId)} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-alarm hover:bg-alarm-50 text-left">
                  <Trash2 className="w-3 h-3" /> Entfernen
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-snow" onClick={() => openMenuFor && setOpenMenuFor(null)}>
      <Sidebar onLogout={logout} userName={user?.name} />

      <main className="flex-1 px-12 py-11 max-w-4xl">
        <div className="mb-7">
          <p className="text-xs font-semibold text-forest-700 uppercase tracking-wide mb-1.5">
            {friends.length} verbunden{onTourCount > 0 && ` · ${onTourCount} unterwegs`}
          </p>
          <h1 className="font-display text-3xl font-semibold text-forest-950 tracking-tight">Freunde</h1>
        </div>

        {!loading && (
          <div className="space-y-5 mb-7">
            <PendingRequests pending={pending} onResolved={load} />
            <AddFriendCard myCode={myCode} onAdded={load} />
          </div>
        )}

        {loading ? (
          <div className="text-stone text-sm">Lädt…</div>
        ) : friends.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Noch keine Freunde"
            body="Gib oben den Code eines Freundes ein, um euch zu verbinden."
          />
        ) : (
          <div className="space-y-7">
            {groups.map((g) => {
              const members = grouped.byGroup.get(g.id) ?? [];
              if (members.length === 0) return null;
              return (
                <div key={g.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: g.color }} />
                    <h3 className="text-xs font-bold text-forest-950/70 uppercase tracking-wide">{g.name}</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {members.map((f) => <FriendRow key={f.friendshipId} f={f} />)}
                  </div>
                </div>
              );
            })}

            {grouped.ungrouped.length > 0 && (
              <div>
                {groups.length > 0 && (
                  <h3 className="text-xs font-bold text-stone uppercase tracking-wide mb-3">Ohne Gruppe</h3>
                )}
                <div className="grid grid-cols-3 gap-3">
                  {grouped.ungrouped.map((f) => <FriendRow key={f.friendshipId} f={f} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Group management */}
        <div className="mt-9 pt-6 border-t border-forest-950/[0.06]">
          {!showNewGroup ? (
            <button
              onClick={() => setShowNewGroup(true)}
              className="flex items-center gap-1.5 text-sm text-forest-700 font-medium hover:underline"
            >
              <FolderPlus className="w-4 h-4" /> Neue Gruppe erstellen
            </button>
          ) : (
            <div className="flex items-center gap-2 max-w-md">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Gruppenname, z. B. Bergfreunde"
                className="flex-1 rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30"
                autoFocus
              />
              <div className="flex items-center gap-1">
                {GROUP_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewGroupColor(c)}
                    className={`w-6 h-6 rounded-full transition-transform ${newGroupColor === c ? "scale-110 ring-2 ring-offset-1 ring-forest-950" : ""}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <button onClick={handleCreateGroup} className="rounded-xl bg-forest-700 text-white px-4 py-2.5 text-sm font-semibold hover:bg-forest-600 transition-colors shrink-0">
                Erstellen
              </button>
              <button onClick={() => setShowNewGroup(false)} className="text-sm text-stone hover:text-forest-950 px-2">
                Abbrechen
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
