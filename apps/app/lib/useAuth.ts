"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "./api";
import { getToken, removeToken } from "./auth";

export function useAuthGuard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    check();
  }, []);

  async function check() {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    try {
      const me = await apiFetch("/auth/me", {}, token);
      setUser(me);
    } catch {
      removeToken();
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    removeToken();
    router.replace("/login");
  }

  return { user, loading, logout };
}