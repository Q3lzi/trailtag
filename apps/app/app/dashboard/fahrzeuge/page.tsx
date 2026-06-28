"use client";

import { useEffect, useState } from "react";
import { useAuthGuard } from "@/lib/useAuth";
import { apiFetch, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import EmptyState from "@/components/EmptyState";
import LicensePlate from "@/components/LicensePlate";
import VehicleForm from "@/components/vehicles/VehicleForm";
import VehicleQrSticker from "@/components/vehicles/VehicleQrSticker";
import { Car, Plus, Pencil, Trash2, QrCode, X } from "lucide-react";

export default function VehiclesPage() {
  const { user, loading: authLoading, logout } = useAuthGuard();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState<"none" | "new" | string>("none"); // string = editing vehicle id
  const [qrFor, setQrFor] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user]);

  async function load() {
    try {
      const token = getToken();
      const data = await apiFetch("/vehicles", {}, token ?? undefined);
      setVehicles(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  function handleSaved(vehicle: any) {
    setVehicles((prev) => {
      const exists = prev.some((v) => v.id === vehicle.id);
      return exists ? prev.map((v) => (v.id === vehicle.id ? vehicle : v)) : [...prev, vehicle];
    });
    setFormMode("none");
  }

  async function handleDelete(id: string) {
    if (!confirm("Dieses Fahrzeug wirklich löschen? Der zugehörige QR-Sticker funktioniert danach nicht mehr.")) return;
    setDeletingId(id);
    setDeleteError("");
    try {
      const token = getToken();
      await apiFetch(`/vehicles/${id}`, { method: "DELETE" }, token ?? undefined);
      setVehicles((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Löschen fehlgeschlagen");
    } finally {
      setDeletingId(null);
    }
  }

  if (authLoading) {
    return <div className="min-h-screen bg-snow flex items-center justify-center text-stone text-sm">Lädt…</div>;
  }

  const editingVehicle = typeof formMode === "string" && formMode !== "none" && formMode !== "new"
    ? vehicles.find((v) => v.id === formMode)
    : undefined;

  return (
    <div className="flex min-h-screen bg-snow">
      <Sidebar onLogout={logout} userName={user?.name} />

      <main className="flex-1 px-12 py-11 max-w-4xl">
        <div className="flex items-start justify-between mb-7">
          <div>
            <p className="text-xs font-semibold text-forest-700 uppercase tracking-wide mb-1.5">
              {vehicles.length} Fahrzeug{vehicles.length !== 1 ? "e" : ""}
            </p>
            <h1 className="font-display text-3xl font-semibold text-forest-950 tracking-tight">Fahrzeuge</h1>
            <p className="text-stone mt-1.5 text-[15px]">
              Jedes Fahrzeug bekommt einen eigenen QR-Sticker für den Trailhead.
            </p>
          </div>
          {formMode === "none" && (
            <button
              onClick={() => setFormMode("new")}
              className="flex items-center gap-2 bg-forest-700 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-forest-600 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" /> Fahrzeug hinzufügen
            </button>
          )}
        </div>

        {formMode === "new" && (
          <div className="mb-6">
            <VehicleForm onSaved={handleSaved} onCancel={() => setFormMode("none")} />
          </div>
        )}
        {editingVehicle && (
          <div className="mb-6">
            <VehicleForm vehicle={editingVehicle} onSaved={handleSaved} onCancel={() => setFormMode("none")} />
          </div>
        )}

        {deleteError && (
          <div className="bg-alarm-50 border border-alarm-100 text-alarm text-sm rounded-xl px-4 py-3 mb-5">{deleteError}</div>
        )}

        {loading ? (
          <div className="text-stone text-sm">Lädt…</div>
        ) : vehicles.length === 0 && formMode === "none" ? (
          <EmptyState
            icon={Car}
            title="Noch keine Fahrzeuge"
            body="Füge ein Fahrzeug hinzu, um einen QR-Sticker für den Trailhead zu erstellen."
          />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {vehicles.map((v, i) => (
              <div
                key={v.id}
                className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-5 animate-rise"
                style={{ animationDelay: `${Math.min(i * 40, 200)}ms` }}
              >
                <div className="flex items-center justify-between mb-4">
                  <LicensePlate text={v.plate} size="md" />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setQrFor(v)}
                      className="p-2 rounded-full text-forest-950/40 hover:bg-forest-100 hover:text-forest-700 transition-colors"
                      title="QR-Sticker anzeigen"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setFormMode(v.id)}
                      className="p-2 rounded-full text-forest-950/40 hover:bg-forest-100 hover:text-forest-700 transition-colors"
                      title="Bearbeiten"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(v.id)}
                      disabled={deletingId === v.id}
                      className="p-2 rounded-full text-forest-950/40 hover:bg-alarm-50 hover:text-alarm transition-colors disabled:opacity-40"
                      title="Löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {(v.make || v.model || v.color) && (
                  <p className="text-sm text-stone">
                    {[v.make, v.model, v.color].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* QR sticker modal */}
      {qrFor && (
        <div
          className="fixed inset-0 bg-forest-950/40 backdrop-blur-sm flex items-center justify-center z-50 p-6"
          onClick={() => setQrFor(null)}
        >
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl p-7 max-w-sm w-full relative">
            <button
              onClick={() => setQrFor(null)}
              className="absolute top-4 right-4 text-stone hover:text-forest-950 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-display font-semibold text-lg text-forest-950 mb-1 text-center">QR-Sticker</h3>
            <p className="text-xs text-stone text-center mb-5">Zum Ausdrucken und auf das Fahrzeug kleben</p>
            <VehicleQrSticker qrToken={qrFor.qrToken} plate={qrFor.plate} />
          </div>
        </div>
      )}
    </div>
  );
}
