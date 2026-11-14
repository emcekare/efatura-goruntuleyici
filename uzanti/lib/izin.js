/**
 * Firefox'ta site erişim izni ve yerel dosya notu.
 *
 * Firefox, Manifest V3 uzantılarının sitelere erişimini
 * isteğe bağlı tutar: kullanıcı izin vermeden .xml sekmelerindeki içerik betiği
 * hiç çalışmaz. Chrome bu izni kurulumda verir. Bu yüzden izin kartı yalnızca
 * Firefox'ta, izin eksikse gösterilir.
 */

import { api } from "./aktarim.js";

/** İçerik betiğinin çalışması için gereken kökenler (Firefox paketinde host_permissions). */
// file:// yok: Firefox yerel dosyalara içerik betiği hiç enjekte etmiyor (izin verilse de).
export const XML_KOKENLERI = ["http://*/*", "https://*/*"];

/** Firefox mu? (`runtime.getBrowserInfo` yalnızca Firefox'ta var.) */
export function firefoxMu() {
  return typeof api.runtime.getBrowserInfo === "function";
}

/** İzin kartı gösterilmeli mi? */
export async function izinGerekiyorMu() {
  if (!firefoxMu()) return false;
  try {
    return !(await api.permissions.contains({ origins: XML_KOKENLERI }));
  } catch (e) {
    console.warn("İzin durumu okunamadı:", e);
    return false;
  }
}

/** Kullanıcı tıklamasıyla çağrılmalı. @returns {Promise<boolean>} izin verildi mi */
export async function izinIste() {
  try {
    return await api.permissions.request({ origins: XML_KOKENLERI });
  } catch (e) {
    console.error("İzin istenemedi:", e);
    return false;
  }
}

/** Firefox'ta yerel dosya notunu gösterir (Firefox file:// sayfalarda uzantıyı çalıştırmıyor). */
export function firefoxNotunuGoster(not) {
  not.hidden = !firefoxMu();
}

/**
 * Sayfadaki izin kartını (gizli bir öğe) gerektiğinde gösterir ve düğmesini bağlar.
 * @param {HTMLElement} kart
 * @param {HTMLButtonElement} dugme
 */
export async function izinKartiniKur(kart, dugme) {
  kart.hidden = !(await izinGerekiyorMu());
  dugme.addEventListener("click", async () => {
    if (await izinIste()) kart.hidden = true;
  });
}
