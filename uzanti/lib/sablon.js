/**
 * e-Fatura / e-Arşiv / e-İrsaliye (UBL-TR) XML'inden görünüm şablonunu (XSLT) çıkarır.
 *
 * GİB UBL-TR belgelerinde görünüm şablonu `cac:AdditionalDocumentReference` →
 * `cac:Attachment` → `cbc:EmbeddedDocumentBinaryObject` içinde base64 olarak gelir
 * (dosya adı genelde `*.xslt`). Bu modül saf fonksiyonlardan oluşur: ağ yok, DOM'a
 * dokunmaz. Tarayıcıda yerleşik `DOMParser`, testlerde `@xmldom/xmldom` kullanılır.
 */

export const CAC = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
export const CBC = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";

/** Görüntüleyicinin tanıdığı UBL belge türleri (kök elemanın ad alanına göre). */
export const UBL_TURLERI = {
  "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2": "Invoice",
  "urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2": "DespatchAdvice",
  "urn:oasis:names:specification:ubl:schema:xsd:ReceiptAdvice-2": "ReceiptAdvice",
};

/** Kök elemanın ad alanından UBL belge türünü döner (`Invoice` vb.); tanınmıyorsa null. */
export function ublTuru(kokAdAlani, kokAdi) {
  const tur = UBL_TURLERI[kokAdAlani ?? ""];
  return tur && tur === kokAdi ? tur : null;
}

/** Ek bir XSLT şablonu mu? Dosya adı ya da MIME'dan karar verir. */
function xsltAdliMi(dosyaAdi, mime) {
  return /\.xslt?$/i.test(dosyaAdi) || /xsl/i.test(mime);
}

/** PDF eki mi? (Bazı entegratörler faturanın PDF'ini de ekliyor; şablon değildir.) */
function pdfMi(dosyaAdi, mime, baytlar) {
  if (/\.pdf$/i.test(dosyaAdi) || /pdf/i.test(mime)) return true;
  // "%PDF" imzası
  return baytlar.length >= 4 && baytlar[0] === 0x25 && baytlar[1] === 0x50 && baytlar[2] === 0x44 && baytlar[3] === 0x46;
}

/** base64 → bayt dizisi. Boşluk/satır sonları atılır; geçersizse hata fırlatır. */
export function base64Bayt(b64) {
  const temiz = b64.replace(/\s+/g, "");
  const ikili = atob(temiz);
  const baytlar = new Uint8Array(ikili.length);
  for (let i = 0; i < ikili.length; i++) baytlar[i] = ikili.charCodeAt(i);
  return baytlar;
}

/**
 * Bayt dizisini metne çevirir. BOM'a, yoksa XML bildirimindeki `encoding`'e bakar
 * (ör. windows-1254, ISO-8859-9); hiçbiri yoksa UTF-8 varsayar.
 */
export function baytMetin(baytlar) {
  if (baytlar[0] === 0xef && baytlar[1] === 0xbb && baytlar[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(baytlar.subarray(3));
  }
  if (baytlar[0] === 0xff && baytlar[1] === 0xfe) return new TextDecoder("utf-16le").decode(baytlar.subarray(2));
  if (baytlar[0] === 0xfe && baytlar[1] === 0xff) return new TextDecoder("utf-16be").decode(baytlar.subarray(2));

  // XML bildirimi ASCII uyumlu; ilk 200 baytı latin1 okuyup encoding'i ara
  const bas = new TextDecoder("latin1").decode(baytlar.subarray(0, 200));
  const eslesme = /^<\?xml[^>]*\bencoding\s*=\s*["']([A-Za-z0-9._-]+)["']/.exec(bas);
  let kodlama = eslesme ? eslesme[1].toLowerCase() : "utf-8";
  try {
    return new TextDecoder(kodlama).decode(baytlar);
  } catch {
    // Tarayıcının tanımadığı kodlama adı: UTF-8 ile dene
    console.warn(`Bilinmeyen karakter kodlaması "${kodlama}", UTF-8 varsayıldı`);
    return new TextDecoder("utf-8").decode(baytlar);
  }
}

/** Metin bir XSLT şablonu mu? */
function xsltIcerikMi(metin) {
  return /<(?:[\w.-]+:)?(?:stylesheet|transform)\b[^>]*http:\/\/www\.w3\.org\/1999\/XSL\/Transform/.test(metin);
}

/**
 * Ayrıştırılmış UBL belgesinden gömülü XSLT şablonunu döner; yoksa null.
 * Birden fazla ek varsa adı `.xslt` ile biteni tercih eder, o da yoksa içeriği
 * `xsl:stylesheet` olan ilk eki. PDF ve şablon olmayan ekler atlanır.
 *
 * @param {Document} belge DOMParser çıktısı
 * @returns {{ xslt: string, dosyaAdi: string } | null}
 */
export function belgedenXsltBul(belge) {
  const ekler = Array.from(belge.getElementsByTagNameNS(CBC, "EmbeddedDocumentBinaryObject"));

  let yedek = null;
  for (const ek of ekler) {
    // Ek gerçekten AdditionalDocumentReference/Attachment altında mı (imza vb. değil)
    const ekKabi = ek.parentNode;
    const ust = ekKabi?.parentNode;
    if (!ekKabi || ekKabi.namespaceURI !== CAC || ekKabi.localName !== "Attachment") continue;
    if (!ust || ust.namespaceURI !== CAC || ust.localName !== "AdditionalDocumentReference") continue;

    const b64 = ek.textContent?.trim();
    if (!b64) continue;
    const dosyaAdi = ek.getAttribute("filename") ?? "";
    const mime = ek.getAttribute("mimeCode") ?? "";

    let baytlar;
    try {
      baytlar = base64Bayt(b64);
    } catch (e) {
      console.debug(`Ek çözülemedi (${dosyaAdi || "adsız"}), atlandı:`, e);
      continue;
    }
    if (pdfMi(dosyaAdi, mime, baytlar)) continue;

    const metin = baytMetin(baytlar);
    if (!xsltIcerikMi(metin)) continue;
    if (xsltAdliMi(dosyaAdi, mime)) return { xslt: metin, dosyaAdi };
    yedek ??= { xslt: metin, dosyaAdi };
  }
  return yedek;
}

/** XML ayrıştırma hatası var mı? (Tarayıcı ve xmldom farklı biçimde bildirir.) */
export function ayristirmaHatasiVarMi(belge) {
  if (!belge?.documentElement) return true;
  if (belge.documentElement.localName === "parsererror") return true;
  return belge.getElementsByTagName("parsererror").length > 0;
}

/**
 * XML metnini çözümler: UBL türü ve gömülü şablon.
 *
 * @param {string} xmlMetni
 * @param {typeof DOMParser} [Ayristirici] testlerde xmldom'un DOMParser'ı verilir
 * @returns {{ belge: Document | null, tur: string | null, sablon: { xslt: string, dosyaAdi: string } | null, hata: string | null }}
 */
export function faturaCozumle(xmlMetni, Ayristirici = globalThis.DOMParser) {
  let belge;
  try {
    belge = new Ayristirici().parseFromString(xmlMetni, "application/xml");
  } catch (e) {
    console.warn("XML ayrıştırılamadı:", e);
    return { belge: null, tur: null, sablon: null, hata: "xml-bozuk" };
  }
  if (ayristirmaHatasiVarMi(belge)) return { belge: null, tur: null, sablon: null, hata: "xml-bozuk" };

  const kok = belge.documentElement;
  const tur = ublTuru(kok.namespaceURI, kok.localName);
  return { belge, tur, sablon: belgedenXsltBul(belge), hata: null };
}
