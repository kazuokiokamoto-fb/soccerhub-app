self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification &&
    event.notification.data &&
    typeof event.notification.data.url === "string"
      ? event.notification.data.url
      : "/";

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clients) {
        try {
          const clientUrl = new URL(client.url);
          const target = new URL(targetUrl, self.location.origin);

          if (clientUrl.origin === target.origin) {
            if ("navigate" in client) {
              await client.navigate(target.href);
            }
            if ("focus" in client) {
              await client.focus();
            }
            return;
          }
        } catch (e) {
          console.error("notificationclick client handling error:", e);
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});

self.addEventListener("push", (event) => {
  let data = {
    title: "サカまっち",
    body: "新しい通知があります",
    url: "/",
    badgeCount: 0,
  };

  try {
    if (event.data) {
      const parsed = event.data.json();

      data = {
        title:
          typeof parsed?.title === "string" && parsed.title.trim()
            ? parsed.title
            : "サカまっち",
        body:
          typeof parsed?.body === "string" && parsed.body.trim()
            ? parsed.body
            : "新しい通知があります",
        url:
          typeof parsed?.url === "string" && parsed.url.trim()
            ? parsed.url
            : "/",
        badgeCount:
          typeof parsed?.badgeCount === "number" &&
          Number.isFinite(parsed.badgeCount) &&
          parsed.badgeCount > 0
            ? parsed.badgeCount
            : 0,
      };
    }
  } catch (e) {
    console.error("push parse error:", e);
  }

  event.waitUntil(
    (async () => {
      try {
        if ("setAppBadge" in self) {
          if (data.badgeCount > 0) {
            await self.setAppBadge(data.badgeCount);
          } else if ("clearAppBadge" in self) {
            await self.clearAppBadge();
          }
        }
      } catch (e) {
        console.error("badge update error:", e);
      }

      const displayBody =
        data.badgeCount > 0
          ? `${data.body}\n（未読${data.badgeCount}件）`
          : data.body;

      await self.registration.showNotification(data.title, {
        body: displayBody,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
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