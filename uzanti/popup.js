/**
 * Açılır pencere: bu sekmedeki XML'i göster, dosya aç, otomatik açma ayarı.
 * Dosya seçimi görüntüleyici sekmesinde yapılır (Firefox'ta dosya penceresi
 * açılınca açılır pencere kapanıyor).
 */

import { api, goruntuleyiciAdresi, sekmeyiGoruntule } from "./lib/aktarim.js";
import { sayfayiCevir } from "./lib/dil.js";
import { izinKartiniKur } from "./lib/izin.js";

sayfayiCevir();
izinKartiniKur(document.getElementById("izinKarti"), document.getElementById("izinDugmesi")).catch((e) => console.error(e));

const otomatik = document.getElementById("otomatikAc");
api.storage.local
  .get({ otomatikAc: true })
  .then(({ otomatikAc }) => {
    otomatik.checked = otomatikAc;
  })
  .catch((e) => console.error("Ayar okunamadı:", e));
otomatik.addEventListener("change", () => {
  api.storage.local.set({ otomatikAc: otomatik.checked }).catch((e) => console.error("Ayar kaydedilemedi:", e));
});

document.getElementById("sekmeDugmesi").addEventListener("click", async () => {
  try {
    const [sekme] = await api.tabs.query({ active: true, currentWindow: true });
    if (sekme?.id !== undefined) await sekmeyiGoruntule(sekme.id);
  } catch (e) {
    console.error("Sekme görüntülenemedi:", e);
  }
  window.close();
});

document.getElementById("dosyaDugmesi").addEventListener("click", async () => {
  try {
    await api.tabs.create({ url: goruntuleyiciAdresi() });
  } catch (e) {
    console.error("Görüntüleyici açılamadı:", e);
  }
  window.close();
});
