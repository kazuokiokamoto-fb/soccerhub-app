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

function isSafariOnIos() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const webkit = /WebKit/.test(ua);
  const notCriOS = !/CriOS/.test(ua);
  const notFxiOS = !/FxiOS/.test(ua);
  const notEdgiOS = !/EdgiOS/.test(ua);
  return iOS && webkit && notCriOS && notFxiOS && notEdgiOS;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

type SubscriptionState = "unknown" | "registered" | "not_registered";

export default function PushPermissionButton() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [subscriptionState, setSubscriptionState] =
    useState<SubscriptionState>("unknown");

  const ios = useMemo(() => isIos(), []);
  const safariOnIos = useMemo(() => isSafariOnIos(), []);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;

    setSupported(ok);

    if (ok) {
      setPermission(Notification.permission);
    }

    if (ios) {
      if (!safariOnIos || !isStandaloneMode()) {
        setShowIosGuide(true);
      } else {
        setShowIosGuide(false);
      }
    } else {
      setShowIosGuide(false);
    }
  }, [ios, safariOnIos]);

  useEffect(() => {
    if (!supported) return;

    if (permission !== "granted") {
      setSubscriptionState("not_registered");
      return;
    }

    void checkCurrentSubscription();
  }, [supported, permission]);

  async function checkCurrentSubscription() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription?.endpoint) {
        setSubscriptionState("not_registered");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSubscriptionState("not_registered");
        return;
      }

      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("endpoint", subscription.endpoint)
        .maybeSingle();

      if (error) {
        console.error("push_subscriptions check error:", error);
        setSubscriptionState("not_registered");
        return;
      }

      setSubscriptionState(data ? "registered" : "not_registered");
    } catch (e) {
      console.error("checkCurrentSubscription error:", e);
      setSubscriptionState("not_registered");
    }
  }

  async function subscribeCurrentDevice() {
    if (loading) return;

    if (ios && !safariOnIos) {
      alert(
        "iPhone / iPadでは、Safariで開いてホーム画面に追加したアプリから通知設定してください。"
      );
      return;
    }

    if (ios && !isStandaloneMode()) {
      alert("Safariで開いてホーム画面に追加してください");
      return;
    }

    if (!supported) {
      alert("この環境では通知に対応していません。");
      return;
    }

    setLoading(true);

    try {
      let currentPermission = Notification.permission;

      if (currentPermission !== "granted") {
        currentPermission = await Notification.requestPermission();
        setPermission(currentPermission);
      }

      if (currentPermission !== "granted") {
        alert("通知が許可されていません");
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      // 次で本物に差し替える
      const VAPID_PUBLIC_KEY = "BXXXXXXXXXXXXXXX仮XXXXXXXXXXXXXXX";

      const existingSubscription = await registration.pushManager.getSubscription();

      const subscription =
        existingSubscription ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }));

      const sub = subscription.toJSON();

      if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
        alert("購読情報の取得に失敗しました");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("ログインが必要です");
        return;
      }

      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
          user_agent: navigator.userAgent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" }
      );

      if (error) {
        console.error("push_subscriptions upsert error:", error);
        alert(`保存失敗: ${error.message}`);
        return;
      }

      setPermission("granted");
      setSubscriptionState("registered");
      alert("この端末の通知設定が完了しました");
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "通知設定に失敗しました");
    } finally {
      setLoading(false);
    }
  }

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

      {!supported ? (
        <button type="button" className="sh-btn" disabled>
          この環境では通知未対応
        </button>
      ) : permission !== "granted" ? (
        <button
          type="button"
          className="sh-btn sh-btn--primary"
          onClick={subscribeCurrentDevice}
          disabled={loading}
        >
          {loading ? "確認中…" : "通知を許可する"}
        </button>
      ) : subscriptionState === "registered" ? (
        <button type="button" className="sh-btn" disabled>
          この端末は通知設定済み
        </button>
      ) : (
        <button
          type="button"
          className="sh-btn sh-btn--primary"
          onClick={subscribeCurrentDevice}
          disabled={loading}
        >
          {loading ? "登録中…" : "この端末を通知対象に登録する"}
        </button>
      )}
    </div>
  );
}