"use client";

import { useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import { getUnifiedBadgeCount, syncAppBadge } from "@/app/lib/badge";

// PWAがバックグラウンドからフォアグラウンドに戻った瞬間(タブ切り替え・ロック解除・
// アプリ復帰など)に、毎回バッジ件数を再計算して同期する。
// iOSでは Service Worker からの setAppBadge がバックグラウンドで即座に
// 画面へ反映されないことがあるため、その取りこぼしをここで自己修復する。
export default function BadgeResync() {
  useEffect(() => {
    let active = true;

    async function resync() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || !active) return;

        const total = await getUnifiedBadgeCount(user.id);
        if (!active) return;

        await syncAppBadge(total);
      } catch (e) {
        console.error("BadgeResync error:", e);
      }
    }

    // 初回マウント時
    void resync();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void resync();
      }
    }

    function handleFocus() {
      void resync();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("badge-updated", () => void resync());
    window.addEventListener("notifications-updated", () => void resync());

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return null;
}
