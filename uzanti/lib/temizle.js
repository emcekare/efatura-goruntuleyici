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

/**
 * Gömülü olmayan (data:/blob: dışı) bir adres mi? http(s) adresleri ağa, göreli
 * adresler uzantının kendi dosyalarına gider; ikisi de faturada işe yaramaz.
 */
const DIS_ADRES = /^(?!\s*(data|blob):)\s*\S/i;
const CSS_DIS_URL = /url\(\s*(?!['"]?\s*(data|blob):)[^)]*\)/gi;

/**
 * Gömülü olmayan kaynakları (görsel, stil dosyası, CSS url()) baştan söker. CSP onları zaten
 * engelliyor, ama her engelleme Chrome'da uzantının hata listesine kayıt düşürüyor.
 * Görselin adresi ipucu olarak kalır.
 */
function disKaynaklariSok(belge) {
  for (const img of Array.from(belge.querySelectorAll("img[src], img[srcset], input[type=image][src]"))) {
    const src = img.getAttribute("src") ?? "";
    if (DIS_ADRES.test(src)) {
      img.removeAttribute("src");
      if (!img.title) img.title = src;
    }
    if (DIS_ADRES.test(img.getAttribute("srcset") ?? "")) img.removeAttribute("srcset");
  }
  for (const el of Array.from(belge.querySelectorAll("link[href]"))) if (DIS_ADRES.test(el.getAttribute("href"))) el.remove();
  for (const el of Array.from(belge.querySelectorAll("[background]"))) if (DIS_ADRES.test(el.getAttribute("background"))) el.removeAttribute("background");
  for (const el of Array.from(belge.querySelectorAll("[style]"))) {
    const stil = el.getAttribute("style");
    if (CSS_DIS_URL.test(stil)) el.setAttribute("style", stil.replace(CSS_DIS_URL, "none"));
    CSS_DIS_URL.lastIndex = 0;
  }
  for (const el of Array.from(belge.getElementsByTagName("style"))) {
    el.textContent = el.textContent.replace(CSS_DIS_URL, "none").replace(/@import[^;]*;/gi, "");
  }
}

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
 * Belgenin kendi şablonunu sayfada ortalar. GİB şablonlarının çoğu sabit genişlikli
 * (ör. 800 px) bir tablo çizip ortalamadığından fatura sola yaslı görünür. Gövde
 * içeriği kadar daralıp ortalanır; içerik pencereden genişse eskisi gibi tam genişlik.
 */
const ORTALAMA_STILI = "body{width:fit-content!important;margin-left:auto!important;margin-right:auto!important}";

/**
 * Sandbox'lı gösterim çerçevesi için hazırlar (betikler zaten çalışmaz).
 * @param {string} html
 * @param {{ ortala?: boolean, duzenle?: (belge: Document) => void }} [secenekler]
 *   ortala: gövdeyi ortala; duzenle: CSP eklenmeden önce belgeyi değiştir (ör. karekod)
 * @returns {string}
 */
export function gosterimIcinHazirla(html, { ortala = false, duzenle } = {}) {
  const belge = new DOMParser().parseFromString(html, "text/html");
  duzenle?.(belge);
  // Betikler sandbox'ta zaten çalışmıyor; Chrome her biri için konsola (ve uzantının
  // hata listesine) "Blocked script execution" yazmasın diye çıkarılır.
  for (const betik of Array.from(belge.getElementsByTagName("script"))) betik.remove();
  // Olay öznitelikleri (onload vb.) için de aynı kayıt düşüyor
  for (const el of Array.from(belge.getElementsByTagName("*"))) {
    for (const oz of Array.from(el.attributes)) if (oz.name.toLowerCase().startsWith("on")) el.removeAttribute(oz.name);
  }
  disKaynaklariSok(belge);
  if (ortala) {
    const stil = belge.createElement("style");
    stil.textContent = ORTALAMA_STILI;
    belge.head.append(stil);
  }
  return guvenliHaleGetir(belge);
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
