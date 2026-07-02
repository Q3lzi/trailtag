"use client";

import { useRouter } from "next/navigation";

/**
 * Horizontal row of participant avatars with a status ring — makes "who's
 * in, who's still pending, is anyone overdue" readable in one glance,
 * instead of a plain vertical list that reads no differently from any
 * other settings page. Ring color carries the meaning: solid green
 * (active/ready), pulsing red (alarm), grey (planned), dashed (invited,
 * not yet joined).
 */
export default function GroupParticipantStrip({
  tours,
  pendingInvites,
  organizerId,
  currentUserId,
}: {
  tours: any[];
  pendingInvites: any[];
  organizerId: string;
  currentUserId?: string;
}) {
  const router = useRouter();

  function ringClass(status: string) {
    if (status === "ALARM") return "ring-2 ring-alarm animate-pulse";
    if (status === "ACTIVE") return "ring-2 ring-forest-500";
    if (status === "COMPLETED") return "ring-2 ring-forest-950/15";
    return "ring-2 ring-forest-700/40"; // PLANNED / ready-to-start
  }

  return (
    <div className="flex items-center gap-4 overflow-x-auto pb-1">
      {tours.map((t) => (
        <button
          key={t.id}
          onClick={() => router.push(t.userId === currentUserId ? `/dashboard/touren/${t.id}` : `/dashboard/freunde/${t.userId}`)}
          className="flex flex-col items-center gap-1.5 shrink-0 group"
        >
          <div className={`w-12 h-12 rounded-full ring-offset-2 ring-offset-snow flex items-center justify-center font-display font-semibold text-white text-sm transition-transform group-hover:scale-105 ${ringClass(t.status)}`}
            style={{ background: t.status === "ALARM" ? "#ba1a1a" : "#2c694e" }}
          >
            {(t.user?.name ?? "?")[0]?.toUpperCase()}
          </div>
          <span className="text-[11px] font-medium text-forest-950/70 max-w-[64px] truncate">
            {t.userId === currentUserId ? "Du" : t.user?.name?.split(" ")[0]}
          </span>
          {t.userId === organizerId && (
            <span className="text-[9px] font-bold text-forest-700 -mt-1">ORGANISATOR</span>
          )}
        </button>
      ))}

      {pendingInvites.map((invite: any) => (
        <div key={invite.id} className="flex flex-col items-center gap-1.5 shrink-0 opacity-50">
          <div className="w-12 h-12 rounded-full border-2 border-dashed border-forest-950/25 flex items-center justify-center font-display font-semibold text-forest-950/40 text-sm">
            {(invite.invitee?.name ?? "?")[0]?.toUpperCase()}
          </div>
          <span className="text-[11px] font-medium text-forest-950/50 max-w-[64px] truncate">
            {invite.invitee?.name?.split(" ")[0]}
          </span>
          <span className="text-[9px] font-medium text-forest-950/40 -mt-1">Eingeladen</span>
        </div>
      ))}
    </div>
  );
}
