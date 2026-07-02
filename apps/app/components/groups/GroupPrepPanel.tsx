"use client";

import { useState } from "react";
import GroupChecklist from "./GroupChecklist";
import GroupMessageBoard from "./GroupMessageBoard";
import { CheckSquare, MessageSquare } from "lucide-react";

/**
 * Checklist and message board share a home instead of sitting as two
 * separate boxes competing for attention — they're both "getting ready
 * together" tools, and a tab switcher makes that relationship visible
 * while keeping either view uncluttered.
 */
export default function GroupPrepPanel({ groupId, currentUserId }: { groupId: string; currentUserId?: string }) {
  const [tab, setTab] = useState<"checklist" | "messages">("checklist");

  return (
    <div className="rounded-2xl bg-white border border-forest-950/[0.06] shadow-card overflow-hidden">
      <div className="flex border-b border-forest-950/[0.06]">
        <button
          onClick={() => setTab("checklist")}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-colors ${
            tab === "checklist" ? "text-forest-700 bg-forest-100/40" : "text-forest-950/50 hover:text-forest-950/70"
          }`}
        >
          <CheckSquare className="w-4 h-4" /> Checkliste
        </button>
        <button
          onClick={() => setTab("messages")}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-colors ${
            tab === "messages" ? "text-forest-700 bg-forest-100/40" : "text-forest-950/50 hover:text-forest-950/70"
          }`}
        >
          <MessageSquare className="w-4 h-4" /> Pinnwand
        </button>
      </div>
      <div className="p-6">
        {tab === "checklist" ? (
          <GroupChecklist groupId={groupId} bare />
        ) : (
          <GroupMessageBoard groupId={groupId} currentUserId={currentUserId} bare />
        )}
      </div>
    </div>
  );
}
