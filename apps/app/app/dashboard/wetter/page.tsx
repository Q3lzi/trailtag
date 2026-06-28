"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuth";
import Sidebar from "@/components/Sidebar";
import WeatherPanel from "@/components/weather/WeatherPanel";
import { ArrowLeft } from "lucide-react";

function WeatherDetailContent() {
  const { user, loading: authLoading, logout } = useAuthGuard();
  const router = useRouter();
  const searchParams = useSearchParams();

  const lat = searchParams.get("lat") ? Number(searchParams.get("lat")) : null;
  const lng = searchParams.get("lng") ? Number(searchParams.get("lng")) : null;
  const activity = searchParams.get("activity") ?? undefined;
  const label = searchParams.get("label") ?? "Wetter";
  const backHref = searchParams.get("back") ?? "/dashboard";

  if (authLoading) {
    return <div className="min-h-screen bg-snow flex items-center justify-center text-stone text-sm">Lädt…</div>;
  }

  return (
    <div className="flex min-h-screen bg-snow">
      <Sidebar onLogout={logout} userName={user?.name} />

      <main className="flex-1 px-12 py-11 max-w-2xl">
        <button
          onClick={() => router.push(backHref)}
          className="flex items-center gap-1.5 text-sm text-stone hover:text-forest-950 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Zurück
        </button>

        <div className="mb-7">
          <p className="text-xs font-semibold text-forest-700 uppercase tracking-wide mb-1.5">Wetterbericht</p>
          <h1 className="font-display text-3xl font-semibold text-forest-950 tracking-tight">{label}</h1>
        </div>

        {lat != null && lng != null ? (
          <WeatherPanel lat={lat} lng={lng} activity={activity} />
        ) : (
          <p className="text-sm text-stone">Kein Standort angegeben.</p>
        )}
      </main>
    </div>
  );
}

export default function WeatherDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-snow flex items-center justify-center text-stone text-sm">Lädt…</div>}>
      <WeatherDetailContent />
    </Suspense>
  );
}
