"use client";

import { useEffect, useRef, useState } from "react";
import { getToken } from "./auth";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "wss://trailtag-production.up.railway.app/ws";

export type RealtimeEvent =
  | { type: "connected" }
  | { type: "location_update"; friendId: string; tourId: string; lat: number; lng: number; timestamp: string }
  | { type: "tour_status_change"; friendId: string; tourId: string; status: string; activity?: string; eta?: string | null }
  | { type: "friend_request"; fromUserId: string; fromName: string; friendshipId: string }
  | { type: "friend_request_accepted"; friendshipId: string; byName: string };

/**
 * Mirrors the mobile app's useRealtimeConnection hook: opens a WebSocket to
 * the backend, authenticates via the JWT in the query string, and calls
 * onEvent for every message. Reconnects automatically with backoff.
 */
export function useRealtimeConnection(onEvent: (event: RealtimeEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  const [connected, setConnected] = useState(false);
  onEventRef.current = onEvent;

  useEffect(() => {
    let cancelled = false;

    function connect() {
      const token = getToken();
      if (!token || cancelled) return;

      const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempt.current = 0;
        setConnected(true);
      };

      ws.onmessage = (msg) => {
        try {
          const event: RealtimeEvent = JSON.parse(msg.data);
          onEventRef.current(event);
        } catch {}
      };

      ws.onclose = () => {
        setConnected(false);
        if (cancelled) return;
        const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30000);
        reconnectAttempt.current++;
        reconnectTimer.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, []);

  return { connected };
}