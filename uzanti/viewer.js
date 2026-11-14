/**
 * Görüntüleyici sayfası: XML'i alır, gömülü XSLT şablonunu uygular ve sonucu
 * betik çalıştıramayan bir iframe'de (sandbox="") gösterir. Şablon yoksa ya da
 * uygulanamazsa okunur ham XML gösterilir.
 */

import { faturaCozumle, baytMetin, CBC } from "./lib/sablon.js";
import { xsltHazirla, xsltUygula } from "./lib/donustur.js";
import { gosterimIcinHazirla, yazdirmaIcinTemizle } from "./lib/temizle.js";
import { okunurXml } from "./lib/ham-xml.js";
import { api, belgeAl, belgeKaydet, goruntuleyiciAdresi } from "./lib/aktarim.js";
import { m, sayfayiCevir } from "./lib/dil.js";

const $ = (id) => document.getElementById(id);
const el = {
  aracCubugu: $("aracCubugu"),
  dosyaAdi: $("dosyaAdi"),
  not: $("not"),
  sablonAdi: $("sablonAdi"),
  gorunumDugmesi: $("gorunumDugmesi"),
  baskaDosyaDugmesi: $("baskaDosyaDugmesi"),
  yazdirDugmesi: $("yazdirDugmesi"),
  acilis: $("acilis"),
  yukleniyor: $("yukleniyor"),
  cerceve: $("faturaCercevesi"),
  hamXml: $("hamXml"),
  dosyaGirdisi: $("dosyaGirdisi"),
  ikinciGirdi: $("ikinciGirdi"),
  surukleOrtusu: $("surukleOrtusu"),
};

/** Ekrandaki belge: dönüşüm çıktısı (varsa) ve okunur XML. */
const durum = { html: null, hamMetin: "", gorunum: "fatura" };

/** Test için `viewer.html?polyfill=1`: yerleşik XSLT olsa bile polyfill'i kullan. */
const polyfillZorla = new URLSearchParams(location.search).get("polyfill") === "1";

sayfayiCevir();
baslat().catch((e) => {
  console.error("Görüntüleyici başlatılamadı:", e);
  notGoster(String(e?.message ?? e));
});

async function baslat() {
  dosyaAlmayiKur();
  const anahtar = new URLSearchParams(location.hash.slice(1)).get("b");
  if (!anahtar) {
    acilisGoster();
    return;
  }
  const belge = await belgeAl(anahtar);
  if (!belge) {
    acilisGoster();
    notGoster(m("notBelgeBulunamadi"));
    return;
  }
  await belgeGoster(belge.ad, belge.xml);
}

function acilisGoster() {
  el.yukleniyor.hidden = true;
  el.acilis.hidden = false;
  el.aracCubugu.hidden = true;
}

function notGoster(metin) {
  el.aracCubugu.hidden = false;
  el.not.hidden = !metin;
  el.not.textContent = metin ?? "";
}

/** Belgenin numarası ve tarihi (sekme başlığı için). */
function belgeKunyesi(belge) {
  const kok = belge?.documentElement;
  if (!kok) return null;
  const cocuk = (ad) => Array.from(kok.children).find((c) => c.namespaceURI === CBC && c.localName === ad)?.textContent?.trim();
  const no = cocuk("ID");
  if (!no) return null;
  const tarih = cocuk("IssueDate");
  return tarih ? `${no} · ${tarih}` : no;
}

/**
 * @param {string} ad dosya adı
 * @param {string} xml
 */
async function belgeGoster(ad, xml) {
  el.acilis.hidden = true;
  el.yukleniyor.hidden = false;
  el.aracCubugu.hidden = false;
  el.dosyaAdi.textContent = ad;
  el.dosyaAdi.title = ad;
  notGoster(null);

  const cozum = faturaCozumle(xml);
  durum.hamMetin = okunurXml(cozum.belge, xml);
  durum.html = null;

  const kunye = belgeKunyesi(cozum.belge);
  document.title = kunye ? m("baslikFatura", kunye) : `${ad} — ${m("uzantiAdi")}`;
  if (kunye) el.dosyaAdi.textContent = `${kunye}  ·  ${ad}`;

  let neden = null;
  if (cozum.hata) {
    neden = m("notXmlBozuk");
  } else if (!cozum.sablon) {
    neden = cozum.tur ? m("notSablonYok") : m("notUblDegil");
  } else if (!(await xsltHazirla(polyfillZorla))) {
    neden = m("notXsltYok");
  } else {
    try {
      durum.html = gosterimIcinHazirla(xsltUygula(cozum.belge, cozum.sablon.xslt));
    } catch (e) {
      console.error("Şablon uygulanamadı:", e);
      neden = m("notDonusumHatasi", e?.message ?? String(e));
    }
  }

  el.sablonAdi.hidden = !cozum.sablon?.dosyaAdi;
  el.sablonAdi.textContent = cozum.sablon?.dosyaAdi ? m("aracSablon", cozum.sablon.dosyaAdi) : "";
  notGoster(neden);
  gorunumSec(durum.html ? "fatura" : "ham");
  el.yukleniyor.hidden = true;
}

