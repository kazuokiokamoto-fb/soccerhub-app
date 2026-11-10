"use client";

import { useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import { crossTabSignOutDestination } from "@/lib/auth-session/paths";

function SelectionSignOutRedirect() {
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT") return;
      const destination = crossTabSignOutDestination(
        window.location.pathname,
        window.location.search
      );
      if (destination) window.location.assign(destination);
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}

/**
 * Mounted only in the selection build. A sign-out on the hub tab shares the
 * same auth cookie and BroadcastChannel, and this sends that tab to the hub
 * login. The hub build does not mount it.
 */
export default function SelectionSessionBoundary() {
  if (process.env.NEXT_PUBLIC_APP_ZONE !== "selection") return null;
  return <SelectionSignOutRedirect />;
}
