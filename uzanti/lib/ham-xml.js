/**
 * Şablonu olmayan ya da şablonu uygulanamayan belgeler için okunur ham XML.
 * Gömülü ekler (base64) çok uzun olduğundan kısaltılır.
 */

const EK_KISALTMA_SINIRI = 200;

/** XML düğümünü girintili metne çevirir. */
function dugumYaz(dugum, girinti, satirlar) {
  const bosluk = "  ".repeat(girinti);
  switch (dugum.nodeType) {
    case 1: {
      // Eleman
      const oznitelikler = Array.from(dugum.attributes)
        .map((oz) => ` ${oz.name}="${oz.value}"`)
        .join("");
      const cocuklar = Array.from(dugum.childNodes).filter(
        (c) => !(c.nodeType === 3 && !c.nodeValue.trim()),
      );
      if (cocuklar.length === 0) {
        satirlar.push(`${bosluk}<${dugum.nodeName}${oznitelikler}/>`);
      } else if (cocuklar.length === 1 && cocuklar[0].nodeType === 3) {
        let metin = cocuklar[0].nodeValue.trim();
        if (dugum.localName === "EmbeddedDocumentBinaryObject" && metin.length > EK_KISALTMA_SINIRI) {
          metin = `${metin.slice(0, 60)}… [${metin.length.toLocaleString("tr-TR")} karakter base64]`;
        }
        satirlar.push(`${bosluk}<${dugum.nodeName}${oznitelikler}>${metin}</${dugum.nodeName}>`);
      } else {
        satirlar.push(`${bosluk}<${dugum.nodeName}${oznitelikler}>`);
        for (const c of cocuklar) dugumYaz(c, girinti + 1, satirlar);
        satirlar.push(`${bosluk}</${dugum.nodeName}>`);
      }
      break;
    }
    case 3: // Metin
      satirlar.push(bosluk + dugum.nodeValue.trim());
      break;
    case 4: // CDATA
      satirlar.push(`${bosluk}<![CDATA[${dugum.nodeValue}]]>`);
      break;
    case 8: // Yorum
      satirlar.push(`${bosluk}<!--${dugum.nodeValue}-->`);
      break;
    default:
      break;
  }
}

/**
 * @param {Document | null} belge ayrıştırılmış XML (bozuksa null)
 * @param {string} hamMetin belge ayrıştırılamadıysa olduğu gibi gösterilir
 * @returns {string}
 */
export function okunurXml(belge, hamMetin) {
  if (!belge?.documentElement) return hamMetin;
  const satirlar = [];
  dugumYaz(belge.documentElement, 0, satirlar);
  return satirlar.join("\n");
}
