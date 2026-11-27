"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getSession, onSessionChange } from "@/lib/host/api";
import { Skeleton } from "./ui";

const AuthContext = createContext(null);
export const useHostAuth = () => useContext(AuthContext);

/** status: "loading" while we check the saved session, then "anon" or "ready". */
export function HostAuthProvider({ children }) {
  const [state, setState] = useState({ status: "loading", user: null });

  const refreshUser = useCallback(async () => {
    if (!getSession()) return setState({ status: "anon", user: null });
    try {
      setState({ status: "ready", user: await api.me() });
    } catch (err) {
      // Offline should not sign people out; only a rejected session does.
      setState(err.status === 0 ? (s) => ({ ...s, status: "ready" }) : { status: "anon", user: null });
    }
  }, []);

  useEffect(() => {
    // Deferred so the first state update does not happen synchronously inside the effect.
    const t = setTimeout(refreshUser, 0);
    const off = onSessionChange((s) => !s && setState({ status: "anon", user: null }));
    return () => {
      clearTimeout(t);
      off();
    };
  }, [refreshUser]);

  const signOut = useCallback(() => api.logout(), []);

  return <AuthContext value={{ ...state, refreshUser, signOut }}>{children}</AuthContext>;
}

/**
 * Wrap a screen that needs an organizer. Sends visitors to sign in or onboarding as needed.
 * Pass `allowNoOrganizer` for the onboarding screen itself.
 */
export function RequireHost({ children, allowNoOrganizer = false }) {
  const { status, user } = useHostAuth();
  const router = useRouter();
  const target = status === "anon" ? "/host" : status === "ready" && !allowNoOrganizer && !user?.organizer_id ? "/host/onboarding" : null;

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (status !== "ready" || target) return <Skeleton lines={4} label="Loading your account" />;
  return children;
}
