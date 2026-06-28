"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuth";
import { apiFetch, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import WizardShell from "@/components/create-tour/WizardShell";
import Step1Activity from "@/components/create-tour/Step1Activity";
import Step2TimeVehicle from "@/components/create-tour/Step2TimeVehicle";
import Step3Emergency from "@/components/create-tour/Step3Emergency";
import Step4Route from "@/components/create-tour/Step4Route";
import Step5Details from "@/components/create-tour/Step5Details";
import Step6Summary from "@/components/create-tour/Step6Summary";
import { TourFormState, defaultFormState, formStateFromTour } from "@/components/create-tour/types";
import { ArrowLeft, ArrowRight, Loader2, Play, Save, Trash2 } from "lucide-react";

export default function NewTourPage() {
  const { user, loading: authLoading, logout } = useAuthGuard();
  const router = useRouter();
  const searchParams = useSearchParams();
  // /dashboard/touren/neu?edit=<tourId> reopens a saved draft (status PLANNED)
  // for continued editing instead of starting from a blank wizard.
  const editTourId = searchParams.get("edit");

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<TourFormState>(defaultFormState());
  const [draftTourId, setDraftTourId] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [newVehiclePlate, setNewVehiclePlate] = useState("");
  const [showAddVehicle, setShowAddVehicle] = useState(false);

  useEffect(() => {
    if (!authLoading && user) loadData();
  }, [authLoading, user, editTourId]);

  async function loadData() {
    try {
      const token = getToken();
      const [vehiclesData, profileData, friendsData] = await Promise.all([
        apiFetch("/vehicles", {}, token ?? undefined).catch(() => []),
        apiFetch("/profile", {}, token ?? undefined).catch(() => ({})),
        apiFetch("/friends", {}, token ?? undefined).catch(() => ({ friends: [] })),
      ]);
      setVehicles(vehiclesData);
      setEmergencyContacts(profileData.emergencyContacts ?? []);
      setFriends(friendsData.friends ?? []);

      if (editTourId) {
        const existing = await apiFetch(`/tours/${editTourId}`, {}, token ?? undefined);
        if (existing.status !== "PLANNED") {
          setError("Diese Tour wurde bereits gestartet und kann nicht mehr bearbeitet werden.");
        } else {
          setForm(formStateFromTour(existing));
          setDraftTourId(existing.id);
        }
      }
    } catch {
      if (editTourId) setError("Entwurf konnte nicht geladen werden.");
    } finally {
      setDataLoading(false);
    }
  }

  function update(patch: Partial<TourFormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      update({ startLat: String(pos.coords.latitude), startLng: String(pos.coords.longitude) });
    });
  }

  async function handleAddVehicle() {
    if (!newVehiclePlate.trim()) return;
    try {
      const token = getToken();
      const vehicle = await apiFetch("/vehicles", { method: "POST", body: JSON.stringify({ plate: newVehiclePlate.trim() }) }, token ?? undefined);
      setVehicles((prev) => [...prev, vehicle]);
      update({ vehicleId: vehicle.id });
      setNewVehiclePlate("");
      setShowAddVehicle(false);
    } catch {}
  }

  function canProceed() {
    if (step === 0) return !!form.activity;
    return true;
  }

  function buildTourBody() {
    return {
      activity: form.activity,
      routeName: form.routeName || null,
      difficulty: form.difficulty || form.klettersteigGrade || form.mtbScale || form.pisteLevel || null,
      persons: form.companions.length + 1,
      companions: form.companions.length > 0
        ? form.companions.map((c) => ({ name: c.name.trim(), age: c.age.trim(), notes: c.notes.trim() })).filter((c) => c.name)
        : null,
      distanceKm: form.distanceKm ? parseFloat(form.distanceKm) : (form.gpxData?.distanceKm ?? null),
      elevationUp: form.elevationUp ? parseInt(form.elevationUp) : (form.gpxData?.elevationUp ?? null),
      parkingLocation: form.parkingLocation || null,
      parkingLat: form.parkingLat ? parseFloat(form.parkingLat) : null,
      parkingLng: form.parkingLng ? parseFloat(form.parkingLng) : null,
      notes: form.notes || null,
      overnightStops: form.overnightStops.length > 0 ? form.overnightStops : null,
      waypoints: form.waypoints.length > 0 ? form.waypoints : null,
      startLat: form.startLat ? parseFloat(form.startLat) : (form.gpxData?.startLat ?? null),
      startLng: form.startLng ? parseFloat(form.startLng) : (form.gpxData?.startLng ?? null),
      vehicleId: form.vehicleId ?? null,
    };
  }

  async function attachGpxIfAny(tourId: string, token: string | null) {
    if (form.gpxRawContent) {
      await apiFetch(`/gpx/attach/${tourId}`, { method: "POST", body: JSON.stringify({ gpxContent: form.gpxRawContent }) }, token ?? undefined);
    }
  }

  // Creates a new tour or updates the existing draft — used by both "save
  // draft" and "start tour" so editing a previously-saved draft never
  // accidentally creates a duplicate.
  async function persistTour(token: string | null) {
    if (draftTourId) {
      const updated = await apiFetch(`/tours/${draftTourId}`, { method: "PUT", body: JSON.stringify(buildTourBody()) }, token ?? undefined);
      await attachGpxIfAny(draftTourId, token);
      return updated;
    }
    const created = await apiFetch("/tours", { method: "POST", body: JSON.stringify(buildTourBody()) }, token ?? undefined);
    await attachGpxIfAny(created.id, token);
    return created;
  }

  async function handleSaveDraft() {
    if (!form.activity) {
      setError("Wähle zuerst eine Aktivität, um zu speichern.");
      setStep(0);
      return;
    }
    setSavingDraft(true);
    setError("");
    try {
      const token = getToken();
      await persistTour(token);
      router.push("/dashboard/touren");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Tour konnte nicht gespeichert werden");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleDeleteDraft() {
    if (!draftTourId) return;
    if (!confirm("Diesen Entwurf wirklich löschen?")) return;
    setDeleting(true);
    try {
      const token = getToken();
      await apiFetch(`/tours/${draftTourId}`, { method: "DELETE" }, token ?? undefined);
      router.push("/dashboard/touren");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Entwurf konnte nicht gelöscht werden");
      setDeleting(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const token = getToken();
      const tour = await persistTour(token);

      // Immediately start the tour — the safety timer begins now.
      await apiFetch(`/tours/${tour.id}/start`, { method: "POST", body: JSON.stringify({ eta: form.etaDateTime.toISOString() }) }, token ?? undefined);

      router.push(`/dashboard/touren/${tour.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Tour konnte nicht erstellt werden");
      setSubmitting(false);
    }
  }

  if (authLoading || dataLoading) {
    return <div className="min-h-screen bg-snow flex items-center justify-center text-stone text-sm">Lädt…</div>;
  }

  const isLastStep = step === 5;

  return (
    <div className="flex min-h-screen bg-snow">
      <Sidebar onLogout={logout} userName={user?.name} />

      <main className="flex-1 px-12 py-11">
        <div className="flex items-center justify-between max-w-2xl mx-auto mb-8">
          <button
            onClick={() => router.push("/dashboard/touren")}
            className="flex items-center gap-1.5 text-sm text-stone hover:text-forest-950 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Abbrechen
          </button>
          <div className="flex items-center gap-4">
            {draftTourId && (
              <button
                onClick={handleDeleteDraft}
                disabled={deleting}
                className="flex items-center gap-1.5 text-sm text-stone hover:text-alarm transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> {deleting ? "Löscht…" : "Entwurf löschen"}
              </button>
            )}
            <button
              onClick={handleSaveDraft}
              disabled={savingDraft}
              className="flex items-center gap-1.5 text-sm text-forest-700 font-medium hover:underline disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" /> {savingDraft ? "Speichert…" : draftTourId ? "Entwurf aktualisieren" : "Als Entwurf speichern"}
            </button>
          </div>
        </div>

        <WizardShell step={step}>
          {step === 0 && <Step1Activity form={form} update={update} />}
          {step === 1 && (
            <Step2TimeVehicle
              form={form}
              update={update}
              vehicles={vehicles}
              onAddVehicle={() => setShowAddVehicle(true)}
            />
          )}
          {step === 2 && <Step3Emergency form={form} update={update} emergencyContacts={emergencyContacts} friends={friends} />}
          {step === 3 && <Step4Route form={form} update={update} onUseMyLocation={useMyLocation} />}
          {step === 4 && <Step5Details form={form} update={update} />}
          {step === 5 && <Step6Summary form={form} vehicles={vehicles} />}

          {showAddVehicle && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-forest-950/[0.08] bg-white p-3">
              <input
                type="text"
                value={newVehiclePlate}
                onChange={(e) => setNewVehiclePlate(e.target.value)}
                placeholder="Kennzeichen, z. B. SZ 722 05"
                className="flex-1 rounded-lg border border-forest-950/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30"
                autoFocus
              />
              <button onClick={handleAddVehicle} className="rounded-lg bg-forest-700 text-white px-3.5 py-2 text-sm font-semibold hover:bg-forest-600 transition-colors">
                Speichern
              </button>
            </div>
          )}

          {error && (
            <div className="mt-5 bg-alarm-50 border border-alarm-100 text-alarm text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          <div className="flex items-center justify-between mt-9">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="flex items-center gap-1.5 text-sm font-medium text-stone hover:text-forest-950 disabled:opacity-0 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Zurück
            </button>

            {isLastStep ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 bg-forest-700 text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-forest-600 transition-colors disabled:opacity-60"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {submitting ? "Wird gestartet…" : "Tour starten"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => canProceed() && setStep((s) => Math.min(5, s + 1))}
                disabled={!canProceed()}
                className="flex items-center gap-1.5 bg-forest-950 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-forest-900 transition-colors disabled:opacity-40"
              >
                Weiter <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </WizardShell>
      </main>
    </div>
  );
}
