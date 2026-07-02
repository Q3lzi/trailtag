"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LicensePlate from "@/components/LicensePlate";
import { Navigation, UserCircle } from "lucide-react";

/**
 * Horizontal row of participant avatars with a status ring — makes "who's
 * in, who's still pending, is anyone overdue" readable in one glance.
 * Tapping opens a small action menu (navigate to their live position,
 * view profile) instead of jumping straight to one destination — someone
 * mid-tour is more likely to want walking directions to a teammate than a
 * profile page, and that choice should be explicit, including for your
 * own avatar (which has no "walk to yourself" option, just your profile).
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
  const [openId, setOpenId] = useState<string | null>(null);

  function ringClass(status: string) {
    if (status === "ALARM") return "ring-2 ring-alarm animate-pulse";
    if (status === "ACTIVE") return "ring-2 ring-forest-500";
    if (status === "COMPLETED") return "ring-2 ring-forest-950/15";
    return "ring-2 ring-forest-700/40"; // PLANNED / ready-to-start
  }

  return (
    <div className="flex items-start gap-4 flex-wrap py-1">
      {tours.map((t) => {
        const isMe = t.userId === currentUserId;
        const hasPosition = t.lastLat != null && t.lastLng != null;
        return (
          <div key={t.id} className="relative shrink-0">
            <button
              onClick={() => setOpenId(openId === t.id ? null : t.id)}
              className="flex flex-col items-center gap-1.5 group"
            >
              <div className={`w-12 h-12 rounded-full ring-offset-2 ring-offset-snow flex items-center justify-center font-display font-semibold text-white text-sm transition-transform group-hover:scale-105 ${ringClass(t.status)}`}
                style={{ background: t.status === "ALARM" ? "#ba1a1a" : "#2c694e" }}
              >
                {(t.user?.name ?? "?")[0]?.toUpperCase()}
              </div>
              <span className="text-[11px] font-medium text-forest-950/70 max-w-[64px] truncate">
                {isMe ? "Du" : t.user?.name?.split(" ")[0]}
              </span>
              {t.userId === organizerId && (
                <span className="text-[9px] font-bold text-forest-700 -mt-1">ORGANISATOR</span>
              )}
              {t.vehicle?.plate && (
                <div className="scale-[0.55] origin-top -mt-1">
                  <LicensePlate text={t.vehicle.plate} size="sm" />
                </div>
              )}
            </button>

            {openId === t.id && (
              <div className="absolute z-20 top-full mt-1 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-lg border border-forest-950/[0.08] py-1.5 min-w-[180px]">
                {!isMe && hasPosition && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${t.lastLat},${t.lastLng}&travelmode=walking`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3.5 py-2 text-sm text-forest-950/80 hover:bg-forest-100/50 transition-colors"
                  >
                    <Navigation className="w-3.5 h-3.5 text-forest-700" /> Zu {t.user?.name?.split(" ")[0]} laufen
                  </a>
                )}
                <button
                  onClick={() => router.push(isMe ? "/dashboard/profil" : `/dashboard/freunde/${t.userId}`)}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-forest-950/80 hover:bg-forest-100/50 transition-colors"
                >
                  <UserCircle className="w-3.5 h-3.5 text-forest-700" /> {isMe ? "Mein Profil" : "Profil ansehen"}
                </button>
                <button
                  onClick={() => router.push(`/dashboard/touren/${t.id}`)}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-forest-950/80 hover:bg-forest-100/50 transition-colors"
                >
                  Tour-Details
                </button>
              </div>
            )}
          </div>
        );
      })}

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
