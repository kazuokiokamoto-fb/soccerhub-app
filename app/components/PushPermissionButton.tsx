"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";

function isIos() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;

  const iosStandalone =
    "standalone" in window.navigator &&
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  const mediaStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;

  return iosStandalone || mediaStandalone;
}

// 🔥 Base64 → Uint8Array変換（必須）
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export default function PushPermissionButton() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  const ios = useMemo(() => isIos(), []);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator;

    setSupported(ok);

    if (ok) {
      setPermission(Notification.permission);
    }

    if (ios && !isStandaloneMode()) {
      setShowIosGuide(true);
    } else {
      setShowIosGuide(false);
    }
  }, [ios]);

  async function requestPermission() {
    if (!supported || loading) return;

    if (ios && !isStandaloneMode()) {
      alert("Safariで開いてホーム画面に追加してください");
      return;
    }

    setLoading(true);

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== "granted") {
        alert("通知が許可されていません");
        return;
      }

      // ✅ Service Worker取得
      const registration = await navigator.serviceWorker.ready;

      // 🔥 VAPIDキー（次で正式に作る。今は仮でOK）
      const VAPID_PUBLIC_KEY = "BXXXXXXXXXXXXXXX仮XXXXXXXXXXXXXXX";

      // ✅ Push購読
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const sub = subscription.toJSON();

      // ✅ ログインユーザー取得
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("ログインが必要です");
        return;
      }

      // ✅ Supabase保存
      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys?.p256dh,
        auth: sub.keys?.auth,
        user_agent: navigator.userAgent,
      });

      if (error) {
        console.error(error);
        alert("保存失敗");
        return;
      }

      alert("通知設定が完了しました🔥");
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "エラー発生");
    } finally {
      setLoading(false);
    }
  }

  if (!supported) return null;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {showIosGuide ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid #fde68a",
            background: "#fffbeb",
            color: "#92400e",
            lineHeight: 1.7,
            fontSize: 14,
          }}
        >
          iPhone / iPadで通知を受け取るには、
          <br />
          <b>Safariで開いて、ホーム画面に追加</b>
          してからご利用ください。
        </div>
      ) : null}

      {permission === "granted" ? (
        <button type="button" className="sh-btn" disabled>
          通知は許可済み
        </button>
      ) : (
        <button
          type="button"
          className="sh-btn sh-btn--primary"
          onClick={requestPermission}
          disabled={loading}
        >
          {loading ? "確認中…" : "通知を許可する"}
        </button>
      )}
    </div>
  );
}