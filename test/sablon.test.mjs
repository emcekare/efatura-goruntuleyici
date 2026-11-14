/**
 * Şablon çıkarma birim testleri (node:test). Tarayıcının DOMParser'ı yerine xmldom.
 * Çalıştırma: npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DOMParser } from "@xmldom/xmldom";

import { faturaCozumle, baytMetin, base64Bayt, ublTuru } from "../uzanti/lib/sablon.js";

const ORNEKLER = join(dirname(fileURLToPath(import.meta.url)), "..", "ornekler");
const ornek = (ad) => baytMetin(new Uint8Array(readFileSync(join(ORNEKLER, ad))));
const cozumle = (xml) => faturaCozumle(xml, DOMParser);
const b64 = (metin) => Buffer.from(metin, "utf8").toString("base64");

const XSLT = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"><xsl:template match="/">ŞABLON</xsl:template></xsl:stylesheet>`;

/** Ekleri verilen en küçük UBL faturası. */
function fatura(ekler, kok = "Invoice") {
  const ad = ekler
    .map(
      ({ dosyaAdi, mime = "application/xml", icerik, ust = "AdditionalDocumentReference" }) => `
    <cac:${ust}><cbc:ID>1</cbc:ID><cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject filename="${dosyaAdi}" mimeCode="${mime}">${icerik}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment></cac:${ust}>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<${kok} xmlns="urn:oasis:names:specification:ubl:schema:xsd:${kok}-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>TST2026000000001</cbc:ID>${ad}
</${kok}>`;
}

test(".xslt adlı eki bulur ve Türkçe karakterleri korur", () => {
  const sonuc = cozumle(fatura([{ dosyaAdi: "sablon.xslt", icerik: b64(XSLT) }]));
  assert.equal(sonuc.hata, null);
  assert.equal(sonuc.tur, "Invoice");
  assert.equal(sonuc.sablon.dosyaAdi, "sablon.xslt");
  assert.match(sonuc.sablon.xslt, /ŞABLON/);
});

test("birden fazla şablon varsa .xslt adlıyı tercih eder", () => {
  const sonuc = cozumle(
    fatura([
      { dosyaAdi: "ilk.dat", icerik: b64(XSLT.replace("ŞABLON", "ADSIZ")) },
      { dosyaAdi: "asil.XSLT", icerik: b64(XSLT.replace("ŞABLON", "ASIL")) },
    ]),
  );
  assert.equal(sonuc.sablon.dosyaAdi, "asil.XSLT");
  assert.match(sonuc.sablon.xslt, /ASIL/);
});

test(".xslt adlı ek yoksa içeriği xsl:stylesheet olan ilk eki alır", () => {
  const sonuc = cozumle(
    fatura([
      { dosyaAdi: "not.txt", mime: "text/plain", icerik: b64("düz metin, şablon değil") },
      { dosyaAdi: "gorunum.dat", mime: "application/octet-stream", icerik: b64(XSLT) },
    ]),
  );
  assert.equal(sonuc.sablon.dosyaAdi, "gorunum.dat");
});

test("PDF eklerini atlar (adı ya da %PDF imzası)", () => {
  const sonuc = cozumle(
    fatura([
      { dosyaAdi: "fatura.pdf", mime: "application/pdf", icerik: b64("%PDF-1.4 ...") },
      { dosyaAdi: "adsiz", mime: "application/octet-stream", icerik: b64("%PDF-1.7 <xsl:stylesheet xmlns:xsl=\"http://www.w3.org/1999/XSL/Transform\">") },
    ]),
  );
  assert.equal(sonuc.sablon, null);
});

test("şablonu xsl:transform köküyle ve farklı önekle de tanır", () => {
  const donusum = `<x:transform version="1.0" xmlns:x="http://www.w3.org/1999/XSL/Transform"><x:template match="/">T</x:template></x:transform>`;
  const sonuc = cozumle(fatura([{ dosyaAdi: "a.bin", icerik: b64(donusum) }]));
  assert.ok(sonuc.sablon);
});

test("AdditionalDocumentReference dışındaki gömülü nesneleri yok sayar", () => {
  const sonuc = cozumle(fatura([{ dosyaAdi: "s.xslt", icerik: b64(XSLT), ust: "Signature" }]));
  assert.equal(sonuc.sablon, null);
});

test("şablon yoksa null döner, belge türü yine belirlenir", () => {
  const sonuc = cozumle(fatura([]));
  assert.equal(sonuc.hata, null);
  assert.equal(sonuc.tur, "Invoice");
  assert.equal(sonuc.sablon, null);
});

test("bozuk base64 ekini atlayıp sonrakine geçer", () => {
  const sonuc = cozumle(
    fatura([
      { dosyaAdi: "bozuk.xslt", icerik: "@@@ bu base64 değil @@@" },
      { dosyaAdi: "iyi.xslt", icerik: b64(XSLT) },
    ]),
  );
  assert.equal(sonuc.sablon.dosyaAdi, "iyi.xslt");
});

test("satır sonlarıyla bölünmüş base64'ü çözer", () => {
  const bolunmus = b64(XSLT).replace(/(.{40})/g, "$1\n      ");
  const sonuc = cozumle(fatura([{ dosyaAdi: "s.xslt", icerik: bolunmus }]));
  assert.match(sonuc.sablon.xslt, /ŞABLON/);
});

test("e-İrsaliye (DespatchAdvice) tanınır", () => {
  const sonuc = cozumle(fatura([{ dosyaAdi: "i.xslt", icerik: b64(XSLT) }], "DespatchAdvice"));
  assert.equal(sonuc.tur, "DespatchAdvice");
  assert.ok(sonuc.sablon);
});

test("UBL olmayan XML'de tür null", () => {
  const sonuc = cozumle(`<?xml version="1.0"?><kok xmlns="urn:baska"><a>1</a></kok>`);
  assert.equal(sonuc.hata, null);
  assert.equal(sonuc.tur, null);
  assert.equal(sonuc.sablon, null);
});

test("bozuk XML'de hata döner", () => {
  const sonuc = cozumle("<Invoice><acik-kaldi></Invoice>");
  assert.equal(sonuc.hata, "xml-bozuk");
});

test("ublTuru kök adı ile ad alanının uyuşmasını ister", () => {
  assert.equal(ublTuru("urn:oasis:names:specification:ubl:schema:xsd:Invoice-2", "Invoice"), "Invoice");
  assert.equal(ublTuru("urn:oasis:names:specification:ubl:schema:xsd:Invoice-2", "CreditNote"), null);
  assert.equal(ublTuru(null, "Invoice"), null);
});

test("baytMetin: BOM, windows-1254 ve varsayılan UTF-8", () => {
  const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...Buffer.from("<a>ğ</a>", "utf8")]);
  assert.equal(baytMetin(bom), "<a>ğ</a>");

  const win = new Uint8Array([...Buffer.from('<?xml version="1.0" encoding="windows-1254"?><a>', "latin1"), 0xf0, 0xfd, 0xde, ...Buffer.from("</a>", "latin1")]);
  assert.match(baytMetin(win), /<a>ğıŞ<\/a>/);

  assert.equal(baytMetin(new Uint8Array(Buffer.from("<a>ü</a>", "utf8"))), "<a>ü</a>");
});

