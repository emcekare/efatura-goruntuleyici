/**
 * İçerik betiği: adresi .xml ile biten sekmelerde çalışır. Belge bir UBL-TR
 * e-Fatura / e-İrsaliye ise XML'i uzantıya verir; uzantı aynı sekmede görüntüleyiciyi
 * açar. Başka hiçbir sayfaya dokunmaz, ağa istek atmaz.
 */
(() => {
  const UBL_AD_ALANLARI = [
    "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
    "urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2",
    "urn:oasis:names:specification:ubl:schema:xsd:ReceiptAdvice-2",
  ];
  const api = globalThis.browser ?? globalThis.chrome;

  // Chrome'un XML ağacı görüntüleyicisi belgeyi XHTML'e çevirip asıl XML'i gizli bir
  // kapta tutuyor; Firefox'ta kök doğrudan belgenin kendisi.
  const kaynak = document instanceof XMLDocument ? document.getElementById("webkit-xml-viewer-source-xml") : null;
  const kok = kaynak?.firstElementChild ?? document.documentElement;
  if (!kok || !UBL_AD_ALANLARI.includes(kok.namespaceURI)) return;

  // Görüntüleyiciden "geri" ile dönüldüyse ham XML'i göster, tekrar yönlendirme
  const gezinme = performance.getEntriesByType("navigation")[0];
  if (gezinme && gezinme.type === "back_forward") return;

  api.storage.local
    .get({ otomatikAc: true })
    .then(({ otomatikAc }) => {
      if (!otomatikAc) return;
      return api.runtime.sendMessage({
        tur: "xml-ac",
        xml: new XMLSerializer().serializeToString(kok),
        adres: location.href,
      });
    })
    .catch((e) => console.warn("[e-Fatura Görüntüleyici] Belge aktarılamadı:", e));
})();
