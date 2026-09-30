// BätsXherei — Hintergrundprogramm für Benachrichtigungen
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Sichtbare App-Fenster fragen, was sie gerade zeigen (Antwort binnen 400 ms, sonst "nichts")
async function sichtbareAnsichten(){
  const fenster = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const antworten = [];
  for (const f of fenster){
    if (f.visibilityState !== "visible") continue;
    const antwort = await new Promise((fertig) => {
      const kanal = new MessageChannel();
      const uhr = setTimeout(() => fertig(null), 400);
      kanal.port1.onmessage = (ev) => { clearTimeout(uhr); fertig(ev.data); };
      try { f.postMessage({ typ: "welchePartie" }, [kanal.port2]); }
      catch (_) { clearTimeout(uhr); fertig(null); }
    });
    if (antwort) antworten.push(antwort);
  }
  return antworten;
}

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { titel: "BätsXherei", text: e.data ? e.data.text() : "" }; }

  // "chat:<id>" kennzeichnet Chat-Nachrichten — eigene Kennung, damit sie "Du bist dran" nicht ersetzen
  // Kennung aus dem Feld "spiel": Partie, Chat einer Partie, Chat-Unterhaltung oder Herausforderung
  let spiel = d.spiel || null, tag = "bx", ziel = { typ: "spielen" }, stillWenn = () => false;
  const k = typeof spiel === "string" ? spiel : "";
  if (k.startsWith("chat:")){
    spiel = k.slice(5); tag = "chat-" + spiel; ziel = { typ: "spiel", id: spiel };
    stillWenn = (a) => a.spiel === spiel;
  } else if (k.startsWith("nachricht:")){
    const konv = k.slice(10); spiel = null; tag = "nachricht-" + konv; ziel = { typ: "chat", konv };
    stillWenn = (a) => a.chat === konv;
  } else if (k.startsWith("turnier:")){
    spiel = null; tag = "turnier-" + k.slice(8); ziel = { typ: "turnier" };
    stillWenn = (a) => a.ansicht === "turnierView";
  } else if (k.startsWith("herausforderung:")){
    spiel = null; tag = "herausforderung-" + k.slice(16); ziel = { typ: "liga" };
    stillWenn = (a) => a.ansicht === "mainView";
  } else if (spiel){
    tag = "spiel-" + spiel; ziel = { typ: "spiel", id: spiel };
    stillWenn = (a) => a.spiel === spiel;
  }

  // Ist genau diese Partie gerade sichtbar geöffnet? Dann keine Benachrichtigung.
  const anzeigen = (async () => {
    const offen = await sichtbareAnsichten();
    if (offen.some(stillWenn)) return;               // genau das ist gerade offen: keine Benachrichtigung
    return self.registration.showNotification(d.titel || "BätsXherei", {
    body: d.text || "",
    icon: "/icon-192.png",
    badge: "/badge-96.png",
    tag,
    renotify: true,
    data: { spiel, ziel },
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
  const daten = e.notification.data || {};
  const ziel = daten.ziel || (daten.spiel ? { typ: "spiel", id: daten.spiel } : { typ: "spielen" });
  const adresse = ziel.typ === "spiel" ? "/#spiel=" + ziel.id
                : ziel.typ === "chat" ? "/#chat=" + encodeURIComponent(ziel.konv)
                : ziel.typ === "liga" ? "/#liga" : ziel.typ === "turnier" ? "/#turnier" : "/#spielen";
  e.waitUntil((async () => {
    const fenster = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const f of fenster){
      if ("focus" in f){
        f.postMessage(ziel);
        return f.focus();
      }
    }
    return self.clients.openWindow(adresse);
  })());
});
