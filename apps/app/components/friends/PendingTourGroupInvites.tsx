"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Users, X, Mountain } from "lucide-react";

const ACTIVITY_EMOJI: Record<string, string> = {
  WANDERN: "🥾", BERGTOUR: "⛰️", KLETTERN: "🧗", KLETTERSTEIG: "🪢",
  TRAILRUNNING: "🏃", MOUNTAINBIKE: "🚵", RADSPORT: "🚴",
  SKI_SNOWBOARD: "🎿", SKITOUR: "⛷️", KANU_KAJAK: "🛶",
  PARAGLIDING: "🪂", ANDERE: "🏔️",
};

/**
 * Pending invitations to join a shared hike (TourGroup). Accepting routes
 * to the new-tour wizard pre-filled for this group rather than attaching
 * immediately — joining a shared tour still means setting your own ETA and
 * confirming your own emergency contacts apply, which matters too much to
 * skip with a single tap.
 */
export default function PendingTourGroupInvites({
  groups,
  onDeclined,
}: {
  groups: any[]; // TourGroup objects that include an invite with status PENDING for the current user
  onDeclined: () => void;
}) {
  const router = useRouter();
  const [decliningId, setDecliningId] = useState<string | null>(null);

  if (groups.length === 0) return null;

  async function decline(groupId: string, inviteId: string) {
    setDecliningId(inviteId);
    try {
      const token = getToken();
      await apiFetch(`/tour-groups/${groupId}/invites/${inviteId}/decline`, { method: "POST" }, token ?? undefined);
      onDeclined();
    } catch {
    } finally {
      setDecliningId(null);
    }
  }

  return (
    <div className="rounded-2xl bg-forest-100/60 border border-forest-700/15 p-5">
      <h3 className="text-[11px] font-bold text-forest-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5" /> Einladungen zu gemeinsamen Touren · {groups.length}
      </h3>
      <div className="space-y-2">
        {groups.map((g) => {
          const myInvite = g.invites?.find((i: any) => i.status === "PENDING");
          return (
            <div key={g.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-lg">{ACTIVITY_EMOJI[g.activity] ?? "🏔️"}</span>
                <div>
                  <p className="text-sm font-semibold text-forest-950">{g.routeName || "Gemeinsame Tour"}</p>
                  <p className="text-xs text-stone">Organisiert von {g.organizer?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push(`/dashboard/gruppen/${g.id}`)}
                  className="flex items-center gap-1.5 rounded-lg bg-forest-700 text-white px-3 py-1.5 text-xs font-semibold hover:bg-forest-600 transition-colors"
                >
                  <Mountain className="w-3 h-3" /> Beitreten
                </button>
                <button
                  onClick={() => myInvite && decline(g.id, myInvite.id)}
                  disabled={decliningId === myInvite?.id}
                  className="p-1.5 text-stone hover:text-alarm transition-colors disabled:opacity-40"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
