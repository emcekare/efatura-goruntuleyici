/**
 * XML + XSLT → HTML dönüşümü.
 *
 * Firefox'ta (ve XSLT'si hâlâ olan Chromium sürümlerinde) yerleşik `XSLTProcessor`
 * kullanılır. Chrome XSLT desteğini kaldırdığı için yoksa Chrome ekibinin WASM
 * polyfill'i (xslt-polyfill 1.0.33, BSD-3) uzantının içinden yüklenir; ağa çıkılmaz.
 */

const POLYFILL_YOLU = "vendor/xslt-polyfill/xslt-polyfill.min.js";

let polyfillSozu = null;

/**
 * XSLTProcessor'ı hazır eder.
 * @param {boolean} [polyfillZorla] test için: yerleşik destek olsa bile polyfill'i kullan
 * @returns {Promise<boolean>} dönüşüm yapılabilir mi
 */
export async function xsltHazirla(polyfillZorla = false) {
  if (typeof XSLTProcessor !== "undefined" && !polyfillZorla) return true;
  polyfillSozu ??= new Promise((coz, reddet) => {
    window.xsltUsePolyfillOnlyIfNeeded = !polyfillZorla;
    window.xsltDontAutoloadXmlDocs = true;
    window.xsltPolyfillQuiet = true;
    const betik = document.createElement("script");
    betik.src = POLYFILL_YOLU;
    betik.charset = "utf-8";
    betik.onload = () => coz();
    betik.onerror = () => reddet(new Error("XSLT polyfill yüklenemedi"));
    document.head.appendChild(betik);
  })
    .then(() => window.xsltPolyfillReady?.())
    .catch((e) => {
      polyfillSozu = null; // sonraki denemede yeniden dene
      throw e;
    });
  try {
    await polyfillSozu;
  } catch (e) {
    console.error("XSLT polyfill hatası:", e);
    return false;
  }
  return typeof XSLTProcessor !== "undefined";
}

/**
 * Ayrıştırılmış XML'e XSLT şablonunu uygular, HTML belge metnini döner.
 * @param {Document} xmlBelge
 * @param {string} xslt
 * @returns {string}
 */
export function xsltUygula(xmlBelge, xslt) {
  const xslBelge = new DOMParser().parseFromString(xslt, "application/xml");
  if (xslBelge.getElementsByTagName("parsererror").length > 0) throw new Error("şablon okunamadı");

  const islemci = new XSLTProcessor();
  islemci.importStylesheet(xslBelge);
  const sonuc = islemci.transformToDocument(xmlBelge);
  if (!sonuc?.documentElement) throw new Error("şablon boş çıktı üretti");

  const kok = sonuc.documentElement;
  // Çıktı HTML ise outerHTML; XHTML/XML ise serileştir (srcdoc yine HTML olarak okur)
  const metin = kok.outerHTML ?? new XMLSerializer().serializeToString(kok);
  return `<!DOCTYPE html>\n${metin}`;
}