test("base64Bayt boşlukları yok sayar", () => {
  assert.deepEqual(Array.from(base64Bayt(" QU\nJD ")), [0x41, 0x42, 0x43]);
});

// ---- Sentetik örnek dosyalar (ornekler/) ----

test("örnek: efatura-ornek.xml", () => {
  const sonuc = cozumle(ornek("efatura-ornek.xml"));
  assert.equal(sonuc.tur, "Invoice");
  assert.equal(sonuc.sablon.dosyaAdi, "ORN2026000000001.xslt");
});

test("örnek: e-Arşiv'de PDF atlanır, adsız şablon bulunur", () => {
  const sonuc = cozumle(ornek("earsiv-pdf-ve-adsiz-sablon.xml"));
  assert.equal(sonuc.sablon.dosyaAdi, "gorunum.dat");
  assert.match(sonuc.sablon.xslt, /e-ARŞİV FATURA/);
});

test("örnek: windows-1254 dosya ve şablon doğru çözülür", () => {
  const xml = ornek("windows-1254-fatura.xml");
  assert.match(xml, /ğüşıöç ĞÜŞİÖÇ/);
  const sonuc = cozumle(xml);
  assert.match(sonuc.sablon.xslt, /Özelleştirme No/);
});

test("örnek: şablonsuz fatura ve e-İrsaliye", () => {
  assert.equal(cozumle(ornek("sablonsuz-fatura.xml")).sablon, null);
  const irsaliye = cozumle(ornek("eirsaliye-ornek.xml"));
  assert.equal(irsaliye.tur, "DespatchAdvice");
  assert.equal(irsaliye.sablon.dosyaAdi, "irsaliye.xslt");
});
