"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { CheckSquare, Plus, X } from "lucide-react";

/**
 * Simple shared "don't forget this" checklist — a memory aid for the group
 * to fill together (first-aid kit, headlamps, permits), not an assignment
 * system tracking who brings what.
 */
export default function GroupChecklist({ groupId, bare = false }: { groupId: string; bare?: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

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
    try {
      const token = getToken();
      const item = await apiFetch(`/tour-groups/${groupId}/checklist`, { method: "POST", body: JSON.stringify({ text }) }, token ?? undefined);
      setItems((prev) => [...prev, item]);
      setText("");
    } catch {}
  }

  async function toggle(item: any) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)));
    try {
      const token = getToken();
      await apiFetch(`/tour-groups/${groupId}/checklist/${item.id}`, { method: "PUT", body: JSON.stringify({ done: !item.done }) }, token ?? undefined);
    } catch {}
  }

  async function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      const token = getToken();
      await apiFetch(`/tour-groups/${groupId}/checklist/${id}`, { method: "DELETE" }, token ?? undefined);
    } catch {}
  }

  const doneCount = items.filter((i) => i.done).length;

  const wrapperClass = bare ? "" : "rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-6";

  return (
    <div className={wrapperClass}>
      {!bare && (
        <h3 className="font-display font-semibold text-sm text-forest-950 mb-4 flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-forest-700" /> Checkliste
          {items.length > 0 && <span className="text-xs text-stone font-normal">{doneCount}/{items.length}</span>}
        </h3>
      )}

      {loading ? (
        <p className="text-sm text-stone">Lädt…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-stone mb-4">Noch nichts auf der Liste — z. B. Erste-Hilfe-Set, Stirnlampe, Bewilligung.</p>
      ) : (
        <div className="space-y-1.5 mb-4">
          {items.map((item) => (
            <div key={item.id} className="group flex items-center gap-2.5 py-1">
              <button
                onClick={() => toggle(item)}
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                  item.done ? "bg-forest-700 border-forest-700" : "border-forest-950/20 hover:border-forest-700/50"
                }`}
              >
                {item.done && <CheckSquare className="w-3 h-3 text-white" strokeWidth={3} />}
              </button>
              <span className={`text-sm flex-1 ${item.done ? "text-stone line-through" : "text-forest-950/85"}`}>
                {item.text}
              </span>
              <span className="text-[10px] text-stone/70 shrink-0">{item.addedBy?.name}</span>
              <button onClick={() => remove(item.id)} className="opacity-0 group-hover:opacity-100 text-stone hover:text-alarm transition-opacity shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Punkt hinzufügen…"
          className="flex-1 rounded-xl border border-forest-950/15 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30"
        />
        <button
          onClick={add}
          disabled={!text.trim()}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-forest-700 text-white hover:bg-forest-600 transition-colors disabled:opacity-50 shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
