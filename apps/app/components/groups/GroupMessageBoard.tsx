"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Send, MessageSquare } from "lucide-react";

/**
 * Lightweight prep-phase coordination board — gear lists, logistics notes,
 * last-minute updates between organizer and participants before the hike
 * starts. Intentionally minimal (no threads, reactions, editing) since
 * this exists to coordinate a single hike, not as a general chat feature.
 */
export default function GroupMessageBoard({ groupId, currentUserId, bare = false }: { groupId: string; currentUserId?: string; bare?: boolean }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    load();
    // Light polling instead of wiring a new realtime event type for what's
    // a low-frequency, non-safety-critical feature — keeps this simple.
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [groupId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function load() {
    try {
      const token = getToken();
      const data = await apiFetch(`/tour-groups/${groupId}/messages`, {}, token ?? undefined);
      setMessages(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    try {
      const token = getToken();
      const message = await apiFetch(`/tour-groups/${groupId}/messages`, { method: "POST", body: JSON.stringify({ text }) }, token ?? undefined);
      setMessages((prev) => [...prev, message]);
      setText("");
    } catch {
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={bare ? "" : "rounded-2xl bg-white border border-forest-950/[0.06] shadow-card p-6"}>
      {!bare && (
        <h3 className="font-display font-semibold text-sm text-forest-950 mb-4 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-forest-700" /> Pinnwand
        </h3>
      )}

      <div className="max-h-60 overflow-y-auto mb-4 space-y-3 pr-1">
        {loading ? (
          <p className="text-sm text-stone">Lädt…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-stone">Noch keine Nachrichten — Material-Liste, Treffpunkt-Details oder letzte Infos können hier geteilt werden.</p>
        ) : (
          messages.map((m) => {
            const isMe = m.authorId === currentUserId;
            return (
              <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${isMe ? "bg-forest-700 text-white" : "bg-forest-100/60 text-forest-950"}`}>
                  {m.text}
                </div>
                <span className="text-[10px] text-stone mt-1">
                  {m.author?.name} · {new Date(m.createdAt).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Nachricht schreiben…"
          className="flex-1 rounded-xl border border-forest-950/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-700/30"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-forest-700 text-white hover:bg-forest-600 transition-colors disabled:opacity-50 shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
