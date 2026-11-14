/** Arayüz metinleri: `_locales/<dil>/messages.json` üzerinden. */

const api = globalThis.browser ?? globalThis.chrome;

/** Çeviri metni; bulunamazsa anahtarın kendisi. */
export function m(anahtar, ...degiskenler) {
  return api.i18n.getMessage(anahtar, degiskenler.map(String)) || anahtar;
}

/** `data-i18n` (metin) ve `data-i18n-title` (ipucu) özniteliklerini doldurur. */
export function sayfayiCevir(kok = document) {
  document.documentElement.lang = api.i18n.getUILanguage().split("-")[0] === "tr" ? "tr" : "en";
  for (const el of kok.querySelectorAll("[data-i18n]")) el.textContent = m(el.dataset.i18n);
  for (const el of kok.querySelectorAll("[data-i18n-title]")) el.title = m(el.dataset.i18nTitle);
}
