/**
 * Uçtan uca test: uzantıyı Chromium'a paketlenmemiş yükler, örnek XML'leri açar.
 *
 * Doğrular: .xml sekmesinin görüntüleyiciye yönlenmesi, şablonun uygulanması
 * (yerleşik XSLT ve WASM polyfill), şablonsuz belgede ham XML, dosya seçerek açma,
 * windows-1254, şablon betiklerinin çalışmaması ve uzantının ağa istek atmaması
 * (127.0.0.1:8719'daki "izleme" sunucusuna şablondan istek gelmemeli).
 *
 * Çalıştırma:  npm run test:e2e
 *   CHROMIUM_YOLU=<chrome.exe>   başka bir Chromium/Chrome ile dene
 *   GORUNTU_KLASORU=<klasör>     ekran görüntülerini kaydet
 *   GORUNUR=1                    tarayıcı penceresini göster
 */

import { createServer } from "node:http";
import { readFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { chromium } from "playwright-core";

const KOK = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const UZANTI = join(KOK, "uzanti");
const ORNEKLER = join(KOK, "ornekler");
const PORT = 8719;
const SITE = `http://127.0.0.1:${PORT}`;

// ---- Yerel sunucu: örnekleri verir, diğer her isteği "sızıntı" olarak kaydeder ----
const sizintilar = [];
const sunucu = createServer((istek, yanit) => {
  const ad = decodeURIComponent(istek.url.split("?")[0].slice(1));
  const yol = join(ORNEKLER, ad);
  if (/^[\w.-]+\.xml$/.test(ad) && existsSync(yol) && !ad.startsWith("dis-")) {
    yanit.writeHead(200, { "content-type": "application/xml" });
    yanit.end(readFileSync(yol));
    return;
  }
  // Tarayıcının sayfa için kendiliğinden istediği simge uzantıdan gelmiyor
  if (ad !== "favicon.ico") sizintilar.push(istek.url);
  yanit.writeHead(404).end();
});
await new Promise((coz) => sunucu.listen(PORT, "127.0.0.1", coz));

function chromiumBul() {
  if (process.env.CHROMIUM_YOLU) return process.env.CHROMIUM_YOLU;
  const yer = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "ms-playwright") : join(homedir(), ".cache", "ms-playwright");
  const aday = [join(yer, "chromium-1208", "chrome-win64", "chrome.exe"), join(yer, "chromium-1208", "chrome-linux64", "chrome")];
  const bulunan = aday.find(existsSync);
  if (!bulunan) throw new Error("Chromium bulunamadı; CHROMIUM_YOLU verin ya da `npx playwright-core install chromium` çalıştırın");
  return bulunan;
}

const profil = mkdtempSync(join(tmpdir(), "efatura-e2e-"));
const baglam = await chromium.launchPersistentContext(profil, {
  executablePath: chromiumBul(),
  headless: false,
  args: [
    ...(process.env.GORUNUR ? [] : ["--headless=new"]),
    // Google Chrome --load-extension'ı yok sayıyor; uzantı DevTools protokolüyle yüklenir (aşağıda)
    "--enable-unsafe-extension-debugging",
  ],
  ignoreDefaultArgs: ["--disable-extensions"],
  viewport: { width: 1100, height: 900 },
});

const sonuclar = [];
async function dene(ad, fn) {
  try {
    await fn();
    sonuclar.push([ad, true]);
    console.log(`✔ ${ad}`);
  } catch (e) {
    sonuclar.push([ad, false]);
    console.log(`✘ ${ad}\n    ${String(e?.message ?? e).split("\n").slice(0, 4).join("\n    ")}`);
  }
}
function esitMi(gercek, beklenen, mesaj) {
  if (gercek !== beklenen) throw new Error(`${mesaj}: beklenen ${JSON.stringify(beklenen)}, gelen ${JSON.stringify(gercek)}`);
}
function icerir(metin, aranan, mesaj) {
  if (!String(metin).includes(aranan)) throw new Error(`${mesaj}: "${aranan}" bulunamadı`);
}

