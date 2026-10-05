"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ReaderMembershipTier } from "@/lib/reader-membership";

const supabase = createClient();
const ReaderMembershipContext = createContext<{ tier: ReaderMembershipTier; ready: boolean } | null>(null);

function shouldSilenceMembershipError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return true;
  const code = error.code?.toLowerCase() ?? "";
  const message = (error.message ?? "").toLowerCase();
  return [
    "pgrst301",
    "42501",
    "row level security",
    "permission denied",
    "anonymous",
  ].some((needle) => code.includes(needle) || message.includes(needle));
}

export function useReaderMembership() {
  const context = useContext(ReaderMembershipContext);
  if (!context) throw new Error("useReaderMembership must be used inside ReaderMembershipRuntime.");
  return context;
}

export default function ReaderMembershipRuntime({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState<ReaderMembershipTier>("free");
  const [ready, setReady] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    let active = true;
    const loadMembership = async (userId: string | undefined) => {
      const currentRequest = ++requestId.current;
      setReady(false);
      if (!userId) {
        if (active && currentRequest === requestId.current) {
          setTier("free");
          setReady(true);
        }
        return;
      }
      const { data, error } = await supabase
        .from("reader_memberships")
        .select("tier")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        if (!shouldSilenceMembershipError(error)) {
          console.error("Unable to load reader membership:", error);
        }
        if (active && currentRequest === requestId.current) setTier("free");
      } else if (active) {
        const loadedTier = data?.tier;
        if (currentRequest === requestId.current) {
          setTier(loadedTier === "premium" || loadedTier === "vip" ? loadedTier : "free");
        }
      }
      if (active && currentRequest === requestId.current) setReady(true);
    };

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Unable to check the reader session for membership:", error);
        void loadMembership(undefined);
        return;
      }
      void loadMembership(data.session?.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => void loadMembership(session?.user.id), 0);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const context = useMemo(() => ({ tier, ready }), [ready, tier]);
  return <ReaderMembershipContext.Provider value={context}>{children}</ReaderMembershipContext.Provider>;
}
