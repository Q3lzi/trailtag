"use client";

import { Phone, GripVertical, AlertTriangle } from "lucide-react";

type Contact = { id: string; name: string; phone: string; relation: string | null; isPrimary?: boolean };

/**
 * Lets someone choose which of their (potentially many) saved emergency
 * contacts actually apply to THIS tour, and in what order — having 10
 * contacts on file doesn't mean all 10 should be called, and the account
 * default primary contact might simply not have time for this particular
 * hike. Selection order becomes the escalation order: first pick is
 * contacted first, second only if the first can't be reached.
 */
export default function TourEmergencyContactPicker({
  allContacts,
  selectedIds,
  onChange,
}: {
  allContacts: Contact[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      if (selectedIds.length >= 3) return; // max 3
      onChange([...selectedIds, id]);
    }
  }

  function move(id: string, dir: -1 | 1) {
    const idx = selectedIds.indexOf(id);
    const next = [...selectedIds];
    const swapWith = idx + dir;
    if (swapWith < 0 || swapWith >= next.length) return;
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    onChange(next);
  }

  if (allContacts.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-amber-50 text-amber-800 px-3.5 py-2.5 text-sm">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        Noch keine Notfallkontakte hinterlegt — <a href="/dashboard/profil" className="underline font-medium">jetzt im Profil ergänzen</a>.
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-stone mb-2.5">
        Wähle bis zu 3 Kontakte für diese Tour — die Reihenfolge bestimmt, wer zuerst kontaktiert wird, falls die Rückkehrzeit überschritten ist.
      </p>

      {/* Selected, in escalation order, reorderable */}
      {selectedIds.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {selectedIds.map((id, i) => {
            const c = allContacts.find((c) => c.id === id);
            if (!c) return null;
            return (
              <div key={id} className="flex items-center gap-2.5 rounded-xl bg-forest-100/60 px-3 py-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-forest-700 text-white text-[10px] font-bold shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-forest-950 truncate">{c.name}</p>
                  <p className="text-xs text-stone">{c.relation}</p>
                </div>
                <div className="flex flex-col shrink-0">
                  <button
                    type="button" onClick={() => move(id, -1)} disabled={i === 0}
                    className="text-forest-950/40 hover:text-forest-700 disabled:opacity-20 disabled:cursor-not-allowed leading-none text-xs px-1"
                  >▲</button>
                  <button
                    type="button" onClick={() => move(id, 1)} disabled={i === selectedIds.length - 1}
                    className="text-forest-950/40 hover:text-forest-700 disabled:opacity-20 disabled:cursor-not-allowed leading-none text-xs px-1"
                  >▼</button>
                </div>
                <button
                  type="button" onClick={() => toggle(id)}
                  className="text-stone hover:text-alarm transition-colors shrink-0 text-xs font-medium"
                >Entfernen</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Remaining, unselected contacts to pick from */}
      {allContacts.filter((c) => !selectedIds.includes(c.id)).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allContacts.filter((c) => !selectedIds.includes(c.id)).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              disabled={selectedIds.length >= 3}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border border-forest-950/15 text-forest-950/70 hover:border-forest-700/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Phone className="w-3 h-3" /> {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
