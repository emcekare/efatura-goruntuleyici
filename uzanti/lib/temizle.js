/**
 * Şablon çıktısını (faturayı gönderen tarafın yazdığı HTML) göstermeye ve
 * yazdırmaya hazırlar.
 *
 * Gösterim `sandbox=""` iframe'de yapılır; orada betik zaten çalışmaz. Ama sandbox
 * ağ isteklerini durdurmaz (dış görsel, stil, meta refresh), uzantı sayfasının
 * CSP'si de srcdoc çerçevesine her tarayıcıda geçmiyor. Bu yüzden her çıktının
 * başına kısıtlayıcı bir CSP eklenir: dış kaynak yüklenemez, yalnızca satır içi
 * stil ve data: görseller (logo, imza, karekod) çalışır.
 *
 * Yazdırma parent'tan erişilebilen (allow-same-origin) bir çerçeve gerektirdiği
 * için çıktı ayrıca betiklerden, olay özniteliklerinden ve `javascript:`
 * bağlantılarından temizlenir.
 */

/** Şablon çıktısına uygulanan içerik güvenliği politikası. */
export const CIKTI_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; form-action 'none'; base-uri 'none'";

const YAZDIRMADA_KALDIRILACAK = [
  "script", "noscript", "iframe", "frame", "frameset", "object", "embed", "applet",
  "base", "link", "form", "portal", "template",
];

const URL_OZNITELIKLERI = ["href", "src", "action", "formaction", "xlink:href", "data", "background", "poster", "srcset"];

/** Değer tehlikeli bir URL mi (javascript:, vbscript:, data:text/html)? */
function tehlikeliUrlMi(deger) {
  // Kontrol karakterleri ve boşluklar atlatma için kullanılabiliyor
  const sade = deger.replace(/[\u0000- \u007f-\u009f]/g, "").toLowerCase();
  return sade.startsWith("javascript:") || sade.startsWith("vbscript:") || sade.startsWith("data:text/html");
}

/**
 * Ortak adımlar: yönlendirme yapan meta etiketlerini ve <base>'i atar, dış
 * bağlantıları tıklanamaz yapar (adres ipucu olarak kalır), başa CSP ekler.
 */
function guvenliHaleGetir(belge) {
  for (const el of Array.from(belge.querySelectorAll("meta[http-equiv], base"))) el.remove();

  for (const a of Array.from(belge.querySelectorAll("a[href], area[href]"))) {
    const href = a.getAttribute("href") ?? "";
    if (href.startsWith("#")) continue;
    if (!tehlikeliUrlMi(href)) a.setAttribute("title", a.getAttribute("title") || href);
    a.removeAttribute("href");
  }

  const meta = belge.createElement("meta");
  meta.setAttribute("http-equiv", "Content-Security-Policy");
  meta.setAttribute("content", CIKTI_CSP);
  belge.head.prepend(meta);
  return `<!DOCTYPE html>\n${belge.documentElement.outerHTML}`;
}

/**
 * Sandbox'lı gösterim çerçevesi için hazırlar (betikler zaten çalışmaz).
 * @param {string} html
 * @returns {string}
 */
export function gosterimIcinHazirla(html) {
  return guvenliHaleGetir(new DOMParser().parseFromString(html, "text/html"));
}

/**
 * Yazdırma çerçevesi için temizler: betikler, gömülü çerçeveler, olay öznitelikleri
 * ve tehlikeli URL'ler atılır.
 * @param {string} html
 * @returns {string}
 */
export function yazdirmaIcinTemizle(html) {
  const belge = new DOMParser().parseFromString(html, "text/html");

  for (const ad of YAZDIRMADA_KALDIRILACAK) {
    for (const el of Array.from(belge.getElementsByTagName(ad))) el.remove();
  }
  // SVG içindeki animasyonla öznitelik değiştirme
  for (const el of Array.from(belge.querySelectorAll("svg set, svg animate"))) el.remove();

  for (const el of Array.from(belge.getElementsByTagName("*"))) {
    for (const oz of Array.from(el.attributes)) {
      const ad = oz.name.toLowerCase();
      if (ad.startsWith("on") || (URL_OZNITELIKLERI.includes(ad) && tehlikeliUrlMi(oz.value))) {
        el.removeAttribute(oz.name);
      }
    }
  }
  return guvenliHaleGetir(belge);
}
