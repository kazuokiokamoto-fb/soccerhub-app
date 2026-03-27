"use client";

import React, { useEffect, useMemo, useState } from "react";

function isIos() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;

  // iOS Safari のホーム画面追加判定
  const iosStandalone =
    "standalone" in window.navigator &&
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  // Android系や一部ブラウザ用
  const mediaStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;

  return iosStandalone || mediaStandalone;
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

    // iPhone / iPad でホーム画面追加されていない時だけ案内表示
    if (ios && !isStandaloneMode()) {
      setShowIosGuide(true);
    } else {
      setShowIosGuide(false);
    }
  }, [ios]);

  async function requestPermission() {
    if (!supported || loading) return;

    // iOSはホーム画面追加されていないと通知許可できない
    if (ios && !isStandaloneMode()) {
      alert("iPhone / iPadで通知を受け取るには、Safariで開いてホーム画面に追加してください。");
      return;
    }

    setLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === "granted") {
        alert("通知を許可しました");
      } else if (result === "denied") {
        alert("通知が拒否されました。必要ならブラウザ設定から変更してください。");
      }
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "通知許可に失敗しました");
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