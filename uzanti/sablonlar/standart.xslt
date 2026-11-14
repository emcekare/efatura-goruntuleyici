<?xml version="1.0" encoding="UTF-8"?>
<!--
  e-Fatura Görüntüleyici — standart görünüm şablonu (MIT).

  Görünüm şablonu (XSLT) gömülü olmayan UBL-TR belgeleri için kullanılır:
  e-Fatura / e-Arşiv Fatura (Invoice) ve e-İrsaliye (DespatchAdvice).
  Yerleşim GİB'in örnek fatura görünümüne benzetilmiştir ama GİB'in şablonu
  değildir; sıfırdan yazılmıştır. XSLT 1.0, betik yok, dış kaynak yok.

  Hesap yapmaz: bütün tutarlar belgede yazdığı gibi gösterilir.
-->
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:inv="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:da="urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  exclude-result-prefixes="inv da cac cbc">

  <xsl:output method="html" encoding="UTF-8" indent="no"/>
  <xsl:decimal-format name="tr" decimal-separator="," grouping-separator="."/>

  <!-- ============================================================ Yardımcılar -->

  <!-- Sayı: 1234.5 → 1.234,50 -->
  <xsl:template name="sayi">
    <xsl:param name="d"/>
    <xsl:param name="desen" select="'#.##0,00'"/>
    <xsl:if test="string($d) != '' and string(number($d)) != 'NaN'">
      <xsl:value-of select="format-number($d, $desen, 'tr')"/>
    </xsl:if>
  </xsl:template>

  <!-- Tutar + para birimi (TRY → TL) -->
  <xsl:template name="tutar">
    <xsl:param name="d"/>
    <xsl:if test="$d">
      <xsl:call-template name="sayi"><xsl:with-param name="d" select="$d"/></xsl:call-template>
      <xsl:text> </xsl:text>
      <xsl:choose>
        <xsl:when test="$d/@currencyID = 'TRY' or $d/@currencyID = 'TRL'">TL</xsl:when>
        <xsl:otherwise><xsl:value-of select="$d/@currencyID"/></xsl:otherwise>
      </xsl:choose>
    </xsl:if>
  </xsl:template>

  <!-- Tarih: 2026-11-02 → 02-11-2026 -->
  <xsl:template name="tarih">
    <xsl:param name="t"/>
    <xsl:choose>
      <xsl:when test="string-length($t) &gt;= 10 and substring($t, 5, 1) = '-'">
        <xsl:value-of select="concat(substring($t, 9, 2), '-', substring($t, 6, 2), '-', substring($t, 1, 4))"/>
      </xsl:when>
      <xsl:otherwise><xsl:value-of select="$t"/></xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- Saat: 14:05:00.0000000+03:00 → 14:05:00 -->
  <xsl:template name="saat">
    <xsl:param name="t"/>
    <xsl:value-of select="substring($t, 1, 8)"/>
  </xsl:template>

  <!-- Oran: 20 → %20 ; 0.1 çarpanı için yuzde=1 verilir -->
  <xsl:template name="oran">
    <xsl:param name="d"/>
    <xsl:param name="carpan" select="1"/>
    <xsl:if test="string($d) != '' and string(number($d)) != 'NaN'">
      <xsl:text>%</xsl:text>
      <xsl:value-of select="format-number($d * $carpan, '#.##0,##', 'tr')"/>
    </xsl:if>
  </xsl:template>

  <!-- UN/ECE birim kodları (UBL-TR'de sık kullanılanlar) -->
  <xsl:template name="birim">
    <xsl:param name="kod"/>
    <xsl:choose>
      <xsl:when test="$kod = 'C62' or $kod = 'NIU' or $kod = 'H87'">Adet</xsl:when>
      <xsl:when test="$kod = 'KGM'">Kg</xsl:when>
      <xsl:when test="$kod = 'GRM'">Gr</xsl:when>
      <xsl:when test="$kod = 'TNE'">Ton</xsl:when>
      <xsl:when test="$kod = 'LTR'">Lt</xsl:when>
      <xsl:when test="$kod = 'MLT'">Ml</xsl:when>
      <xsl:when test="$kod = 'MTR'">Metre</xsl:when>
      <xsl:when test="$kod = 'CMT'">Cm</xsl:when>
      <xsl:when test="$kod = 'KMT'">Km</xsl:when>
      <xsl:when test="$kod = 'MTK'">m²</xsl:when>
      <xsl:when test="$kod = 'MTQ'">m³</xsl:when>
      <xsl:when test="$kod = 'MIN'">Dakika</xsl:when>
      <xsl:when test="$kod = 'HUR'">Saat</xsl:when>
      <xsl:when test="$kod = 'DAY'">Gün</xsl:when>
      <xsl:when test="$kod = 'WEE'">Hafta</xsl:when>
      <xsl:when test="$kod = 'MON'">Ay</xsl:when>
      <xsl:when test="$kod = 'ANN'">Yıl</xsl:when>
      <xsl:when test="$kod = 'KWH'">kWh</xsl:when>
      <xsl:when test="$kod = 'MWH'">MWh</xsl:when>
      <xsl:when test="$kod = 'PA'">Paket</xsl:when>
      <xsl:when test="$kod = 'BX'">Kutu</xsl:when>
      <xsl:when test="$kod = 'SET'">Set</xsl:when>
      <xsl:when test="$kod = 'PR'">Çift</xsl:when>
      <xsl:when test="$kod = 'DZN'">Düzine</xsl:when>
      <xsl:otherwise><xsl:value-of select="$kod"/></xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- Vergi adı: bilinen GİB vergi kodları, yoksa belgedeki ad -->
  <xsl:template name="vergiAdi">
    <xsl:param name="v"/> <!-- cac:TaxSubtotal -->
    <xsl:variable name="kod" select="string($v/cac:TaxCategory/cac:TaxScheme/cbc:TaxTypeCode)"/>
    <xsl:variable name="ad" select="string($v/cac:TaxCategory/cac:TaxScheme/cbc:Name)"/>
    <xsl:choose>
      <xsl:when test="$kod = '0015'">KDV</xsl:when>
      <xsl:when test="$kod = '0003'">Gelir Vergisi Stopajı</xsl:when>
      <xsl:when test="$kod = '0071'">ÖTV (I) Sayılı Liste</xsl:when>
      <xsl:when test="$kod = '0073'">ÖTV (III) Sayılı Liste</xsl:when>
      <xsl:when test="$kod = '0074'">ÖTV (IV) Sayılı Liste</xsl:when>
      <xsl:when test="$kod = '0075'">ÖTV (III-A) Sayılı Liste</xsl:when>
      <xsl:when test="$kod = '0076'">ÖTV (III-B) Sayılı Liste</xsl:when>
      <xsl:when test="$kod = '0077'">ÖTV (III-C) Sayılı Liste</xsl:when>
      <xsl:when test="$kod = '1047'">Damga Vergisi</xsl:when>
      <xsl:when test="$kod = '1048'">5035 SK Damga Vergisi</xsl:when>
      <xsl:when test="$kod = '4080'">Özel İletişim Vergisi</xsl:when>
      <xsl:when test="$kod = '4081'">5035 SK Özel İletişim Vergisi</xsl:when>
      <xsl:when test="$kod = '9040'">Mera Fonu</xsl:when>
      <xsl:when test="$kod = '8001'">Borsa Tescil Ücreti</xsl:when>
      <xsl:when test="$ad != ''"><xsl:value-of select="$ad"/></xsl:when>
      <xsl:when test="$v/cac:TaxCategory/cac:TaxScheme/cbc:ID = 'VAT'">KDV</xsl:when>
      <xsl:when test="$kod != ''">Vergi (<xsl:value-of select="$kod"/>)</xsl:when>
      <xsl:otherwise>Vergi</xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- Vergi oranı: UBL-TR'de TaxSubtotal/Percent, EN16931'de TaxCategory/Percent -->
  <xsl:template name="vergiOrani">
    <xsl:param name="v"/>
    <xsl:call-template name="oran">
      <xsl:with-param name="d" select="($v/cbc:Percent | $v/cac:TaxCategory/cbc:Percent)[1]"/>
    </xsl:call-template>
  </xsl:template>

  <!-- Taraf kutusu (satıcı / alıcı / sevk eden / teslim alan) -->
  <xsl:template name="taraf">
    <xsl:param name="p"/> <!-- cac:Party -->
    <xsl:variable name="a" select="$p/cac:PostalAddress"/>
    <div class="taraf-adi">
      <xsl:choose>
        <xsl:when test="normalize-space($p/cac:PartyName/cbc:Name) != ''">
          <xsl:value-of select="$p/cac:PartyName/cbc:Name"/>
        </xsl:when>
        <xsl:when test="$p/cac:Person">
          <xsl:value-of select="normalize-space(concat($p/cac:Person/cbc:Title, ' ', $p/cac:Person/cbc:FirstName, ' ', $p/cac:Person/cbc:MiddleName, ' ', $p/cac:Person/cbc:FamilyName))"/>
        </xsl:when>
        <xsl:otherwise><xsl:value-of select="$p/cac:PartyLegalEntity/cbc:RegistrationName"/></xsl:otherwise>
      </xsl:choose>
    </div>
    <xsl:if test="$a">
      <div>
        <xsl:value-of select="$a/cbc:StreetName"/>
        <xsl:if test="normalize-space($a/cbc:BuildingName) != ''"><xsl:text> </xsl:text><xsl:value-of select="$a/cbc:BuildingName"/></xsl:if>
        <xsl:if test="normalize-space($a/cbc:BuildingNumber) != ''"><xsl:text> No: </xsl:text><xsl:value-of select="$a/cbc:BuildingNumber"/></xsl:if>
        <xsl:if test="normalize-space($a/cbc:Room) != ''"><xsl:text> / </xsl:text><xsl:value-of select="$a/cbc:Room"/></xsl:if>
      </div>
      <div>
        <xsl:if test="normalize-space($a/cbc:PostalZone) != ''"><xsl:value-of select="$a/cbc:PostalZone"/><xsl:text> </xsl:text></xsl:if>
        <xsl:value-of select="$a/cbc:CitySubdivisionName"/>
        <xsl:if test="normalize-space($a/cbc:CitySubdivisionName) != '' and normalize-space($a/cbc:CityName) != ''"> / </xsl:if>
        <xsl:value-of select="$a/cbc:CityName"/>
        <xsl:if test="normalize-space($a/cac:Country/cbc:Name) != ''"><xsl:text> · </xsl:text><xsl:value-of select="$a/cac:Country/cbc:Name"/></xsl:if>
      </div>
    </xsl:if>
    <xsl:if test="normalize-space($p/cac:Contact/cbc:Telephone) != ''"><div>Tel: <xsl:value-of select="$p/cac:Contact/cbc:Telephone"/></div></xsl:if>
    <xsl:if test="normalize-space($p/cac:Contact/cbc:Telefax) != ''"><div>Faks: <xsl:value-of select="$p/cac:Contact/cbc:Telefax"/></div></xsl:if>
    <xsl:if test="normalize-space($p/cac:Contact/cbc:ElectronicMail) != ''"><div>E-Posta: <xsl:value-of select="$p/cac:Contact/cbc:ElectronicMail"/></div></xsl:if>
    <xsl:if test="normalize-space($p/cbc:WebsiteURI) != ''"><div>Web: <xsl:value-of select="$p/cbc:WebsiteURI"/></div></xsl:if>
    <xsl:if test="normalize-space($p/cac:PartyTaxScheme/cac:TaxScheme/cbc:Name) != ''">
      <div>Vergi Dairesi: <xsl:value-of select="$p/cac:PartyTaxScheme/cac:TaxScheme/cbc:Name"/></div>
    </xsl:if>
    <xsl:for-each select="$p/cac:PartyIdentification/cbc:ID[normalize-space(.) != '']">
      <div>
        <xsl:choose>
          <xsl:when test="@schemeID = 'MERSISNO'">Mersis No</xsl:when>
          <xsl:when test="@schemeID = 'TICARETSICILNO'">Ticaret Sicil No</xsl:when>
          <xsl:when test="@schemeID = 'HIZMETNO'">Hizmet No</xsl:when>
          <xsl:when test="@schemeID = 'MUSTERINO'">Müşteri No</xsl:when>
          <xsl:when test="@schemeID = 'TESISATNO'">Tesisat No</xsl:when>
          <xsl:when test="@schemeID = 'ABONENO'">Abone No</xsl:when>
          <xsl:when test="@schemeID != ''"><xsl:value-of select="@schemeID"/></xsl:when>
          <xsl:otherwise>Kimlik</xsl:otherwise>
        </xsl:choose>
        <xsl:text>: </xsl:text>
        <xsl:value-of select="."/>
      </div>
    </xsl:for-each>
    <!-- EN16931 / Peppol: vergi numarası PartyTaxScheme/CompanyID'de -->
    <xsl:if test="not($p/cac:PartyIdentification/cbc:ID) and normalize-space($p/cac:PartyTaxScheme/cbc:CompanyID) != ''">
      <div>Vergi No: <xsl:value-of select="$p/cac:PartyTaxScheme/cbc:CompanyID"/></div>
    </xsl:if>
  </xsl:template>

  <!-- Bilgi tablosu satırı (değer boşsa yazılmaz) -->
  <xsl:template name="bilgi">
    <xsl:param name="etiket"/>
    <xsl:param name="deger"/>
    <xsl:if test="normalize-space($deger) != ''">
      <tr><th><xsl:value-of select="$etiket"/></th><td><xsl:value-of select="$deger"/></td></tr>
    </xsl:if>
  </xsl:template>

  <xsl:template name="stil">
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #fff; color: #111; font: 11px/1.4 Tahoma, Verdana, "Segoe UI", sans-serif; }
      .sayfa { max-width: 210mm; margin: 0 auto; padding: 10mm 12mm; }
      .ust { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 24px; align-items: start; }
      .taraf { border-top: 1px solid #999; border-bottom: 1px solid #999; padding: 6px 0; }
      .taraf-adi { font-weight: bold; font-size: 12px; margin-bottom: 2px; }
      .etiket { font-weight: bold; font-size: 10px; color: #444; letter-spacing: 1px; margin-bottom: 2px; }
      .baslik { text-align: center; }
      .baslik h1 { font-size: 22px; letter-spacing: 3px; margin: 4px 0 8px; }
      table { border-collapse: collapse; width: 100%; }
      .bilgi th, .bilgi td { border: 1px solid #999; padding: 2px 6px; text-align: left; vertical-align: top; }
      .bilgi th { width: 42%; white-space: nowrap; }
      .ettn { margin: 10px 0; font-weight: bold; }
      .kalemler { margin-top: 6px; }
      .kalemler th { background: #e4e4e4; border: 1px solid #777; padding: 3px; font-size: 10px; }
      .kalemler td { border: 1px solid #999; padding: 3px 4px; vertical-align: top; }
      .kalemler .aciklama { color: #555; font-size: 10px; }
      .sag { text-align: right; white-space: nowrap; }
      .orta { text-align: center; }
      .diger { white-space: normal; font-size: 10px; min-width: 90px; }
      .kalemler td:nth-child(2) { min-width: 140px; }
      .toplamlar { width: 55%; margin: 8px 0 0 auto; }
      .toplamlar th, .toplamlar td { border: 1px solid #999; padding: 3px 6px; }
      .toplamlar th { text-align: right; font-weight: normal; }
      .toplamlar .odenecek th, .toplamlar .odenecek td { font-weight: bold; background: #efefef; }
      .matrah { color: #555; font-size: 10px; }
      .kutu { border: 1px solid #999; padding: 6px 8px; margin-top: 10px; }
      .kutu p { margin: 2px 0; }
      .dipnot { margin-top: 14px; color: #777; font-size: 9px; text-align: center; }
      @page { size: A4; margin: 0; }
      @media print { .sayfa { padding: 8mm 10mm; } }
    </style>
  </xsl:template>

  <xsl:template name="dipnot">
    <div class="dipnot">Bu görünüm e-Fatura Görüntüleyici'nin standart şablonuyla oluşturulmuştur; belgeyi düzenleyenin kendi görünüm şablonu değildir.</div>
  </xsl:template>

  <!-- ============================================================ Fatura -->

  <xsl:template match="/inv:Invoice">
    <xsl:variable name="earsiv" select="cbc:ProfileID = 'EARSIVFATURA'"/>
    <html lang="tr">
      <head>
        <meta charset="UTF-8"/>
        <title><xsl:value-of select="cbc:ID"/></title>
        <xsl:call-template name="stil"/>
      </head>
      <body>
        <div class="sayfa">
          <div class="ust">
            <div class="taraf">
              <xsl:call-template name="taraf"><xsl:with-param name="p" select="cac:AccountingSupplierParty/cac:Party"/></xsl:call-template>
            </div>
            <div class="baslik">
              <h1>
                <xsl:choose>
                  <xsl:when test="$earsiv">e-ARŞİV FATURA</xsl:when>
                  <xsl:otherwise>e-FATURA</xsl:otherwise>
                </xsl:choose>
              </h1>
            </div>
            <div class="taraf">
              <div class="etiket">SAYIN</div>
              <xsl:call-template name="taraf"><xsl:with-param name="p" select="cac:AccountingCustomerParty/cac:Party"/></xsl:call-template>
            </div>
            <table class="bilgi">
              <xsl:call-template name="bilgi"><xsl:with-param name="etiket" select="'Özelleştirme No'"/><xsl:with-param name="deger" select="cbc:CustomizationID"/></xsl:call-template>
              <xsl:call-template name="bilgi"><xsl:with-param name="etiket" select="'Senaryo'"/><xsl:with-param name="deger" select="cbc:ProfileID"/></xsl:call-template>
              <xsl:call-template name="bilgi"><xsl:with-param name="etiket" select="'Fatura Tipi'"/><xsl:with-param name="deger" select="cbc:InvoiceTypeCode"/></xsl:call-template>
              <xsl:call-template name="bilgi"><xsl:with-param name="etiket" select="'Fatura No'"/><xsl:with-param name="deger" select="cbc:ID"/></xsl:call-template>
              <tr><th>Fatura Tarihi</th><td>
                <xsl:call-template name="tarih"><xsl:with-param name="t" select="cbc:IssueDate"/></xsl:call-template>
                <xsl:if test="cbc:IssueTime"><xsl:text> </xsl:text><xsl:call-template name="saat"><xsl:with-param name="t" select="cbc:IssueTime"/></xsl:call-template></xsl:if>
              </td></tr>
              <xsl:for-each select="cac:DespatchDocumentReference">
                <tr><th>İrsaliye No / Tarihi</th><td>
                  <xsl:value-of select="cbc:ID"/>
                  <xsl:if test="cbc:IssueDate"> · <xsl:call-template name="tarih"><xsl:with-param name="t" select="cbc:IssueDate"/></xsl:call-template></xsl:if>
                </td></tr>
              </xsl:for-each>
              <xsl:for-each select="cac:OrderReference">
                <tr><th>Sipariş No / Tarihi</th><td>
                  <xsl:value-of select="cbc:ID"/>
                  <xsl:if test="cbc:IssueDate"> · <xsl:call-template name="tarih"><xsl:with-param name="t" select="cbc:IssueDate"/></xsl:call-template></xsl:if>
                </td></tr>
              </xsl:for-each>
              <xsl:if test="cbc:DueDate">
                <tr><th>Son Ödeme Tarihi</th><td><xsl:call-template name="tarih"><xsl:with-param name="t" select="cbc:DueDate"/></xsl:call-template></td></tr>
              </xsl:if>
              <xsl:if test="cbc:DocumentCurrencyCode != 'TRY' and cbc:DocumentCurrencyCode != ''">
                <tr><th>Para Birimi</th><td><xsl:value-of select="cbc:DocumentCurrencyCode"/></td></tr>
              </xsl:if>
              <xsl:for-each select="cac:PricingExchangeRate[cbc:CalculationRate]">
                <tr><th>Döviz Kuru</th><td>
                  <xsl:text>1 </xsl:text><xsl:value-of select="cbc:SourceCurrencyCode"/><xsl:text> = </xsl:text>
                  <xsl:call-template name="sayi"><xsl:with-param name="d" select="cbc:CalculationRate"/><xsl:with-param name="desen" select="'#.##0,00####'"/></xsl:call-template>
                  <xsl:text> </xsl:text>
                  <xsl:choose>
                    <xsl:when test="cbc:TargetCurrencyCode = 'TRY'">TL</xsl:when>
                    <xsl:otherwise><xsl:value-of select="cbc:TargetCurrencyCode"/></xsl:otherwise>
                  </xsl:choose>
                </td></tr>
              </xsl:for-each>
            </table>
          </div>

          <div class="ettn">ETTN: <xsl:value-of select="cbc:UUID"/></div>

          <table class="kalemler">
            <tr>
              <th>Sıra</th>
              <th>Mal / Hizmet</th>
              <th>Miktar</th>
              <th>Birim Fiyat</th>
              <th>İskonto Oranı</th>
              <th>İskonto Tutarı</th>
              <th>KDV Oranı</th>
              <th>KDV Tutarı</th>
              <th>Diğer Vergiler</th>
              <th>Mal Hizmet Tutarı</th>
            </tr>
            <xsl:for-each select="cac:InvoiceLine">
              <xsl:variable name="kdv" select="cac:TaxTotal/cac:TaxSubtotal[cac:TaxCategory/cac:TaxScheme/cbc:TaxTypeCode = '0015' or (not(cac:TaxCategory/cac:TaxScheme/cbc:TaxTypeCode) and cac:TaxCategory/cac:TaxScheme/cbc:ID = 'VAT')][1]"/>
              <xsl:variable name="iskonto" select="cac:AllowanceCharge[cbc:ChargeIndicator = 'false']"/>
              <tr>
                <td class="orta"><xsl:value-of select="cbc:ID"/></td>
                <td>
                  <xsl:value-of select="cac:Item/cbc:Name"/>
                  <xsl:if test="normalize-space(cac:Item/cbc:Description) != ''">
                    <div class="aciklama"><xsl:value-of select="cac:Item/cbc:Description"/></div>
                  </xsl:if>
                  <xsl:for-each select="cbc:Note[normalize-space(.) != '']">
                    <div class="aciklama"><xsl:value-of select="."/></div>
                  </xsl:for-each>
                </td>
                <td class="sag">
                  <xsl:call-template name="sayi"><xsl:with-param name="d" select="cbc:InvoicedQuantity"/><xsl:with-param name="desen" select="'#.##0,####'"/></xsl:call-template>
                  <xsl:text> </xsl:text>
                  <xsl:call-template name="birim"><xsl:with-param name="kod" select="cbc:InvoicedQuantity/@unitCode"/></xsl:call-template>
                </td>
                <td class="sag"><xsl:call-template name="tutar"><xsl:with-param name="d" select="cac:Price/cbc:PriceAmount"/></xsl:call-template></td>
                <td class="sag">
                  <xsl:for-each select="$iskonto[cbc:MultiplierFactorNumeric]">
                    <xsl:call-template name="oran"><xsl:with-param name="d" select="cbc:MultiplierFactorNumeric"/><xsl:with-param name="carpan" select="100"/></xsl:call-template>
                    <xsl:if test="position() != last()"><br/></xsl:if>
                  </xsl:for-each>
                </td>
                <td class="sag">
                  <xsl:for-each select="$iskonto">
                    <xsl:call-template name="tutar"><xsl:with-param name="d" select="cbc:Amount"/></xsl:call-template>
                    <xsl:if test="position() != last()"><br/></xsl:if>
                  </xsl:for-each>
                </td>
                <td class="sag">
                  <xsl:choose>
                    <xsl:when test="$kdv"><xsl:call-template name="vergiOrani"><xsl:with-param name="v" select="$kdv"/></xsl:call-template></xsl:when>
                    <xsl:otherwise><xsl:call-template name="oran"><xsl:with-param name="d" select="cac:Item/cac:ClassifiedTaxCategory/cbc:Percent"/></xsl:call-template></xsl:otherwise>
                  </xsl:choose>
                </td>
                <td class="sag"><xsl:call-template name="tutar"><xsl:with-param name="d" select="$kdv/cbc:TaxAmount"/></xsl:call-template></td>
                <td class="sag diger">
                  <xsl:for-each select="cac:TaxTotal/cac:TaxSubtotal[count(. | $kdv) != count($kdv)]">
                    <div>
                      <xsl:call-template name="vergiAdi"><xsl:with-param name="v" select="."/></xsl:call-template>
                      <xsl:text> </xsl:text>
                      <xsl:call-template name="vergiOrani"><xsl:with-param name="v" select="."/></xsl:call-template>
                      <xsl:text>: </xsl:text>
                      <xsl:call-template name="tutar"><xsl:with-param name="d" select="cbc:TaxAmount"/></xsl:call-template>
                    </div>
                  </xsl:for-each>
                  <xsl:for-each select="cac:WithholdingTaxTotal/cac:TaxSubtotal">
                    <div>
                      <xsl:text>KDV Tevkifatı</xsl:text>
                      <xsl:if test="cac:TaxCategory/cac:TaxScheme/cbc:TaxTypeCode"> (<xsl:value-of select="cac:TaxCategory/cac:TaxScheme/cbc:TaxTypeCode"/>)</xsl:if>
                      <xsl:text> </xsl:text>
                      <xsl:call-template name="vergiOrani"><xsl:with-param name="v" select="."/></xsl:call-template>
                      <xsl:text>: </xsl:text>
                      <xsl:call-template name="tutar"><xsl:with-param name="d" select="cbc:TaxAmount"/></xsl:call-template>
                    </div>
                  </xsl:for-each>
                </td>
                <td class="sag"><xsl:call-template name="tutar"><xsl:with-param name="d" select="cbc:LineExtensionAmount"/></xsl:call-template></td>
              </tr>
            </xsl:for-each>
          </table>

          <xsl:variable name="t" select="cac:LegalMonetaryTotal"/>
          <table class="toplamlar">
            <tr><th>Mal Hizmet Toplam Tutarı</th><td class="sag"><xsl:call-template name="tutar"><xsl:with-param name="d" select="$t/cbc:LineExtensionAmount"/></xsl:call-template></td></tr>
            <xsl:if test="$t/cbc:AllowanceTotalAmount">
              <tr><th>Toplam İskonto</th><td class="sag"><xsl:call-template name="tutar"><xsl:with-param name="d" select="$t/cbc:AllowanceTotalAmount"/></xsl:call-template></td></tr>
            </xsl:if>
            <xsl:if test="$t/cbc:ChargeTotalAmount and number($t/cbc:ChargeTotalAmount) != 0">
              <tr><th>Toplam Artırım</th><td class="sag"><xsl:call-template name="tutar"><xsl:with-param name="d" select="$t/cbc:ChargeTotalAmount"/></xsl:call-template></td></tr>
            </xsl:if>
            <xsl:for-each select="cac:TaxTotal/cac:TaxSubtotal">
              <tr>
                <th>
                  <xsl:text>Hesaplanan </xsl:text>
                  <xsl:call-template name="vergiAdi"><xsl:with-param name="v" select="."/></xsl:call-template>
                  <xsl:text> (</xsl:text>
                  <xsl:call-template name="vergiOrani"><xsl:with-param name="v" select="."/></xsl:call-template>
                  <xsl:text>)</xsl:text>
                  <xsl:if test="cbc:TaxableAmount">
                    <div class="matrah">Matrah: <xsl:call-template name="tutar"><xsl:with-param name="d" select="cbc:TaxableAmount"/></xsl:call-template></div>
                  </xsl:if>
                </th>
                <td class="sag"><xsl:call-template name="tutar"><xsl:with-param name="d" select="cbc:TaxAmount"/></xsl:call-template></td>
              </tr>
            </xsl:for-each>
            <xsl:for-each select="cac:WithholdingTaxTotal/cac:TaxSubtotal">
              <tr>
                <th>
                  <xsl:text>KDV Tevkifatı (</xsl:text>
                  <xsl:call-template name="vergiOrani"><xsl:with-param name="v" select="."/></xsl:call-template>
                  <xsl:text>)</xsl:text>
                  <xsl:if test="normalize-space(cac:TaxCategory/cac:TaxScheme/cbc:Name) != ''">
                    <div class="matrah"><xsl:value-of select="cac:TaxCategory/cac:TaxScheme/cbc:TaxTypeCode"/> · <xsl:value-of select="cac:TaxCategory/cac:TaxScheme/cbc:Name"/></div>
                  </xsl:if>
                </th>
                <td class="sag"><xsl:call-template name="tutar"><xsl:with-param name="d" select="cbc:TaxAmount"/></xsl:call-template></td>
              </tr>
            </xsl:for-each>
            <tr><th>Vergiler Dahil Toplam Tutar</th><td class="sag"><xsl:call-template name="tutar"><xsl:with-param name="d" select="$t/cbc:TaxInclusiveAmount"/></xsl:call-template></td></tr>
            <tr class="odenecek"><th>Ödenecek Tutar</th><td class="sag"><xsl:call-template name="tutar"><xsl:with-param name="d" select="$t/cbc:PayableAmount"/></xsl:call-template></td></tr>
          </table>

          <xsl:if test="cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cbc:TaxExemptionReason or cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cbc:TaxExemptionReasonCode">
            <div class="kutu">
              <b>Vergi İstisna / Muafiyet Sebebi</b>
              <xsl:for-each select="cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory[cbc:TaxExemptionReason or cbc:TaxExemptionReasonCode]">
                <p><xsl:value-of select="cbc:TaxExemptionReasonCode"/><xsl:if test="cbc:TaxExemptionReasonCode and cbc:TaxExemptionReason"> · </xsl:if><xsl:value-of select="cbc:TaxExemptionReason"/></p>
              </xsl:for-each>
            </div>
          </xsl:if>

          <xsl:if test="cac:PaymentMeans or cac:PaymentTerms">
            <div class="kutu">
              <b>Ödeme Bilgileri</b>
              <xsl:for-each select="cac:PaymentMeans">
                <xsl:if test="cbc:PaymentDueDate"><p>Vade: <xsl:call-template name="tarih"><xsl:with-param name="t" select="cbc:PaymentDueDate"/></xsl:call-template></p></xsl:if>
                <xsl:for-each select="cac:PayeeFinancialAccount">
                  <p>
                    <xsl:if test="normalize-space(cac:FinancialInstitutionBranch/cac:FinancialInstitution/cbc:Name | cac:FinancialInstitutionBranch/cbc:Name) != ''">
                      <xsl:value-of select="(cac:FinancialInstitutionBranch/cac:FinancialInstitution/cbc:Name | cac:FinancialInstitutionBranch/cbc:Name)[1]"/>
                      <xsl:text> · </xsl:text>
                    </xsl:if>
                    <xsl:text>IBAN / Hesap: </xsl:text><xsl:value-of select="cbc:ID"/>
                    <xsl:if test="cbc:CurrencyCode"> (<xsl:value-of select="cbc:CurrencyCode"/>)</xsl:if>
                  </p>
                </xsl:for-each>
                <xsl:if test="normalize-space(cbc:InstructionNote) != ''"><p><xsl:value-of select="cbc:InstructionNote"/></p></xsl:if>
                <xsl:if test="normalize-space(cbc:PaymentChannelCode) != ''"><p>Ödeme Kanalı: <xsl:value-of select="cbc:PaymentChannelCode"/></p></xsl:if>
              </xsl:for-each>
              <xsl:for-each select="cac:PaymentTerms[normalize-space(cbc:Note) != '']"><p><xsl:value-of select="cbc:Note"/></p></xsl:for-each>
            </div>
          </xsl:if>

          <xsl:if test="cbc:Note[normalize-space(.) != '']">
            <div class="kutu">
              <b>Notlar</b>
              <xsl:for-each select="cbc:Note[normalize-space(.) != '']"><p><xsl:value-of select="."/></p></xsl:for-each>
            </div>
          </xsl:if>

          <xsl:call-template name="dipnot"/>
        </div>
      </body>
    </html>
  </xsl:template>

  <!-- ============================================================ İrsaliye -->

  <xsl:template match="/da:DespatchAdvice">
    <xsl:variable name="sevk" select="cac:Shipment"/>
    <html lang="tr">
      <head>
        <meta charset="UTF-8"/>
        <title><xsl:value-of select="cbc:ID"/></title>
        <xsl:call-template name="stil"/>
      </head>
      <body>
        <div class="sayfa">
          <div class="ust">
            <div class="taraf">
              <xsl:call-template name="taraf"><xsl:with-param name="p" select="cac:DespatchSupplierParty/cac:Party"/></xsl:call-template>
            </div>
            <div class="baslik"><h1>e-İRSALİYE</h1></div>
            <div class="taraf">
              <div class="etiket">SAYIN</div>
              <xsl:call-template name="taraf"><xsl:with-param name="p" select="cac:DeliveryCustomerParty/cac:Party"/></xsl:call-template>
            </div>
            <table class="bilgi">
              <xsl:call-template name="bilgi"><xsl:with-param name="etiket" select="'Özelleştirme No'"/><xsl:with-param name="deger" select="cbc:CustomizationID"/></xsl:call-template>
              <xsl:call-template name="bilgi"><xsl:with-param name="etiket" select="'Senaryo'"/><xsl:with-param name="deger" select="cbc:ProfileID"/></xsl:call-template>
              <xsl:call-template name="bilgi"><xsl:with-param name="etiket" select="'İrsaliye Tipi'"/><xsl:with-param name="deger" select="cbc:DespatchAdviceTypeCode"/></xsl:call-template>
              <xsl:call-template name="bilgi"><xsl:with-param name="etiket" select="'İrsaliye No'"/><xsl:with-param name="deger" select="cbc:ID"/></xsl:call-template>
              <tr><th>Düzenleme Tarihi</th><td>
                <xsl:call-template name="tarih"><xsl:with-param name="t" select="cbc:IssueDate"/></xsl:call-template>
                <xsl:if test="cbc:IssueTime"><xsl:text> </xsl:text><xsl:call-template name="saat"><xsl:with-param name="t" select="cbc:IssueTime"/></xsl:call-template></xsl:if>
              </td></tr>
              <xsl:if test="$sevk/cac:Delivery/cac:Despatch/cbc:ActualDespatchDate">
                <tr><th>Fiili Sevk Tarihi</th><td>
                  <xsl:call-template name="tarih"><xsl:with-param name="t" select="$sevk/cac:Delivery/cac:Despatch/cbc:ActualDespatchDate"/></xsl:call-template>
                  <xsl:if test="$sevk/cac:Delivery/cac:Despatch/cbc:ActualDespatchTime"><xsl:text> </xsl:text><xsl:call-template name="saat"><xsl:with-param name="t" select="$sevk/cac:Delivery/cac:Despatch/cbc:ActualDespatchTime"/></xsl:call-template></xsl:if>
                </td></tr>
              </xsl:if>
              <xsl:for-each select="cac:OrderReference">
                <tr><th>Sipariş No / Tarihi</th><td>
                  <xsl:value-of select="cbc:ID"/>
                  <xsl:if test="cbc:IssueDate"> · <xsl:call-template name="tarih"><xsl:with-param name="t" select="cbc:IssueDate"/></xsl:call-template></xsl:if>
                </td></tr>
              </xsl:for-each>
            </table>
          </div>

          <div class="ettn">ETTN: <xsl:value-of select="cbc:UUID"/></div>

          <div class="kutu">
            <b>Taşıma Bilgileri</b>
            <xsl:for-each select="$sevk/cac:ShipmentStage/cac:TransportMeans/cac:RoadTransport/cbc:LicensePlateID[normalize-space(.) != '']">
              <p>Araç Plakası: <xsl:value-of select="."/></p>
            </xsl:for-each>
            <xsl:for-each select="$sevk/cac:TransportHandlingUnit/cac:TransportEquipment/cbc:ID[normalize-space(.) != '']">
              <p>Dorse Plakası: <xsl:value-of select="."/></p>
            </xsl:for-each>
            <xsl:for-each select="$sevk/cac:ShipmentStage/cac:DriverPerson">
              <p>
                <xsl:text>Şoför: </xsl:text>
                <xsl:value-of select="normalize-space(concat(cbc:FirstName, ' ', cbc:FamilyName))"/>
                <xsl:if test="normalize-space(cbc:NationalityID) != ''"> · TCKN: <xsl:value-of select="cbc:NationalityID"/></xsl:if>
              </p>
            </xsl:for-each>
            <xsl:for-each select="$sevk/cac:Delivery/cac:CarrierParty">
              <p>Taşıyıcı: <xsl:value-of select="(cac:PartyName/cbc:Name | cac:PartyLegalEntity/cbc:RegistrationName)[1]"/>
                <xsl:for-each select="cac:PartyIdentification/cbc:ID"> · <xsl:value-of select="@schemeID"/>: <xsl:value-of select="."/></xsl:for-each>
              </p>
            </xsl:for-each>
            <xsl:for-each select="$sevk/cac:Delivery/cac:DeliveryAddress">
              <p>Teslimat Adresi:
                <xsl:value-of select="normalize-space(concat(cbc:StreetName, ' ', cbc:BuildingNumber, ' ', cbc:CitySubdivisionName, ' / ', cbc:CityName))"/>
              </p>
            </xsl:for-each>
          </div>

          <table class="kalemler">
            <tr>
              <th>Sıra</th>
              <th>Mal Kodu</th>
              <th>Mal / Hizmet</th>
              <th>Miktar</th>
              <th>Birim Fiyat</th>
              <th>Tutar</th>
            </tr>
            <xsl:for-each select="cac:DespatchLine">
              <tr>
                <td class="orta"><xsl:value-of select="cbc:ID"/></td>
                <td><xsl:value-of select="(cac:Item/cac:SellersItemIdentification/cbc:ID | cac:Item/cac:BuyersItemIdentification/cbc:ID)[1]"/></td>
                <td>
                  <xsl:value-of select="cac:Item/cbc:Name"/>
                  <xsl:if test="normalize-space(cac:Item/cbc:Description) != ''"><div class="aciklama"><xsl:value-of select="cac:Item/cbc:Description"/></div></xsl:if>
                  <xsl:for-each select="cbc:Note[normalize-space(.) != '']"><div class="aciklama"><xsl:value-of select="."/></div></xsl:for-each>
                </td>
                <td class="sag">
                  <xsl:call-template name="sayi"><xsl:with-param name="d" select="cbc:DeliveredQuantity"/><xsl:with-param name="desen" select="'#.##0,####'"/></xsl:call-template>
                  <xsl:text> </xsl:text>
                  <xsl:call-template name="birim"><xsl:with-param name="kod" select="cbc:DeliveredQuantity/@unitCode"/></xsl:call-template>
                </td>
                <td class="sag"><xsl:call-template name="tutar"><xsl:with-param name="d" select="cac:Shipment/cac:GoodsItem/cac:InvoiceLine/cac:Price/cbc:PriceAmount"/></xsl:call-template></td>
                <td class="sag"><xsl:call-template name="tutar"><xsl:with-param name="d" select="cac:Shipment/cac:GoodsItem/cac:InvoiceLine/cbc:LineExtensionAmount"/></xsl:call-template></td>
              </tr>
            </xsl:for-each>
          </table>

          <xsl:if test="cbc:Note[normalize-space(.) != '']">
            <div class="kutu">
              <b>Notlar</b>
              <xsl:for-each select="cbc:Note[normalize-space(.) != '']"><p><xsl:value-of select="."/></p></xsl:for-each>
            </div>
          </xsl:if>

          <xsl:call-template name="dipnot"/>
        </div>
      </body>
    </html>
  </xsl:template>

  <!-- Tanınmayan kök: boş çıktı (görüntüleyici ham XML'e döner) -->
  <xsl:template match="/*" priority="-1"/>
</xsl:stylesheet>
