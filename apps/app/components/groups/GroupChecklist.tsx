"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useAuthGuard } from "@/lib/useAuth";
import { CheckSquare, Plus, X, Users, User } from "lucide-react";

const ITEM_LIMIT = 40;

/**
 * Shared "don't forget this" checklist — a memory aid for the group to
 * fill together. Items are either SHARED (one confirmation covers
 * everyone, e.g. first-aid kit) or INDIVIDUAL (each participant needs
 * their own gear, e.g. headlamp/tent — one person checking their box must
 * never read as "the group has this covered").
 */
export default function GroupChecklist({ groupId, bare = false }: { groupId: string; bare?: boolean }) {
  const { user } = useAuthGuard();
  const [items, setItems] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [newItemType, setNewItemType] = useState<"SHARED" | "INDIVIDUAL">("SHARED");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, [groupId]);

  async function load() {
    try {
      const token = getToken();
      const data = await apiFetch(`/tour-groups/${groupId}/checklist`, {}, token ?? undefined);
      setItems(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function add() {
    if (!text.trim()) return;
    if (items.length >= ITEM_LIMIT) {
      setError(`Maximal ${ITEM_LIMIT} Punkte pro Checkliste`);
      return;
    }
    setError("");
    try {
      const token = getToken();
      const item = await apiFetch(
        `/tour-groups/${groupId}/checklist`,
        { method: "POST", body: JSON.stringify({ text, itemType: newItemType }) },
        token ?? undefined
      );
      setItems((prev) => [...prev, item]);
      setText("");
    } catch (err: any) {
      setError(err?.message ?? "Konnte nicht hinzugefügt werden");
    }
  }

  async function toggle(item: any) {
    const isIndividual = item.itemType === "INDIVIDUAL";
    const iChecked = isIndividual ? item.checks?.some((c: any) => c.userId === user?.id) : item.done;

    // Optimistic update
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== item.id) return i;
        if (isIndividual) {
          const checks = iChecked
            ? (i.checks ?? []).filter((c: any) => c.userId !== user?.id)
            : [...(i.checks ?? []), { userId: user?.id }];
          return { ...i, checks };
        }
        return { ...i, done: !i.done };
      })
    );

    try {
      const token = getToken();
      await apiFetch(`/tour-groups/${groupId}/checklist/${item.id}`, { method: "PUT", body: JSON.stringify({ done: !iChecked }) }, token ?? undefined);
    } catch {}
  }

  async function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      const token = getToken();
      await apiFetch(`/tour-groups/${groupId}/checklist/${id}`, { method: "DELETE" }, token ?? undefined);
    } catch {}
  }

  const doneCount = items.filter((i) => (i.itemType === "INDIVIDUAL" ? i.checks?.some((c: any) => c.userId === user?.id) : i.done)).length;

  return (
    <div className={bare ? "" : "rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-6"}>
      {!bare && (
        <h3 className="font-display font-semibold text-sm text-forest-950 mb-4 flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-forest-700" /> Checkliste
          {items.length > 0 && <span className="text-xs text-stone font-normal">{doneCount}/{items.length}</span>}
        </h3>
      )}

      {loading ? (
        <p className="text-sm text-stone">Lädt…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-stone mb-4">Noch nichts auf der Liste — z. B. Erste-Hilfe-Set (gemeinsam) oder Stirnlampe (jeder einzeln).</p>
      ) : (
        <div className="space-y-1.5 mb-4">
          {items.map((item) => {
            const isIndividual = item.itemType === "INDIVIDUAL";
            const myCheck = isIndividual && item.checks?.some((c: any) => c.userId === user?.id);
            const checkedCount = isIndividual ? (item.checks?.length ?? 0) : item.done ? 1 : 0;
            return (
              <div key={item.id} className="group flex items-center gap-2.5 py-1">
                <button
                  onClick={() => toggle(item)}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                    (isIndividual ? myCheck : item.done) ? "bg-forest-700 border-forest-700" : "border-forest-950/20 hover:border-forest-700/50"
                  }`}
                >
                  {(isIndividual ? myCheck : item.done) && <CheckSquare className="w-3 h-3 text-white" strokeWidth={3} />}
                </button>
                <span className={`text-sm flex-1 ${(isIndividual ? myCheck : item.done) ? "text-stone line-through" : "text-forest-950/85"}`}>
                  {item.text}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-stone/80 shrink-0" title={isIndividual ? "Jeder einzeln" : "Gemeinsam — einmal reicht"}>
                  {isIndividual ? <User className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                  {isIndividual && checkedCount > 0 && `${checkedCount}`}
                </span>
                <button onClick={() => remove(item.id)} className="opacity-0 group-hover:opacity-100 text-stone hover:text-alarm transition-opacity shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="text-xs text-alarm mb-2">{error}</p>}

      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Punkt hinzufügen…"
          disabled={items.length >= ITEM_LIMIT}
          className="flex-1 rounded-xl border border-forest-950/15 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30 disabled:opacity-50"
        />
        <button
          onClick={add}
          disabled={!text.trim() || items.length >= ITEM_LIMIT}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-forest-700 text-white hover:bg-forest-600 transition-colors disabled:opacity-50 shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Shared vs. individual toggle for the item about to be added */}
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setNewItemType("SHARED")}
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors ${
            newItemType === "SHARED" ? "bg-forest-100 border-forest-700 text-forest-700" : "border-forest-950/15 text-forest-950/60"
          }`}
        >
          <Users className="w-3 h-3" /> Gemeinsam
        </button>
        <button
          type="button"
          onClick={() => setNewItemType("INDIVIDUAL")}
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors ${
            newItemType === "INDIVIDUAL" ? "bg-forest-100 border-forest-700 text-forest-700" : "border-forest-950/15 text-forest-950/60"
          }`}
        >
          <User className="w-3 h-3" /> Jeder einzeln
        </button>
      </div>
    </div>
  );
}
