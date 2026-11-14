/**
 * Elle test için SENTETİK UBL-TR örnekleri üretir (ornekler/ klasörü).
 * İçlerindeki firma, VKN ve tutarlar uydurmadır; gerçek mükellef verisi KULLANMAYIN.
 * Kullanım: node araclar/ornek-uret.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HEDEF = join(dirname(fileURLToPath(import.meta.url)), "..", "ornekler");
mkdirSync(HEDEF, { recursive: true });

/** Güvenlik örneklerindeki dış adresler: uçtan uca test bu porttaki sunucuya istek gelmediğini doğrular. */
export const IZLEME_ADRESI = "http://127.0.0.1:8719";

const b64 = (metin, kodlama = "utf8") =>
  (Buffer.isBuffer(metin) ? metin : Buffer.from(metin, kodlama)).toString("base64").replace(/(.{76})/g, "$1\n");

// ---------------------------------------------------------------- Şablonlar

function faturaSablonu({ baslik = "e-FATURA", ekBas = "", ekGovde = "" } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:inv="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  exclude-result-prefixes="inv cac cbc">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:decimal-format name="tr" decimal-separator="," grouping-separator="."/>

  <xsl:template name="tutar">
    <xsl:param name="d"/>
    <xsl:value-of select="format-number($d, '###.##0,00', 'tr')"/>
    <xsl:text> </xsl:text>
    <xsl:value-of select="$d/@currencyID"/>
  </xsl:template>

  <xsl:template match="/inv:Invoice">
    <html>
      <head>
        <meta charset="UTF-8"/>
        <title><xsl:value-of select="cbc:ID"/></title>
        <style>
          body { font-family: Tahoma, Verdana, sans-serif; font-size: 12px; color: #111; margin: 24px auto; max-width: 820px; }
          .ust { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
          .taraf { border: 1px solid #999; padding: 8px 10px; width: 46%; line-height: 1.5; }
          .taraf b { font-size: 13px; }
          h1 { text-align: center; font-size: 22px; letter-spacing: 2px; margin: 18px 0; }
          table { border-collapse: collapse; width: 100%; }
          .bilgi td { border: 1px solid #999; padding: 3px 8px; }
          .bilgi td:first-child { font-weight: bold; width: 160px; }
          .kalemler { margin-top: 18px; }
          .kalemler th { background: #e8e8e8; border: 1px solid #777; padding: 4px; }
          .kalemler td { border: 1px solid #999; padding: 4px; }
          .sayi { text-align: right; white-space: nowrap; }
          .toplam { width: 50%; margin: 14px 0 0 auto; }
          .toplam td { border: 1px solid #999; padding: 4px 8px; }
          .toplam tr:last-child td { font-weight: bold; background: #f0f0f0; }
          .notlar { margin-top: 18px; border-top: 1px dashed #999; padding-top: 8px; }
          @media print { body { margin: 0; } }
        </style>
        ${ekBas}
      </head>
      <body>
        ${ekGovde}
        <div class="ust">
          <div class="taraf">
            <b><xsl:value-of select="cac:AccountingSupplierParty/cac:Party/cac:PartyName/cbc:Name"/></b><br/>
            <xsl:value-of select="cac:AccountingSupplierParty/cac:Party/cac:PostalAddress/cbc:StreetName"/><br/>
            <xsl:value-of select="cac:AccountingSupplierParty/cac:Party/cac:PostalAddress/cbc:CitySubdivisionName"/> /
            <xsl:value-of select="cac:AccountingSupplierParty/cac:Party/cac:PostalAddress/cbc:CityName"/><br/>
            Vergi Dairesi: <xsl:value-of select="cac:AccountingSupplierParty/cac:Party/cac:PartyTaxScheme/cac:TaxScheme/cbc:Name"/><br/>
            VKN: <xsl:value-of select="cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID"/>
          </div>
          <div class="taraf">
            <b>SAYIN</b><br/>
            <b><xsl:value-of select="cac:AccountingCustomerParty/cac:Party/cac:PartyName/cbc:Name"/></b><br/>
            <xsl:value-of select="cac:AccountingCustomerParty/cac:Party/cac:PostalAddress/cbc:StreetName"/><br/>
            <xsl:value-of select="cac:AccountingCustomerParty/cac:Party/cac:PostalAddress/cbc:CityName"/><br/>
            VKN: <xsl:value-of select="cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID"/>
          </div>
        </div>

        <h1>${baslik}</h1>

        <table class="bilgi">
          <tr><td>Özelleştirme No</td><td><xsl:value-of select="cbc:CustomizationID"/></td></tr>
          <tr><td>Senaryo</td><td><xsl:value-of select="cbc:ProfileID"/></td></tr>
          <tr><td>Fatura Tipi</td><td><xsl:value-of select="cbc:InvoiceTypeCode"/></td></tr>
          <tr><td>Fatura No</td><td><xsl:value-of select="cbc:ID"/></td></tr>
          <tr><td>Fatura Tarihi</td><td>
            <xsl:value-of select="concat(substring(cbc:IssueDate,9,2), '-', substring(cbc:IssueDate,6,2), '-', substring(cbc:IssueDate,1,4))"/>
          </td></tr>
          <tr><td>ETTN</td><td><xsl:value-of select="cbc:UUID"/></td></tr>
        </table>

        <table class="kalemler">
          <tr>
            <th>Sıra</th><th>Mal / Hizmet</th><th>Miktar</th><th>Birim Fiyat</th>
            <th>KDV Oranı</th><th>KDV Tutarı</th><th>Mal Hizmet Tutarı</th>
          </tr>
          <xsl:for-each select="cac:InvoiceLine">
            <tr>
              <td class="sayi"><xsl:value-of select="cbc:ID"/></td>
              <td><xsl:value-of select="cac:Item/cbc:Name"/></td>
              <td class="sayi">
                <xsl:value-of select="format-number(cbc:InvoicedQuantity, '###.##0,##', 'tr')"/>
                <xsl:text> </xsl:text>
                <xsl:choose>
                  <xsl:when test="cbc:InvoicedQuantity/@unitCode = 'C62'">Adet</xsl:when>
                  <xsl:when test="cbc:InvoicedQuantity/@unitCode = 'HUR'">Saat</xsl:when>
                  <xsl:otherwise><xsl:value-of select="cbc:InvoicedQuantity/@unitCode"/></xsl:otherwise>
                </xsl:choose>
              </td>
              <td class="sayi"><xsl:call-template name="tutar"><xsl:with-param name="d" select="cac:Price/cbc:PriceAmount"/></xsl:call-template></td>
              <td class="sayi">%<xsl:value-of select="cac:TaxTotal/cac:TaxSubtotal/cbc:Percent"/></td>
              <td class="sayi"><xsl:call-template name="tutar"><xsl:with-param name="d" select="cac:TaxTotal/cbc:TaxAmount"/></xsl:call-template></td>
              <td class="sayi"><xsl:call-template name="tutar"><xsl:with-param name="d" select="cbc:LineExtensionAmount"/></xsl:call-template></td>
            </tr>
          </xsl:for-each>
        </table>

        <table class="toplam">
          <tr><td>Mal Hizmet Toplam Tutarı</td><td class="sayi"><xsl:call-template name="tutar"><xsl:with-param name="d" select="cac:LegalMonetaryTotal/cbc:LineExtensionAmount"/></xsl:call-template></td></tr>
          <xsl:for-each select="cac:TaxTotal/cac:TaxSubtotal">
            <tr><td>Hesaplanan KDV (%<xsl:value-of select="cbc:Percent"/>)</td><td class="sayi"><xsl:call-template name="tutar"><xsl:with-param name="d" select="cbc:TaxAmount"/></xsl:call-template></td></tr>
          </xsl:for-each>
          <tr><td>Vergiler Dahil Toplam Tutar</td><td class="sayi"><xsl:call-template name="tutar"><xsl:with-param name="d" select="cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount"/></xsl:call-template></td></tr>
          <tr><td>Ödenecek Tutar</td><td class="sayi"><xsl:call-template name="tutar"><xsl:with-param name="d" select="cac:LegalMonetaryTotal/cbc:PayableAmount"/></xsl:call-template></td></tr>
        </table>

        <div class="notlar">
          <xsl:for-each select="cbc:Note"><p><xsl:value-of select="."/></p></xsl:for-each>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
`;
}

const IRSALIYE_SABLONU = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:da="urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  exclude-result-prefixes="da cac cbc">
  <xsl:output method="html" encoding="UTF-8"/>
  <xsl:template match="/da:DespatchAdvice">
    <html><head><meta charset="UTF-8"/><title>İrsaliye</title>
      <style>
        body { font-family: Tahoma, sans-serif; font-size: 12px; max-width: 760px; margin: 24px auto; }
        h1 { text-align: center; letter-spacing: 2px; }
        table { border-collapse: collapse; width: 100%; margin-top: 12px; }
        td, th { border: 1px solid #888; padding: 4px 8px; }
        th { background: #eee; }
      </style></head>
      <body>
        <p><b><xsl:value-of select="cac:DespatchSupplierParty/cac:Party/cac:PartyName/cbc:Name"/></b><br/>
           Alıcı: <xsl:value-of select="cac:DeliveryCustomerParty/cac:Party/cac:PartyName/cbc:Name"/></p>
        <h1>e-İRSALİYE</h1>
        <table>
          <tr><td>İrsaliye No</td><td><xsl:value-of select="cbc:ID"/></td></tr>
          <tr><td>Düzenleme Tarihi</td><td><xsl:value-of select="cbc:IssueDate"/></td></tr>
          <tr><td>Sevk Tarihi</td><td><xsl:value-of select="cac:Shipment/cac:Delivery/cac:Despatch/cbc:ActualDespatchDate"/></td></tr>
          <tr><td>Plaka</td><td><xsl:value-of select="cac:Shipment/cac:ShipmentStage/cac:TransportMeans/cac:RoadTransport/cbc:LicensePlateID"/></td></tr>
          <tr><td>Şoför</td><td><xsl:value-of select="concat(cac:Shipment/cac:ShipmentStage/cac:DriverPerson/cbc:FirstName, ' ', cac:Shipment/cac:ShipmentStage/cac:DriverPerson/cbc:FamilyName)"/></td></tr>
        </table>
        <table>
          <tr><th>Sıra</th><th>Mal</th><th>Miktar</th></tr>
          <xsl:for-each select="cac:DespatchLine">
            <tr><td><xsl:value-of select="cbc:ID"/></td><td><xsl:value-of select="cac:Item/cbc:Name"/></td>
                <td><xsl:value-of select="cbc:DeliveredQuantity"/> <xsl:value-of select="cbc:DeliveredQuantity/@unitCode"/></td></tr>
          </xsl:for-each>
        </table>
      </body></html>
  </xsl:template>
</xsl:stylesheet>
`;

// ---------------------------------------------------------------- Belgeler

const NS = `xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"`;

function ek({ id = "ORNEK", dosyaAdi, mime = "application/xml", icerik }) {
  return `
  <cac:AdditionalDocumentReference>
    <cbc:ID>${id}</cbc:ID>
    <cbc:IssueDate>2026-11-02</cbc:IssueDate>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject characterSetCode="UTF-8" encodingCode="Base64" filename="${dosyaAdi}" mimeCode="${mime}">${icerik}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>`;
}

function taraf(ad, vkn, sokak, ilce, il, vd) {
  return `<cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="VKN">${vkn}</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name>${ad}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${sokak}</cbc:StreetName>
        <cbc:CitySubdivisionName>${ilce}</cbc:CitySubdivisionName>
        <cbc:CityName>${il}</cbc:CityName>
        <cac:Country><cbc:Name>Türkiye</cbc:Name></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>${vd}</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>
    </cac:Party>`;
}

function kalem(sira, ad, miktar, birim, fiyat, oran) {
  const tutar = (miktar * fiyat).toFixed(2);
  const kdv = ((miktar * fiyat * oran) / 100).toFixed(2);
  return `
  <cac:InvoiceLine>
    <cbc:ID>${sira}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${birim}">${miktar}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="TRY">${tutar}</cbc:LineExtensionAmount>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="TRY">${kdv}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="TRY">${tutar}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="TRY">${kdv}</cbc:TaxAmount>
        <cbc:Percent>${oran}</cbc:Percent>
        <cac:TaxCategory><cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item><cbc:Name>${ad}</cbc:Name></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="TRY">${fiyat.toFixed(2)}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>`;
}

const KALEMLER = [
  [1, "Çağrı merkezi yazılımı aylık kullanım bedeli (Kasım)", 1, "C62", 12500, 20],
  [2, "Kurulum ve eğitim hizmeti — İşletme personeli", 6, "HUR", 1850.5, 20],
  [3, "Yedek güç kaynağı (UPS) 1500 VA", 2, "C62", 4325.75, 20],
];

function fatura({ no, uuid, profil = "TEMELFATURA", notlar = [], ekler = "", kalemler = KALEMLER, kodlama = "UTF-8" }) {
  const matrah = kalemler.reduce((t, k) => t + k[2] * k[4], 0);
  const kdv = kalemler.reduce((t, k) => t + (k[2] * k[4] * k[5]) / 100, 0);
  return `<?xml version="1.0" encoding="${kodlama}"?>
<Invoice ${NS}>
  <ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>TR1.2</cbc:CustomizationID>
  <cbc:ProfileID>${profil}</cbc:ProfileID>
  <cbc:ID>${no}</cbc:ID>
  <cbc:CopyIndicator>false</cbc:CopyIndicator>
  <cbc:UUID>${uuid}</cbc:UUID>
  <cbc:IssueDate>2026-11-02</cbc:IssueDate>
  <cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>
${notlar.map((n) => `  <cbc:Note>${n}</cbc:Note>`).join("\n")}
  <cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
  <cbc:LineCountNumeric>${kalemler.length}</cbc:LineCountNumeric>${ekler}
  <cac:AccountingSupplierParty>
    ${taraf("ÖRNEK YAZILIM VE DANIŞMANLIK TİCARET A.Ş.", "9990000001", "Çiçek Sokak No: 7/3", "Çankaya", "ANKARA", "Kavaklıdere")}
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    ${taraf("DENEME GIDA İTHALAT İHRACAT LTD. ŞTİ.", "9990000002", "Işıklar Caddesi No: 41", "Muratpaşa", "ANTALYA", "Antalya Kurumlar")}
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="TRY">${kdv.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="TRY">${matrah.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="TRY">${kdv.toFixed(2)}</cbc:TaxAmount>
      <cbc:Percent>20</cbc:Percent>
      <cac:TaxCategory><cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="TRY">${matrah.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="TRY">${matrah.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="TRY">${(matrah + kdv).toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="TRY">${(matrah + kdv).toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${kalemler.map((k) => kalem(...k)).join("")}
</Invoice>
`;
}

/** Türkçe karakterleri windows-1254'e çevirir (yalnızca örnekte geçen harfler + ASCII). */
function windows1254(metin) {
  const tablo = { "ğ": 0xf0, "Ğ": 0xd0, "ı": 0xfd, "İ": 0xdd, "ş": 0xfe, "Ş": 0xde, "ü": 0xfc, "Ü": 0xdc, "ö": 0xf6, "Ö": 0xd6, "ç": 0xe7, "Ç": 0xc7, "—": 0x97 };
  return Buffer.from(Array.from(metin, (h) => {
    if (h.charCodeAt(0) < 0x80) return h.charCodeAt(0);
    if (tablo[h] === undefined) throw new Error(`windows-1254 tablosunda yok: ${h}`);
    return tablo[h];
  }));
}

const PDF_SAHTE = Buffer.from("%PDF-1.4\n% sentetik test eki, gerçek PDF değil\n%%EOF\n", "latin1");

const dosyalar = {
  "efatura-ornek.xml": fatura({
    no: "ORN2026000000001",
    uuid: "1f0e2d3c-4b5a-4697-8877-665544332211",
    notlar: ["Yalnız ##YAZIYLA## Türk Lirası (sentetik örnek).", "Bu belge test amaçlı üretilmiştir; gerçek bir fatura değildir."],
    ekler: ek({ dosyaAdi: "ORN2026000000001.xslt", icerik: b64(faturaSablonu()) }),
  }),

  "earsiv-pdf-ve-adsiz-sablon.xml": fatura({
    no: "EAR2026000000042",
    uuid: "2a1b0c9d-8e7f-4a6b-9c5d-4e3f2a1b0c9d",
    profil: "EARSIVFATURA",
    notlar: ["İlk ek PDF, ikinci ek adı .xslt olmayan şablon: görüntüleyici şablonu içeriğinden tanımalı."],
    ekler:
      ek({ id: "PDF", dosyaAdi: "EAR2026000000042.pdf", mime: "application/pdf", icerik: b64(PDF_SAHTE) }) +
      ek({ id: "GORUNUM", dosyaAdi: "gorunum.dat", mime: "application/octet-stream", icerik: b64(faturaSablonu({ baslik: "e-ARŞİV FATURA" })) }),
  }),

  "sablonsuz-fatura.xml": fatura({
    no: "SBL2026000000007",
    uuid: "3c2b1a09-f8e7-4d6c-b5a4-938271605f4e",
    notlar: ["Bu faturada görünüm şablonu yok; görüntüleyici okunur ham XML göstermeli."],
  }),

  "guvenlik-testi.xml": fatura({
    no: "GVN2026000000666",
    uuid: "4d3c2b1a-0f9e-4d8c-a7b6-a5c4d3e2f1a0",
    notlar: ["Şablonda betik, olay özniteliği, javascript: bağlantısı ve dış kaynaklar var. Hiçbiri çalışmamalı, ağa istek gitmemeli."],
    ekler: ek({
      dosyaAdi: "kotu-niyetli.xslt",
      icerik: b64(
        faturaSablonu({
          baslik: "GÜVENLİK TESTİ",
          ekBas: `<script>document.title = 'BETIK-CALISTI'; parent.postMessage('betik-calisti', '*');</script>
        <link rel="stylesheet" href="${IZLEME_ADRESI}/dis-stil.css"/>
        <meta http-equiv="refresh" content="5;url=${IZLEME_ADRESI}/yonlendirme"/>`,
          ekGovde: `<div id="tuzak" onclick="document.title='TIKLAMA-CALISTI'" style="border:2px solid #b00;padding:6px;margin-bottom:12px">
          Tuzak alanı: betik ve olay öznitelikleri çalışmamalı.
          <a id="jsbag" href="javascript:document.title='JS-BAGLANTI'">javascript: bağlantısı</a>
          <img id="izleme" src="${IZLEME_ADRESI}/izleme.png" alt="dış görsel (yüklenmemeli)" width="1" height="1"/>
          <img src="x" onerror="document.title='ONERROR-CALISTI'" alt=""/>
        </div>`,
        }),
      ),
    }),
  }),

  "guvenlik-dis-belge.xml": fatura({
    no: "GVN2026000000667",
    uuid: "5e4d3c2b-1a0f-4e9d-8c7b-6a5f4e3d2c1b",
    notlar: ["Şablon document() ile dış adresten belge çekmeye çalışıyor; istek gitmemeli."],
    ekler: ek({
      dosyaAdi: "dis-belge.xslt",
      icerik: b64(
        faturaSablonu({ baslik: "DIŞ BELGE TESTİ", ekGovde: `<p id="disBelge">Dış belge: <xsl:value-of select="count(document('${IZLEME_ADRESI}/dis-belge.xml')/*)"/></p>` }),
      ),
    }),
  }),
};

for (const [ad, icerik] of Object.entries(dosyalar)) {
  writeFileSync(join(HEDEF, ad), icerik, "utf8");
}

// e-İrsaliye
writeFileSync(
  join(HEDEF, "eirsaliye-ornek.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<DespatchAdvice xmlns="urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>TR1.2.1</cbc:CustomizationID>
  <cbc:ProfileID>TEMELIRSALIYE</cbc:ProfileID>
  <cbc:ID>IRS2026000000015</cbc:ID>
  <cbc:UUID>6f5e4d3c-2b1a-4f0e-9d8c-7b6a5f4e3d2c</cbc:UUID>
  <cbc:IssueDate>2026-11-03</cbc:IssueDate>
  <cbc:DespatchAdviceTypeCode>SEVK</cbc:DespatchAdviceTypeCode>${ek({ dosyaAdi: "irsaliye.xslt", icerik: b64(IRSALIYE_SABLONU) })}
  <cac:DespatchSupplierParty><cac:Party><cac:PartyName><cbc:Name>ÖRNEK LOJİSTİK VE DEPOLAMA A.Ş.</cbc:Name></cac:PartyName></cac:Party></cac:DespatchSupplierParty>
  <cac:DeliveryCustomerParty><cac:Party><cac:PartyName><cbc:Name>DENEME GIDA İTHALAT İHRACAT LTD. ŞTİ.</cbc:Name></cac:PartyName></cac:Party></cac:DeliveryCustomerParty>
  <cac:Shipment>
    <cbc:ID>1</cbc:ID>
    <cac:ShipmentStage>
      <cac:TransportMeans><cac:RoadTransport><cbc:LicensePlateID>06 ÖRN 123</cbc:LicensePlateID></cac:RoadTransport></cac:TransportMeans>
      <cac:DriverPerson><cbc:FirstName>Şükrü</cbc:FirstName><cbc:FamilyName>Güneşoğlu</cbc:FamilyName><cbc:NationalityID>TR</cbc:NationalityID></cac:DriverPerson>
    </cac:ShipmentStage>
    <cac:Delivery><cac:Despatch><cbc:ActualDespatchDate>2026-11-03</cbc:ActualDespatchDate></cac:Despatch></cac:Delivery>
  </cac:Shipment>
  <cac:DespatchLine>
    <cbc:ID>1</cbc:ID>
    <cbc:DeliveredQuantity unitCode="KGM">250</cbc:DeliveredQuantity>
    <cac:Item><cbc:Name>Kuru incir (Aydın, 1. sınıf)</cbc:Name></cac:Item>
  </cac:DespatchLine>
  <cac:DespatchLine>
    <cbc:ID>2</cbc:ID>
    <cbc:DeliveredQuantity unitCode="C62">40</cbc:DeliveredQuantity>
    <cac:Item><cbc:Name>Ahşap palet</cbc:Name></cac:Item>
  </cac:DespatchLine>
</DespatchAdvice>
`,
  "utf8",
);

// windows-1254 kodlu fatura ve şablon
const sablon1254 = faturaSablonu({ baslik: "e-FATURA (windows-1254)" }).replace('encoding="UTF-8"?>', 'encoding="windows-1254"?>');
writeFileSync(
  join(HEDEF, "windows-1254-fatura.xml"),
  windows1254(
    fatura({
      no: "WIN2026000000003",
      uuid: "7a6b5c4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d",
      kodlama: "windows-1254",
      notlar: ["Dosya ve şablon windows-1254 kodlu: ğüşıöç ĞÜŞİÖÇ doğru görünmeli."],
      ekler: ek({ dosyaAdi: "win1254.xslt", icerik: b64(windows1254(sablon1254)) }),
    }),
  ),
);

console.log(`Örnekler yazıldı: ${HEDEF}`);