/** "fatura" ya da "ham" görünümünü açar. */
function gorunumSec(gorunum) {
  durum.gorunum = gorunum;
  const fatura = gorunum === "fatura" && durum.html !== null;
  if (fatura && el.cerceve.srcdoc !== durum.html) {
    el.cerceve.title = el.dosyaAdi.textContent;
    el.cerceve.srcdoc = durum.html;
  }
  el.cerceve.hidden = !fatura;
  el.hamXml.hidden = fatura;
  if (!fatura) el.hamXml.textContent = durum.hamMetin;

  el.yazdirDugmesi.hidden = durum.html === null || !fatura;
  el.gorunumDugmesi.hidden = durum.html === null;
  el.gorunumDugmesi.textContent = fatura ? m("aracHamXml") : m("aracFatura");
}

el.gorunumDugmesi.addEventListener("click", () => gorunumSec(durum.gorunum === "fatura" ? "ham" : "fatura"));

// ---- Yazdırma ----
// sandbox="" çerçeve parent'tan yazdırılamaz. Temizlenmiş çıktı (betik ve olay
// öznitelikleri yok) ayrı, betik çalıştıramayan ama parent'ın erişebildiği bir
// çerçevede açılıp yazdırılır.
let yazdirmaCercevesi = null;

function yazdir() {
  if (durum.html === null) {
    window.print();
    return;
  }
  yazdirmaCercevesi?.remove();
  const cerceve = document.createElement("iframe");
  cerceve.setAttribute("sandbox", "allow-same-origin allow-modals");
  cerceve.className = "yazdirma-cercevesi";
  cerceve.setAttribute("aria-hidden", "true");
  cerceve.tabIndex = -1;
  cerceve.addEventListener(
    "load",
    () => {
      try {
        cerceve.contentWindow.focus();
        cerceve.contentWindow.print();
      } catch (e) {
        console.error("Yazdırma başlatılamadı:", e);
        window.print();
      }
    },
    { once: true },
  );
  cerceve.srcdoc = yazdirmaIcinTemizle(durum.html);
  document.body.appendChild(cerceve);
  yazdirmaCercevesi = cerceve;
}

el.yazdirDugmesi.addEventListener("click", yazdir);
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "p" && durum.html !== null && durum.gorunum === "fatura") {
    e.preventDefault();
    yazdir();
  }
});

// ---- Dosya açma: seçme ve sürükle-bırak ----

/** Dosyayı bayt olarak okuyup karakter kodlamasına göre metne çevirir. */
async function dosyaOku(dosya) {
  return baytMetin(new Uint8Array(await dosya.arrayBuffer()));
}

/** İlk dosya bu sekmede, diğerleri yeni sekmelerde açılır. */
async function dosyalariAc(dosyalar) {
  const liste = Array.from(dosyalar ?? []);
  if (!liste.length) return;
  for (const [i, dosya] of liste.entries()) {
    let xml;
    try {
      xml = await dosyaOku(dosya);
    } catch (e) {
      console.error("Dosya okunamadı:", dosya.name, e);
      notGoster(m("notDosyaOkunamadi", dosya.name));
      continue;
    }
    const anahtar = await belgeKaydet(dosya.name, xml);
    if (i === 0) {
      // Adres çubuğu da güncellensin (yenileyince aynı belge gelsin)
      history.replaceState(null, "", goruntuleyiciAdresi(anahtar));
      await belgeGoster(dosya.name, xml);
    } else {
      await api.tabs.create({ url: goruntuleyiciAdresi(anahtar), active: false });
    }
  }
}

function dosyaAlmayiKur() {
  el.dosyaGirdisi.addEventListener("change", () => {
    dosyalariAc(el.dosyaGirdisi.files).catch((e) => console.error(e));
    el.dosyaGirdisi.value = "";
  });
  el.ikinciGirdi.addEventListener("change", () => {
    dosyalariAc(el.ikinciGirdi.files).catch((e) => console.error(e));
    el.ikinciGirdi.value = "";
  });
  el.baskaDosyaDugmesi.addEventListener("click", () => el.ikinciGirdi.click());

  let derinlik = 0;
  const dosyaSurukleniyor = (e) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
  document.addEventListener("dragenter", (e) => {
    if (!dosyaSurukleniyor(e)) return;
    derinlik++;
    el.surukleOrtusu.hidden = false;
  });
  document.addEventListener("dragleave", () => {
    derinlik = Math.max(0, derinlik - 1);
    if (derinlik === 0) el.surukleOrtusu.hidden = true;
  });
  document.addEventListener("dragover", (e) => {
    if (dosyaSurukleniyor(e)) e.preventDefault();
  });
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    derinlik = 0;
    el.surukleOrtusu.hidden = true;
    dosyalariAc(e.dataTransfer?.files).catch((err) => console.error(err));
  });
}
