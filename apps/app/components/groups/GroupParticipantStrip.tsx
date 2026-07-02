"use client";

import { useRouter } from "next/navigation";
import LicensePlate from "@/components/LicensePlate";
import { Navigation, ChevronRight, UserPlus } from "lucide-react";

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #2c694e, #1d4536)",
  "linear-gradient(135deg, #3b6fd4, #1d3f8f)",
  "linear-gradient(135deg, #d4573b, #8f2a1d)",
  "linear-gradient(135deg, #c98a2e, #8a5a12)",
  "linear-gradient(135deg, #7c4fd4, #4a2a8f)",
  "linear-gradient(135deg, #2e9bc9, #12678a)",
];

function statusInfo(status: string) {
  if (status === "ALARM") return { text: "Überfällig", dot: "bg-alarm", dotAnim: "animate-pulse" };
  if (status === "ACTIVE") return { text: "Unterwegs", dot: "bg-forest-500", dotAnim: "" };
  if (status === "COMPLETED") return { text: "Zurück", dot: "bg-forest-950/25", dotAnim: "" };
  return { text: "Bereit zum Start", dot: "bg-amber-500", dotAnim: "" };
}

/**
 * Participant roster styled after Apple's Find My — full-width rows with a
 * large avatar, a real status line (not just a colour), and the actions
 * that matter (navigate to them, view profile) inline, rather than a row
 * of small plain-coloured circles that reads more like initials in a
 * settings list than "people I'm out here with".
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

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {tours.map((t, i) => {
        const isMe = t.userId === currentUserId;
        const hasPosition = t.lastLat != null && t.lastLng != null;
        const status = statusInfo(t.status);
        const isAlarm = t.status === "ALARM";
        return (
          <div
            key={t.id}
            className={`flex items-center gap-3.5 rounded-2xl px-4 py-3 transition-colors ${
              isAlarm ? "bg-alarm-50" : "bg-white border border-forest-950/[0.06] shadow-card"
            }`}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center font-display font-semibold text-white text-base shrink-0 shadow-sm"
              style={{ background: isAlarm ? "#ba1a1a" : AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length] }}
            >
              {(t.user?.name ?? "?")[0]?.toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-forest-950 truncate">
                  {isMe ? "Du" : t.user?.name}
                </p>
                {t.userId === organizerId && (
                  <span className="text-[9px] font-bold text-forest-700 bg-forest-100 px-1.5 py-0.5 rounded-full shrink-0">ORGANISATOR</span>
                )}
              </div>
              <p className="flex items-center gap-1.5 text-xs text-stone mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot} ${status.dotAnim}`} />
                {status.text}
                {t.eta && ` · Rückkehr ${new Date(t.eta).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}`}
              </p>
            </div>

            {t.vehicle?.plate && (
              <div className="scale-75 origin-right shrink-0 hidden sm:block">
                <LicensePlate text={t.vehicle.plate} size="sm" />
              </div>
            )}

            <div className="flex items-center gap-1 shrink-0">
              {!isMe && hasPosition && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${t.lastLat},${t.lastLng}&travelmode=walking`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-forest-100 text-forest-700 hover:bg-forest-100/70 transition-colors"
                  title={`Zu ${t.user?.name?.split(" ")[0]} laufen`}
                >
                  <Navigation className="w-4 h-4" />
                </a>
              )}
              <button
                onClick={() => router.push(isMe ? "/dashboard/profil" : `/dashboard/freunde/${t.userId}`)}
                className="flex items-center justify-center w-9 h-9 rounded-full text-forest-950/30 hover:text-forest-950/60 hover:bg-forest-100/50 transition-colors"
                title="Profil ansehen"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}

      {pendingInvites.map((invite: any) => (
        <div key={invite.id} className="flex items-center gap-3.5 rounded-2xl px-4 py-3 bg-forest-950/[0.02] border border-dashed border-forest-950/15">
          <div className="w-12 h-12 rounded-full border-2 border-dashed border-forest-950/20 flex items-center justify-center font-display font-semibold text-forest-950/35 text-base shrink-0">
            {(invite.invitee?.name ?? "?")[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-forest-950/60 truncate">{invite.invitee?.name}</p>
            <p className="flex items-center gap-1.5 text-xs text-stone mt-0.5">
              <UserPlus className="w-3 h-3" /> Einladung ausstehend
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