try {
  const cdp = await baglam.browser().newBrowserCDPSession();
  const { id: uzantiId } = await cdp.send("Extensions.loadUnpacked", { path: UZANTI });
  const VIEWER = `chrome-extension://${uzantiId}/viewer.html`;
  console.log(`Tarayıcı: ${baglam.browser()?.version() ?? "?"} · uzantı: ${uzantiId}`);

  const sayfa = await baglam.newPage();
  const yerelXslt = await (async () => {
    await sayfa.goto(VIEWER);
    return sayfa.evaluate(() => typeof XSLTProcessor !== "undefined");
  })();
  console.log(`Yerleşik XSLTProcessor: ${yerelXslt ? "var" : "YOK (polyfill kullanılacak)"}`);

  // Uzantı sayfalarından giden istekleri de izle (chrome-extension:// dışı her şey şüpheli).
  // CSP'nin engellediği istekler de "request" olayı üretir; onlar ayrıca sayılır.
  const disIstekler = new Map();
  const cspEngelledi = [];
  const izlenmeli = (u) =>
    !/^(chrome-extension|data|about|blob):/.test(u) &&
    !(/^http:\/\/127\.0\.0\.1:8719\/[\w.-]+\.xml$/.test(u) && !u.includes("/dis-")) && // örneğin kendisi
    !u.endsWith("/favicon.ico");
  baglam.on("request", (r) => {
    if (!izlenmeli(r.url())) return;
    let cerceveAdresi = "?";
    try {
      cerceveAdresi = r.frame().url().slice(0, 40);
    } catch {
      // service worker istekleri çerçevesiz
    }
    disIstekler.set(r, `${r.url()} [${r.resourceType()}, ${cerceveAdresi}]`);
  });
  baglam.on("requestfinished", (r) => { if (process.env.HATA_AYIKLA && disIstekler.has(r)) console.log("    istek tamamlandı:", r.url()); });
  baglam.on("requestfailed", (r) => {
    if (!disIstekler.has(r)) return;
    if (process.env.HATA_AYIKLA) console.log("    istek başarısız:", r.url(), r.failure()?.errorText);
    if (/^csp$|BLOCKED_BY_CSP|blocked/i.test(r.failure()?.errorText ?? "")) {
      cspEngelledi.push(disIstekler.get(r));
      disIstekler.delete(r);
    }
  });

  /** Bir .xml adresini açar, görüntüleyiciye yönlenmesini bekler. */
  async function xmlAc(ad) {
    await sayfa.goto(`${SITE}/${ad}`);
    await sayfa.waitForURL(/viewer\.html#b=/, { timeout: 15000 });
    await sayfa.waitForSelector("#yukleniyor", { state: "hidden" });
    return sayfa.url();
  }
  const cerceve = () => sayfa.frameLocator("#faturaCercevesi");
  /** Çerçeve metni; `bekle` verilirse o metin görünene kadar (en çok 10 sn) bekler. */
  async function cerceveMetni(bekle = null) {
    const son = Date.now() + 10000;
    for (;;) {
      const metin = await cerceve().locator("body").innerText({ timeout: 10000 }).catch(() => "");
      if (!bekle || metin.includes(bekle) || Date.now() > son) return metin;
      await sayfa.waitForTimeout(200);
    }
  }
  const goruntu = async (ad) => {
    if (process.env.GORUNTU_KLASORU) await sayfa.screenshot({ path: join(process.env.GORUNTU_KLASORU, `${ad}.png`) });
  };

  let efaturaAdresi;
  await dene(".xml sekmesi görüntüleyiciye yönlenir ve şablon uygulanır", async () => {
    efaturaAdresi = await xmlAc("efatura-ornek.xml");
    const metin = await cerceveMetni("ORN2026000000001");
    icerir(metin, "ÖRNEK YAZILIM VE DANIŞMANLIK TİCARET A.Ş.", "satıcı");
    icerir(metin, "12.500,00 TRY", "format-number (Türkçe biçim)");
    icerir(metin, "ORN2026000000001", "fatura no");
    esitMi(await sayfa.locator("#faturaCercevesi").getAttribute("sandbox"), "", "iframe sandbox");
    icerir(await sayfa.title(), "ORN2026000000001", "sekme başlığı");
    await goruntu("efatura-ornek");
  });

  await dene("WASM polyfill ile dönüşüm (?polyfill=1)", async () => {
    await sayfa.goto(efaturaAdresi.replace("viewer.html#", "viewer.html?polyfill=1#"));
    await sayfa.waitForSelector("#yukleniyor", { state: "hidden", timeout: 30000 });
    const notMetni = await sayfa.locator("#not").textContent();
    if (await sayfa.locator("#not").isVisible()) throw new Error(`uyarı gösterildi: ${notMetni}`);
    const metin = await cerceveMetni("12.500,00");
    icerir(metin, "12.500,00 TRY", "polyfill format-number");
    icerir(metin, "Kurulum ve eğitim hizmeti — İşletme personeli", "Türkçe karakter");
    await goruntu("efatura-polyfill");
  });

  await dene("e-Arşiv: PDF eki atlanır, adı .xslt olmayan şablon kullanılır", async () => {
    await xmlAc("earsiv-pdf-ve-adsiz-sablon.xml");
    icerir(await cerceveMetni("e-ARŞİV"), "e-ARŞİV FATURA", "başlık");
    icerir(await sayfa.locator("#sablonAdi").textContent(), "gorunum.dat", "şablon adı");
  });

  await dene("e-İrsaliye", async () => {
    await xmlAc("eirsaliye-ornek.xml");
    const metin = await cerceveMetni("e-İRSALİYE");
    icerir(metin, "e-İRSALİYE", "başlık");
    icerir(metin, "Şükrü Güneşoğlu", "şoför");
  });

  await dene("şablonsuz faturada okunur ham XML", async () => {
    await xmlAc("sablonsuz-fatura.xml");
    esitMi(await sayfa.locator("#faturaCercevesi").isVisible(), false, "iframe gizli");
    icerir(await sayfa.locator("#hamXml").textContent(), "<cbc:ID>SBL2026000000007</cbc:ID>", "ham XML");
    icerir(await sayfa.locator("#not").textContent(), "şablon", "uyarı notu");
  });

  await dene("ham XML / fatura görünümü arasında geçiş", async () => {
    await xmlAc("efatura-ornek.xml");
    await sayfa.click("#gorunumDugmesi");
    const ham = await sayfa.locator("#hamXml").textContent();
    icerir(ham, "karakter base64]", "gömülü ek kısaltılmış");
    await sayfa.click("#gorunumDugmesi");
    esitMi(await sayfa.locator("#faturaCercevesi").isVisible(), true, "fatura geri geldi");
  });

  await dene("dosya seçerek açma + windows-1254", async () => {
    await sayfa.goto(VIEWER);
    await sayfa.locator("#dosyaGirdisi").setInputFiles(join(ORNEKLER, "windows-1254-fatura.xml"));
    await sayfa.waitForURL(/#b=/);
    await sayfa.waitForSelector("#faturaCercevesi:not([hidden])");
    icerir(await cerceveMetni("ğüşıöç"), "ğüşıöç ĞÜŞİÖÇ", "windows-1254 Türkçe karakterler");
  });

  await dene("şablondaki betikler ve olay öznitelikleri çalışmaz", async () => {
    await xmlAc("guvenlik-testi.xml");
    const fr = cerceve();
    await fr.locator("#tuzak").click();
    await fr.locator("#jsbag").click().catch(() => {});
    await sayfa.waitForTimeout(800);
    const baslik = await sayfa.frame({ url: /about:srcdoc/ })?.evaluate(() => document.title).catch(() => "?");
    for (const kotu of ["BETIK-CALISTI", "TIKLAMA-CALISTI", "JS-BAGLANTI", "ONERROR-CALISTI"]) {
      if (String(baslik).includes(kotu)) throw new Error(`şablon betiği çalıştı: ${kotu}`);
    }
    icerir(await sayfa.title(), "GVN2026000000666", "görüntüleyici başlığı değişmedi");
    icerir(sayfa.url(), "viewer.html", "sayfa yönlenmedi");
  });

  await dene("yazdırma çerçevesi temizlenmiş HTML içerir", async () => {
    // Başsız modda yazdırma penceresi açılmaz; yalnızca çerçevenin içeriğini denetle
    await sayfa.evaluate(() => {
      window.__yazdirildi = false;
    });
    await sayfa.click("#yazdirDugmesi");
    const yazdirma = sayfa.locator("iframe.yazdirma-cercevesi");
    esitMi(await yazdirma.getAttribute("sandbox"), "allow-same-origin allow-modals", "yazdırma sandbox");
    const srcdoc = await yazdirma.getAttribute("srcdoc");
    for (const yasak of ["<script", "onclick", "onerror", "href=\"javascript:", "http-equiv=\"refresh", "<link"]) {
      if (srcdoc.toLowerCase().includes(yasak)) throw new Error(`temizlenmemiş: ${yasak}`);
    }
    icerir(srcdoc, "GÜVENLİK TESTİ", "içerik korunmuş");
    icerir(srcdoc, "Content-Security-Policy", "CSP eklenmiş");
  });

  await dene("document() ile dış belge çekilemez (yerleşik + polyfill)", async () => {
    const adres = await xmlAc("guvenlik-dis-belge.xml");
    await sayfa.waitForTimeout(500);
    await sayfa.goto(adres.replace("viewer.html#", "viewer.html?polyfill=1#"));
    await sayfa.waitForSelector("#yukleniyor", { state: "hidden", timeout: 30000 });
    await sayfa.waitForTimeout(1000);
  });

  // Meta refresh 5 sn sonra tetiklenirdi; bekle ve hiçbir isteğin sunucuya ulaşmadığını doğrula
  await sayfa.waitForTimeout(5500);
  await dene("uzantı ağa istek atmadı (izleme sunucusu + istek dinleyici)", async () => {
    if (sizintilar.length) throw new Error(`sunucuya ulaşan istekler: ${sizintilar.join(", ")}`);
    if (disIstekler.size) throw new Error(`tarayıcıdan giden istekler: ${[...disIstekler.values()].join(", ")}`);
    if (cspEngelledi.length) console.log(`    (CSP'nin engellediği istek girişimleri: ${cspEngelledi.length} — ${cspEngelledi.join(", ")})`);
  });
} finally {
  await baglam.close();
  sunucu.close();
  try {
    rmSync(profil, { recursive: true, force: true });
  } catch (e) {
    console.warn("Geçici profil silinemedi:", e.message);
  }
}

const basarisiz = sonuclar.filter(([, b]) => !b).length;
console.log(`\n${sonuclar.length - basarisiz}/${sonuclar.length} başarılı`);
process.exit(basarisiz ? 1 : 0);
