/**
 * e-Fatura karekodu (QR).
 *
 * GİB şablonları karekodu bir JavaScript kütüphanesiyle çizer: şablon, karekod
 * metnini (JSON) gizli bir `#qrvalue` öğesine yazar, betik de bunu `#qrcode`
 * öğesine çizer. Görüntüleyici şablon betiklerini güvenlik için çalıştırmadığından
 * karekodu uzantı kendisi üretir (qrcode-generator, MIT) ve `#qrcode` öğesine
 * görsel olarak yerleştirir. Standart şablon da aynı `#qrcode` yer tutucusunu kullanır.
 *
 * Karekod metni şablonda varsa (`#qrvalue`) aynen kullanılır; yoksa GİB şablonlarındaki
 * biçimle faturadan üretilir.
 */

import { qrcode } from "../vendor/qrcode-generator/qrcode.mjs";
import { CAC, CBC } from "./sablon.js";

// Türkçe karakterler için UTF-8 (kütüphanenin varsayılanı yalnızca Latin-1)
qrcode.stringToBytes = (metin) => Array.from(new TextEncoder().encode(metin));

const KAREKOD_BOYU = 140; // px, GİB şablonlarındaki boyut (yaklaşık en küçük)
const MODUL_EN_AZ_PX = 2; // modül başına tam sayı piksel: ekranda bulanıklaşmasın
const SESSIZ_BOLGE = 4; // modül; standardın istediği kenar boşluğu

/** Elemanın verilen ad alanı ve adla doğrudan çocukları. */
function cocuklar(ust, adAlani, ad) {
  return ust ? Array.from(ust.childNodes).filter((c) => c.nodeType === 1 && c.namespaceURI === adAlani && c.localName === ad) : [];
}
const cocuk = (ust, adAlani, ad) => cocuklar(ust, adAlani, ad)[0] ?? null;
const metin = (el) => (el?.textContent ?? "").trim();

/** Yol: [[adAlani, ad], ...] boyunca ilk eşleşen eleman. */
function yol(ust, ...adimlar) {
  let el = ust;
  for (const [adAlani, ad] of adimlar) el = cocuk(el, adAlani, ad);
  return el;
}

/** Tarafın VKN ya da TCKN'si. */
function vergiNo(taraf) {
  const parti = yol(taraf, [CAC, "Party"]);
  for (const kimlik of cocuklar(parti, CAC, "PartyIdentification")) {
    const id = cocuk(kimlik, CBC, "ID");
    if (id && ["VKN", "TCKN"].includes(id.getAttribute("schemeID"))) return metin(id);
  }
  return "";
}

/**
 * GİB şablonlarındaki biçimle karekod metni (yalnızca fatura).
 * @param {Document} xmlBelge
 * @returns {string | null}
 */
export function karekodMetni(xmlBelge) {
  const f = xmlBelge?.documentElement;
  if (!f || f.localName !== "Invoice") return null;
  const toplam = cocuk(f, CAC, "LegalMonetaryTotal");
  const veri = {
    vkntckn: vergiNo(cocuk(f, CAC, "AccountingSupplierParty")),
    avkntckn: vergiNo(cocuk(f, CAC, "AccountingCustomerParty")),
    senaryo: metin(cocuk(f, CBC, "ProfileID")),
    tip: metin(cocuk(f, CBC, "InvoiceTypeCode")),
    tarih: metin(cocuk(f, CBC, "IssueDate")),
    no: metin(cocuk(f, CBC, "ID")),
    ettn: metin(cocuk(f, CBC, "UUID")),
    parabirimi: metin(cocuk(f, CBC, "DocumentCurrencyCode")),
    malhizmettoplam: metin(cocuk(toplam, CBC, "LineExtensionAmount")),
  };
  const kdvler = cocuklar(f, CAC, "TaxTotal")
    .flatMap((t) => cocuklar(t, CAC, "TaxSubtotal"))
    .filter((v) => metin(yol(v, [CAC, "TaxCategory"], [CAC, "TaxScheme"], [CBC, "TaxTypeCode"])) === "0015");
  for (const v of kdvler) veri[`kdvmatrah(${metin(cocuk(v, CBC, "Percent"))})`] = metin(cocuk(v, CBC, "TaxableAmount"));
  for (const v of kdvler) veri[`hesaplanankdv(${metin(cocuk(v, CBC, "Percent"))})`] = metin(cocuk(v, CBC, "TaxAmount"));
  veri.vergidahil = metin(cocuk(toplam, CBC, "TaxInclusiveAmount"));
  veri.odenecek = metin(cocuk(toplam, CBC, "PayableAmount"));
  return JSON.stringify(veri);
}

/**
 * Metnin karekodunu SVG data URL'i ve önerilen piksel boyutuyla döner.
 * Hata düzeltme L: GİB şablonları da L kullanıyor; uzun metinde karekod daha seyrek olur.
 * @param {string} icerik
 * @returns {{ url: string, boyut: number }}
 */
export function karekodGorseli(icerik) {
  const qr = qrcode(0, "L"); // sürüm otomatik
  qr.addData(icerik, "Byte");
  qr.make();
  const hucre = 4;
  const svg = qr.createSvgTag({ cellSize: hucre, margin: hucre * SESSIZ_BOLGE, scalable: true });
  const baytlar = new TextEncoder().encode(svg);
  let ikili = "";
  for (const b of baytlar) ikili += String.fromCharCode(b);
  const modul = qr.getModuleCount() + 2 * SESSIZ_BOLGE;
  return {
    url: `data:image/svg+xml;base64,${btoa(ikili)}`,
    // Modül başına tam sayı piksel (bulanıklık okumayı bozuyor)
    boyut: modul * Math.max(MODUL_EN_AZ_PX, Math.floor(KAREKOD_BOYU / modul)),
  };
}

/** Karekodun çizileceği öğe: `#qrcode` ya da kimliği "qrcode" benzeri boş bir öğe. */
function hedefBul(belge) {
  const aday =
    belge.getElementById("qrcode") ??
    Array.from(belge.querySelectorAll("[id]")).find((el) => /^qr[-_]?code$/i.test(el.id));
  if (!aday) return null;
  // Şablon karekodu zaten görsel olarak koymuşsa dokunma
  if (aday.querySelector("img, svg, canvas, table")) return null;
  return aday;
}

/**
 * Şablon çıktısındaki karekod yer tutucusuna karekodu yerleştirir.
 * @param {Document} htmlBelge şablon çıktısı (DOMParser ile ayrıştırılmış)
 * @param {Document} xmlBelge fatura
 * @returns {boolean} karekod yerleştirildi mi
 */
export function karekoduYerlestir(htmlBelge, xmlBelge) {
  const hedef = hedefBul(htmlBelge);
  if (!hedef) return false;
  const icerik = metin(htmlBelge.getElementById("qrvalue")) || karekodMetni(xmlBelge);
  if (!icerik) return false;
  try {
    const gorsel = htmlBelge.createElement("img");
    const { url, boyut } = karekodGorseli(icerik);
    gorsel.src = url;
    gorsel.alt = "Karekod";
    gorsel.width = boyut;
    gorsel.height = boyut;
    gorsel.style.display = "block";
    gorsel.style.imageRendering = "pixelated";
    hedef.replaceChildren(gorsel);
    return true;
  } catch (e) {
    // Çok uzun metin vb.: karekodsuz göster
    console.warn("Karekod üretilemedi:", e);
    return false;
  }
}
