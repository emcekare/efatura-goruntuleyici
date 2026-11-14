/**
 * Arka plan (Chrome'da service worker, Firefox'ta olay sayfası).
 * - İçerik betiğinden gelen UBL XML'ini saklayıp aynı sekmede görüntüleyiciyi açar.
 * - Sağ tık menüsünü kurar.
 * Ağ isteği yapılmaz.
 */

import { api, belgeKaydet, goruntuleyiciAdresi, adresAdi, sekmeyiGoruntule } from "./lib/aktarim.js";

const MENU_SEKME = "sekmeyi-goruntule";
const MENU_DOSYA = "dosya-ac";

api.runtime.onInstalled.addListener(async () => {
  try {
    await api.contextMenus.removeAll();
    api.contextMenus.create({ id: MENU_SEKME, title: api.i18n.getMessage("menuSekmeyiAc"), contexts: ["page"] });
    api.contextMenus.create({ id: MENU_DOSYA, title: api.i18n.getMessage("menuDosyaAc"), contexts: ["action"] });
  } catch (e) {
    console.error("Sağ tık menüsü kurulamadı:", e);
  }
});

api.contextMenus.onClicked.addListener((bilgi, sekme) => {
  if (bilgi.menuItemId === MENU_SEKME && sekme?.id !== undefined) {
    sekmeyiGoruntule(sekme.id).catch((e) => console.error("Sekme görüntülenemedi:", e));
  } else if (bilgi.menuItemId === MENU_DOSYA) {
    api.tabs.create({ url: goruntuleyiciAdresi() }).catch((e) => console.error("Görüntüleyici açılamadı:", e));
  }
});

api.runtime.onMessage.addListener((mesaj, gonderen, yanitla) => {
  if (mesaj?.tur !== "xml-ac" || typeof mesaj.xml !== "string" || gonderen.tab?.id === undefined) return false;
  // Yalnızca kendi içerik betiğimizden gelen mesajları kabul et
  if (gonderen.id !== api.runtime.id) return false;

  (async () => {
    const anahtar = await belgeKaydet(adresAdi(gonderen.url ?? mesaj.adres ?? ""), mesaj.xml);
    await api.tabs.update(gonderen.tab.id, { url: goruntuleyiciAdresi(anahtar) });
    yanitla({ tamam: true });
  })().catch((e) => {
    console.error("XML görüntüleyiciye aktarılamadı:", e);
    yanitla({ tamam: false });
  });
  return true; // yanıt asenkron
});
