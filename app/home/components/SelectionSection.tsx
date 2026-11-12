"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import ZoneLink from "@/app/components/ZoneLink";
import { IconFlag } from "@/app/components/ui/Icons";

export function SelectionSection() {
  const { user } = useAuth();
  const meId = user?.id ?? "";
  const [unreadSelectionCount, setUnreadSelectionCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadUnreadSelectionCount() {
      if (!meId) {
        if (active) setUnreadSelectionCount(0);
        return;
      }

      try {
        const { count, error } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", meId)
          .eq("type", "selection_event")
          .eq("is_read", false);

        if (error) {
          console.error("SelectionSection unread count error:", error);
          if (active) setUnreadSelectionCount(0);
          return;
        }

        if (active) setUnreadSelectionCount(count ?? 0);
      } catch (error) {
        console.error("SelectionSection unread count catch:", error);
        if (active) setUnreadSelectionCount(0);
      }
    }

    void loadUnreadSelectionCount();

    function handleBadgeUpdated() {
      void loadUnreadSelectionCount();
    }

    window.addEventListener("badge-updated", handleBadgeUpdated);
    window.addEventListener("notifications-updated", handleBadgeUpdated);

    return () => {
      active = false;
      window.removeEventListener("badge-updated", handleBadgeUpdated);
      window.removeEventListener("notifications-updated", handleBadgeUpdated);
    };
  }, [meId]);

  return (
    <ZoneLink href="/selection" className="home-card">
      <span className="home-card-icon" aria-hidden="true"><IconFlag /></span>
      <div className="home-card-top">
        <h2 className="home-card-title">セレクション情報</h2>
        {unreadSelectionCount > 0 ? (
          <span className="home-unread">
            {unreadSelectionCount}
            <span className="home-sr">件の未読</span>
          </span>
        ) : null}
      </div>
      <span className="home-card-cta">見る</span>
    </ZoneLink>
  );
}
