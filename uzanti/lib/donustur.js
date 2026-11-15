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
 * Polyfill'in XSLT motoru (libxslt) uyarılarını (ör. "xsl:version: only 1.1 features
 * are supported") yüklenirken bağladığı console.error/log ile basıyor. Chrome bunları
 * uzantının hata listesine yığın izlemesiyle yazıyor; çok fatura açınca liste şişip
 * uzantılar sayfası donuyor. Polyfill yüklenmeden önce konsol sarmalanır, dönüşüm
 * sırasındaki motor çıktısı toplanıp tek bir debug satırı olarak kaydedilir.
 */
let motorSusturuluyor = false;
const motorIletileri = [];

function konsoluSarmala() {
  for (const ad of ["error", "log"]) {
    const asil = console[ad];
    console[ad] = function (...degerler) {
      if (motorSusturuluyor) motorIletileri.push(degerler.map(String).join(" "));
      else asil.apply(console, degerler);
    };
  }
}

/**
 * XSLTProcessor'ı hazır eder.
 * @param {boolean} [polyfillZorla] yerleşik destek olsa bile polyfill'i kullan (Chrome'da varsayılan)
 * @returns {Promise<boolean>} dönüşüm yapılabilir mi
 */
export async function xsltHazirla(polyfillZorla = false) {
  if (typeof XSLTProcessor !== "undefined" && !polyfillZorla) return true;
  const yerel = window.XSLTProcessor;
  polyfillSozu ??= new Promise((coz, reddet) => {
    // Polyfill yerleşik desteği `new XSLTProcessor()` ile yokluyor; Chrome bunu da
    // "kullanımdan kaldırıldı" uyarısı olarak kaydediyor. Yerleşiği önce gizle.
    if (polyfillZorla && yerel) delete window.XSLTProcessor;
    konsoluSarmala();
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
      if (yerel && typeof window.XSLTProcessor === "undefined") window.XSLTProcessor = yerel;
      throw e;
    });
  try {
    await polyfillSozu;
  } catch (e) {
    // Polyfill yüklenemezse yerleşik XSLT varsa onunla devam et
    console.error("XSLT polyfill hatası:", e);
    return typeof XSLTProcessor !== "undefined";
  }
  return typeof XSLTProcessor !== "undefined";
}

const XSL = "http://www.w3.org/1999/XSL/Transform";

/**
 * Şablondaki olay özniteliklerini (onload, onclick…) dönüşümden önce söker. Çıktıda
 * hiç çalışmıyorlar; ama Chrome (157+) çıktı yalnızca bellekte ayrıştırılırken bile
 * her biri için uzantının hata listesine CSP uyarısı yazıyor.
 */
function olayOznitelikleriniSok(xslBelge) {
  for (const el of Array.from(xslBelge.getElementsByTagName("*"))) {
    if (el.namespaceURI === XSL) {
      // <xsl:attribute name="onclick">
      if (el.localName === "attribute" && /^\s*on/i.test(el.getAttribute("name") ?? "")) el.remove();
      continue;
    }
    for (const oz of Array.from(el.attributes)) {
      if (!oz.namespaceURI && oz.localName.toLowerCase().startsWith("on")) el.removeAttributeNode(oz);
    }
  }
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
  olayOznitelikleriniSok(xslBelge);

  let sonuc;
  motorSusturuluyor = true;
  motorIletileri.length = 0;
  try {
    const islemci = new XSLTProcessor();
    islemci.importStylesheet(xslBelge);
    sonuc = islemci.transformToDocument(xmlBelge);
  } catch (e) {
    // Motorun asıl gerekçesini öne çıkar (polyfill yalnızca "XSLT Transformation failed" diyor)
    const neden = motorIletileri.find((i) => /error/i.test(i) && !/compilation error|only 1\.1 features/i.test(i));
    if (/Unregistered function/i.test(neden ?? "")) {
      throw new Error(`şablon XSLT 2.0'a özgü işlevler kullanıyor (${neden.replace(/.*Unregistered function:\s*/i, "").trim()}); tarayıcılar yalnızca XSLT 1.0 çalıştırabiliyor`);
    }
    throw neden ? new Error(neden.trim()) : e;
  } finally {
    motorSusturuluyor = false;
    if (motorIletileri.length) console.debug(`XSLT motoru ${motorIletileri.length} ileti verdi:`, motorIletileri.slice(0, 10));
  }
  if (!sonuc?.documentElement) throw new Error("şablon boş çıktı üretti");

  const kok = sonuc.documentElement;
  // Çıktı HTML ise outerHTML; XHTML/XML ise serileştir (srcdoc yine HTML olarak okur)
  const metin = kok.outerHTML ?? new XMLSerializer().serializeToString(kok);
  return `<!DOCTYPE html>\n${metin}`;
}
