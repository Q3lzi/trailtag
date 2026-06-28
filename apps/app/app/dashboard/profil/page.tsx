"use client";

import { useEffect, useState } from "react";
import { useAuthGuard } from "@/lib/useAuth";
import { apiFetch, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import EmptyState from "@/components/EmptyState";
import EmergencyContactsManager from "@/components/EmergencyContactsManager";
import { UserCircle, Mail, Phone, Calendar, ShieldCheck, AlertCircle, Pencil, Check, X } from "lucide-react";

export default function ProfilPage() {
  const { user, loading: authLoading, logout } = useAuthGuard();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState({ phone: "", birthYear: "", bloodType: "", allergies: "", medications: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user]);

  async function load() {
    try {
      const token = getToken();
      const data = await apiFetch("/profile", {}, token ?? undefined);
      setProfile(data);
      setEditValues({
        phone: data.phone ?? "",
        birthYear: data.birthYear ? String(data.birthYear) : "",
        bloodType: data.bloodType ?? "",
        allergies: data.allergies ?? "",
        medications: data.medications ?? "",
      });
    } catch {
      // empty state
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const token = getToken();
      const updated = await apiFetch(
        "/profile",
        {
          method: "PUT",
          body: JSON.stringify({
            name: profile.name,
            phone: editValues.phone || null,
            birthYear: editValues.birthYear || null,
            bloodType: editValues.bloodType || null,
            allergies: editValues.allergies || null,
            medications: editValues.medications || null,
          }),
        },
        token ?? undefined
      );
      setProfile((prev: any) => ({ ...prev, ...updated }));
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return <div className="min-h-screen bg-snow flex items-center justify-center text-stone text-sm">Lädt…</div>;
  }

  return (
    <div className="flex min-h-screen bg-snow">
      <Sidebar onLogout={logout} userName={user?.name} />

      <main className="flex-1 px-12 py-11 max-w-2xl">
        <div className="mb-9">
          <p className="text-xs font-semibold text-forest-700 uppercase tracking-wide mb-1.5">Dein Konto</p>
          <h1 className="font-display text-3xl font-semibold text-forest-950 tracking-tight">Profil</h1>
          <p className="text-stone mt-1.5 text-[15px]">
            Diese Angaben sind im Ersthelfer-Portal sichtbar, wenn du in den Bergen Hilfe brauchst.
          </p>
        </div>

        {loading ? (
          <div className="text-stone text-sm">Lädt…</div>
        ) : profile ? (
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-3xl bg-forest-950 p-8">
              <div
                className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-[0.15] pointer-events-none"
                style={{ background: "radial-gradient(circle, #4a8f6f, transparent 70%)" }}
              />
              <div className="relative flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-forest-600 to-forest-800 text-white flex items-center justify-center font-display font-semibold text-2xl shrink-0">
                  {(profile.name ?? "?")[0]?.toUpperCase()}
                </div>
                <div>
                  <h2 className="font-display font-semibold text-xl text-white">{profile.name}</h2>
                  {profile.emailVerified === false ? (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-200 bg-amber-900/40 px-2 py-0.5 rounded-full mt-1.5">
                      <AlertCircle className="w-3 h-3" /> E-Mail nicht bestätigt
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-forest-200 bg-white/10 px-2 py-0.5 rounded-full mt-1.5">
                      <ShieldCheck className="w-3 h-3" /> Konto bestätigt
                    </span>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-alarm-50 border border-alarm-100 text-alarm text-sm rounded-xl px-4 py-3">{error}</div>
            )}

            {/* Stammdaten */}
            <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-7">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-sm text-forest-950">Persönliche Angaben</h3>
                {!editing ? (
                  <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-forest-700 font-medium hover:underline">
                    <Pencil className="w-3.5 h-3.5" /> Bearbeiten
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <button onClick={() => setEditing(false)} className="text-stone hover:text-forest-950">
                      <X className="w-4 h-4" />
                    </button>
                    <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 text-xs text-forest-700 font-semibold hover:underline disabled:opacity-50">
                      <Check className="w-3.5 h-3.5" /> {saving ? "Speichert…" : "Speichern"}
                    </button>
                  </div>
                )}
              </div>

              {!editing ? (
                <dl className="space-y-3.5 text-sm">
                  <div className="flex items-center gap-2.5 text-forest-950/75">
                    <Mail className="w-4 h-4 text-forest-950/35" strokeWidth={1.8} />
                    <span>{profile.email}</span>
                  </div>
                  {profile.phone && (
                    <div className="flex items-center gap-2.5 text-forest-950/75">
                      <Phone className="w-4 h-4 text-forest-950/35" strokeWidth={1.8} />
                      <span>{profile.phone}</span>
                    </div>
                  )}
                  {profile.birthYear && (
                    <div className="flex items-center gap-2.5 text-forest-950/75">
                      <Calendar className="w-4 h-4 text-forest-950/35" strokeWidth={1.8} />
                      <span>Jahrgang {profile.birthYear}</span>
                    </div>
                  )}
                  {!profile.phone && !profile.birthYear && (
                    <p className="text-stone text-xs">Noch keine Telefonnummer oder Jahrgang hinterlegt.</p>
                  )}
                </dl>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Telefonnummer</label>
                    <input
                      type="tel" value={editValues.phone} onChange={(e) => setEditValues((v) => ({ ...v, phone: e.target.value }))}
                      className="w-full rounded-lg border border-forest-950/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Jahrgang</label>
                    <input
                      type="number" value={editValues.birthYear} onChange={(e) => setEditValues((v) => ({ ...v, birthYear: e.target.value }))}
                      className="w-32 rounded-lg border border-forest-950/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Medizinische Angaben */}
            <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-7">
              <h3 className="font-display font-semibold text-sm text-forest-950 mb-4 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-forest-700" strokeWidth={1.8} /> Medizinische Angaben
              </h3>
              {!editing ? (
                profile.bloodType || profile.allergies || profile.medications ? (
                  <dl className="space-y-2.5 text-sm text-forest-950/70">
                    {profile.bloodType && <div>Blutgruppe: {profile.bloodType}</div>}
                    {profile.allergies && <div>Allergien: {profile.allergies}</div>}
                    {profile.medications && <div>Medikamente: {profile.medications}</div>}
                  </dl>
                ) : (
                  <p className="text-stone text-xs">
                    Keine medizinischen Angaben hinterlegt — diese können im Notfall lebenswichtig sein.
                  </p>
                )
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Blutgruppe</label>
                    <input
                      type="text" value={editValues.bloodType} onChange={(e) => setEditValues((v) => ({ ...v, bloodType: e.target.value }))}
                      placeholder="z. B. A+"
                      className="w-32 rounded-lg border border-forest-950/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Allergien</label>
                    <input
                      type="text" value={editValues.allergies} onChange={(e) => setEditValues((v) => ({ ...v, allergies: e.target.value }))}
                      className="w-full rounded-lg border border-forest-950/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-forest-950/70 mb-1.5">Medikamente</label>
                    <input
                      type="text" value={editValues.medications} onChange={(e) => setEditValues((v) => ({ ...v, medications: e.target.value }))}
                      className="w-full rounded-lg border border-forest-950/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Emergency contacts */}
            <EmergencyContactsManager
              contacts={profile.emergencyContacts ?? []}
              onChange={(next) => setProfile((prev: any) => ({ ...prev, emergencyContacts: next }))}
            />
          </div>
        ) : (
          <EmptyState icon={UserCircle} title="Profil nicht verfügbar" body="Das Profil konnte nicht geladen werden." />
        )}
      </main>
    </div>
  );
}
