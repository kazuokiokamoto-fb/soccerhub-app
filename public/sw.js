self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification?.data?.url &&
    typeof event.notification.data.url === "string"
      ? event.notification.data.url
      : "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            if ("navigate" in client) {
              client.navigate(targetUrl);
            }
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

self.addEventListener("push", (event) => {
  let data = {
    title: "サカまち",
    body: "新しい通知があります",
    url: "/",
    badgeCount: 0,
  };

  try {
    if (event.data) {
      const parsed = event.data.json();

      data = {
        title: parsed.title || "サカまち",
        body: parsed.body || "新しい通知があります",
        url: parsed.url || "/",
        badgeCount:
          typeof parsed.badgeCount === "number" ? parsed.badgeCount : 0,
      };
    }
  } catch (e) {
    console.error("push parse error:", e);
  }

  event.waitUntil(
    (async () => {
      // =========================
      // ① iOS バッジ対応
      // =========================
      try {
        if ("setAppBadge" in navigator) {
          if (data.badgeCount > 0) {
            await navigator.setAppBadge(data.badgeCount);
          } else if ("clearAppBadge" in navigator) {
            await navigator.clearAppBadge();
          }
        }
      } catch (e) {
        console.error("badge update error:", e);
      }

      // =========================
      // ② Android対応（通知で擬似バッジ）
      // =========================
      const displayBody =
        data.badgeCount > 0
          ? `${data.body}\n（未読${data.badgeCount}件）`
          : data.body;

      await self.registration.showNotification(data.title, {
        body: displayBody,
        icon: "/icon-192.png",
        badge: "/icon-192.png",

        // 👇 Androidで「上書き通知」にする
        tag: "sakamachi-notification",
        renotify: true,

        data: {
          url: data.url,
          badgeCount: data.badgeCount,
        },
      });
    })()
  );
});