"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MapPinned, Car, Users, UserCircle, LogOut, Mountain } from "lucide-react";
const NAV = [
  { href: "/dashboard", label: "Übersicht", icon: LayoutDashboard },
  { href: "/dashboard/touren", label: "Touren", icon: MapPinned },
  { href: "/dashboard/fahrzeuge", label: "Fahrzeuge", icon: Car },
  { href: "/dashboard/freunde", label: "Freunde", icon: Users },
  { href: "/dashboard/profil", label: "Profil", icon: UserCircle },
];
export default function Sidebar({ onLogout, userName }: { onLogout: () => void; userName?: string }) {
  const pathname = usePathname();
  return (
    <aside className="w-64 bg-forest-950 text-forest-100 flex flex-col shrink-0 min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 contour-texture pointer-events-none" />
      {/* Ambient radial glow, anchored top-left, gives the sidebar real depth */}
      <div
        className="absolute -top-24 -left-24 w-72 h-72 rounded-full opacity-[0.18] pointer-events-none"
        style={{ background: "radial-gradient(circle, #4a8f6f, transparent 70%)" }}
      />
      <div className="relative px-7 py-7 flex items-center gap-2.5">
        <Mountain className="w-5 h-5 text-forest-500" strokeWidth={2} />
        <span className="font-display text-xl font-semibold text-white tracking-tight">Trailtag</span>
      </div>
      <nav className="relative flex-1 px-4 space-y-0.5 mt-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                active ? "text-white" : "text-forest-100/55 hover:text-forest-100/90"
              }`}
            >
              {active && (
                <span className="absolute inset-0 bg-white/[0.08] rounded-xl" style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.06)" }} />
              )}
              {!active && (
                <span className="absolute inset-0 bg-white/[0.04] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              )}
              <Icon
                className={`relative w-[18px] h-[18px] transition-colors ${active ? "text-forest-500" : "text-forest-100/40 group-hover:text-forest-100/70"}`}
                strokeWidth={1.8}
              />
              <span className="relative">{label}</span>
              {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-forest-500 rounded-full -ml-1" />}
            </Link>
          );
        })}
      </nav>
      <div className="relative px-4 pb-5 pt-3 border-t border-white/[0.06]">
        {userName && (
          <div className="flex items-center gap-2.5 px-3.5 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-forest-600 to-forest-800 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {userName[0]?.toUpperCase()}
            </div>
            <span className="text-sm text-forest-100/75 truncate">{userName}</span>
          </div>
        )}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-forest-100/50 hover:bg-white/[0.04] hover:text-forest-100/85 transition-all"
        >
          <LogOut className="w-[18px] h-[18px]" strokeWidth={1.8} />
          Abmelden
        </button>
      </div>
    </aside>
  );
}
