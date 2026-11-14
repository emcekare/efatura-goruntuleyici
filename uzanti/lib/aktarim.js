/**
 * Belgeyi açan yer (içerik betiği, sağ tık menüsü, açılır pencere, dosya seçimi)
 * ile görüntüleyici sayfası arasında XML'i taşır.
 *
 * XML `storage.session`'da (yalnızca bellekte, tarayıcı kapanınca silinir) rastgele
 * bir anahtarla tutulur; görüntüleyici `viewer.html#b=<anahtar>` ile açılır.
 * Ağ kullanılmaz.
 */

export const api = globalThis.browser ?? globalThis.chrome;

const ONEK = "belge:";
/** Bellekte tutulacak en fazla belge sayısı; eskiler silinir (Chrome kotası ~10 MB). */
const EN_FAZLA_BELGE = 15;

/**
 * @typedef {{ ad: string, xml: string, zaman: number }} KayitliBelge
 */

/** Eski belgeleri siler, en yeni `birak` tanesini tutar. */
async function eskileriSil(birak) {
  const hepsi = await api.storage.session.get(null);
  const anahtarlar = Object.keys(hepsi)
    .filter((k) => k.startsWith(ONEK))
    .sort((a, b) => (hepsi[b]?.zaman ?? 0) - (hepsi[a]?.zaman ?? 0));
  const silinecek = anahtarlar.slice(birak);
  if (silinecek.length) await api.storage.session.remove(silinecek);
}

/**
 * XML'i saklar ve anahtarını döner.
 * @param {string} ad dosya adı
 * @param {string} xml
 */
export async function belgeKaydet(ad, xml) {
  const anahtar = crypto.randomUUID();
  await eskileriSil(EN_FAZLA_BELGE - 1);
  /** @type {KayitliBelge} */
  const kayit = { ad, xml, zaman: Date.now() };
  try {
    await api.storage.session.set({ [ONEK + anahtar]: kayit });
  } catch (e) {
    // Kota doldu: hepsini temizleyip bir kez daha dene
    console.warn("Belge saklanamadı, eski belgeler temizleniyor:", e);
    await eskileriSil(0);
    await api.storage.session.set({ [ONEK + anahtar]: kayit });
  }
  return anahtar;
}

/**
 * @param {string} anahtar
 * @returns {Promise<KayitliBelge | null>}
 */
export async function belgeAl(anahtar) {
  const sonuc = await api.storage.session.get(ONEK + anahtar);
  return sonuc[ONEK + anahtar] ?? null;
}

/** Görüntüleyici sayfasının adresi. */
export function goruntuleyiciAdresi(anahtar) {
  return api.runtime.getURL(anahtar ? `viewer.html#b=${encodeURIComponent(anahtar)}` : "viewer.html");
}

/** URL'den okunur dosya adı çıkarır. */
export function adresAdi(adres) {
  try {
    const yol = new URL(adres).pathname;
    const son = decodeURIComponent(yol.split("/").pop() || "");
    return son || "belge.xml";
  } catch {
    return "belge.xml";
  }
}

/**
 * Sekmeye enjekte edilen fonksiyon: belge XML ise serileştirir.
 * (`scripting.executeScript` ile çalışır; dış değişken kullanamaz.)
 */
function sekmeIcerigiAl() {
  const xmlMi = document instanceof XMLDocument || /(^|\/|\+)xml$/i.test(document.contentType || "");
  if (!xmlMi || !document.documentElement) return { xmlMi: false };
  // Chrome'un XML ağacı görüntüleyicisi asıl XML'i gizli bir kapta tutuyor
  const kaynak = document.getElementById("webkit-xml-viewer-source-xml");
  const kok = kaynak?.firstElementChild ?? document.documentElement;
  return { xmlMi: true, xml: new XMLSerializer().serializeToString(kok), adres: location.href };
}

/** Sekmede kullanıcıya uyarı gösterir (bildirim izni istememek için). */
function sekmedeUyar(metin) {
  alert(metin);
}

/**
 * Bir sekmedeki XML'i görüntüleyicide açar (sağ tık menüsü ve açılır pencere).
 * `activeTab` izni kullanıcı tıkladığında geçici erişim verir.
 * @param {number} sekmeId
 */
export async function sekmeyiGoruntule(sekmeId) {
  let sonuc;
  try {
    [{ result: sonuc }] = await api.scripting.executeScript({ target: { tabId: sekmeId }, func: sekmeIcerigiAl });
  } catch (e) {
    // chrome:// sayfaları, izin verilmemiş file:// adresleri vb.
    console.warn("Sekme içeriği okunamadı:", e);
    await uyarSekmede(sekmeId, api.i18n.getMessage("uyariSekmeOkunamadi"));
    return false;
  }
  if (!sonuc?.xmlMi) {
    await uyarSekmede(sekmeId, api.i18n.getMessage("uyariXmlDegil"));
    return false;
  }
  const anahtar = await belgeKaydet(adresAdi(sonuc.adres), sonuc.xml);
  await api.tabs.update(sekmeId, { url: goruntuleyiciAdresi(anahtar) });
  return true;
}

async function uyarSekmede(sekmeId, metin) {
  try {
    await api.scripting.executeScript({ target: { tabId: sekmeId }, func: sekmedeUyar, args: [metin] });
  } catch (e) {
    // Sekmeye betik enjekte edilemiyorsa görüntüleyiciyi açıp orada göster
    console.warn("Uyarı sekmede gösterilemedi:", metin, e);
    await api.tabs.create({ url: goruntuleyiciAdresi() });
  }
}
