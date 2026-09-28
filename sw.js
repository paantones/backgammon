// BätsXherei — Hintergrundprogramm für Benachrichtigungen
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { titel: "BätsXherei", text: e.data ? e.data.text() : "" }; }

  // "chat:<id>" kennzeichnet Chat-Nachrichten — eigene Kennung, damit sie "Du bist dran" nicht ersetzen
  let spiel = d.spiel || null, tag = "bx";
  if (typeof spiel === "string" && spiel.startsWith("chat:")){ spiel = spiel.slice(5); tag = "chat-" + spiel; }
  else if (spiel) tag = "spiel-" + spiel;

  // Ist genau diese Partie gerade sichtbar geöffnet? Dann keine Benachrichtigung.
  const anzeigen = (async () => {
    if (spiel){
      const fenster = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const offen = fenster.some(f => f.visibilityState === "visible" && (f.url || "").includes("partie=" + spiel));
      if (offen) return;
    }
    return self.registration.showNotification(d.titel || "BätsXherei", {
    body: d.text || "",
    icon: "/icon-192.png",
    badge: "/badge-96.png",
    tag,
    renotify: true,
    data: { spiel },
    });
  })();

  let zahl = Promise.resolve();
  try {
    if (typeof d.badge === "number" && self.navigator && self.navigator.setAppBadge){
      zahl = d.badge > 0 ? self.navigator.setAppBadge(d.badge) : self.navigator.clearAppBadge();
    }
  } catch (_) {}

  e.waitUntil(Promise.all([anzeigen, Promise.resolve(zahl).catch(() => {})]));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const spiel = e.notification.data && e.notification.data.spiel;
  // Mit Partie: direkt aufs Brett. Ohne Partie (etwa Testnachricht): in den Spielen-Reiter.
  const ziel = spiel ? "/#spiel=" + spiel : "/#spielen";
  e.waitUntil((async () => {
    const fenster = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const f of fenster){
      if ("focus" in f){
        f.postMessage(spiel ? { typ: "spiel", id: spiel } : { typ: "spielen" });
        return f.focus();
      }
    }
    return self.clients.openWindow(ziel);
  })());
});
