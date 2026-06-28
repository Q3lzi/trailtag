"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Check, X } from "lucide-react";

export default function PendingRequests({ pending, onResolved }: { pending: any[]; onResolved: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);

  if (pending.length === 0) return null;

  async function respond(id: string, action: "accept" | "decline") {
    setBusyId(id);
    try {
      const token = getToken();
      await apiFetch(`/friends/${id}/${action}`, { method: "POST" }, token ?? undefined);
      onResolved();
    } catch {
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5">
      <h3 className="text-[11px] font-bold text-amber-800 uppercase tracking-wide mb-3">
        Anfragen · {pending.length}
      </h3>
      <div className="space-y-2">
        {pending.map((p) => (
          <div key={p.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center text-sm font-bold">
                {p.initiator?.name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <span className="text-sm font-medium text-forest-950">{p.initiator?.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => respond(p.id, "accept")}
                disabled={busyId === p.id}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-forest-700 text-white hover:bg-forest-600 transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => respond(p.id, "decline")}
                disabled={busyId === p.id}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-forest-950/[0.06] text-forest-950/60 hover:bg-alarm-50 hover:text-alarm transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
