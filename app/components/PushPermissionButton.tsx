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
  const normalized = base64String.trim();
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const base64 = (normalized + padding).replace(/-/g, "+").replace(/_/g, "/");
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

  // ★ 修正① Service Worker登録
  async function ensureSW() {
    await navigator.serviceWorker.register("/sw.js");
    return navigator.serviceWorker.ready;
  }

  async function checkCurrentSubscription() {
    try {
      const registration = await ensureSW();

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
      alert("Safariで開いてください");
      return;
    }

    if (ios && !isStandaloneMode()) {
      alert("ホーム画面に追加してください");
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

      // ★ 修正② Service Worker登録
      const registration = await ensureSW();

      const VAPID_PUBLIC_KEY =
        "BFISQsrF1NiWyt3PN2ru0Xvykn2QxVwn1M1pjeYuVT3JSLtjd3uz7NSWdB1i8RqkKAQ2j7HTYAh_wa5sLkvLk24";

      const vapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

      const existingSubscription =
        await registration.pushManager.getSubscription();

      const subscription =
        existingSubscription ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
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
        console.error(error);
        alert("保存失敗");
        return;
      }

      setPermission("granted");
      setSubscriptionState("registered");
      alert("通知設定完了");
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "通知設定失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {showIosGuide && (
        <div style={{ padding: 12, background: "#fffbeb" }}>
          Safariで開いてホーム画面に追加してください
        </div>
      )}

      {!supported ? (
        <button className="sh-btn" disabled>
          未対応
        </button>
      ) : permission !== "granted" ? (
        <button className="sh-btn sh-btn--primary" onClick={subscribeCurrentDevice}>
          通知を許可
        </button>
      ) : subscriptionState === "registered" ? (
        <button className="sh-btn" disabled>
          設定済み
        </button>
      ) : (
        <button className="sh-btn sh-btn--primary" onClick={subscribeCurrentDevice}>
          この端末を登録
        </button>
      )}
    </div>
  );
}