"use client";

import React, { useEffect, useState } from "react";

export default function PushPermissionButton() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator;
    setSupported(ok);

    if (ok) {
      setPermission(Notification.permission);
    }
  }, []);

  async function requestPermission() {
    if (!supported || loading) return;

    setLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === "granted") {
        alert("通知を許可しました");
      } else if (result === "denied") {
        alert("通知が拒否されました。ブラウザ設定から変更できます。");
      }
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "通知許可に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  if (!supported) return null;

  if (permission === "granted") {
    return (
      <button type="button" className="sh-btn" disabled>
        通知は許可済み
      </button>
    );
  }

  return (
    <button
      type="button"
      className="sh-btn sh-btn--primary"
      onClick={requestPermission}
      disabled={loading}
    >
      {loading ? "確認中…" : "通知を許可する"}
    </button>
  );
}