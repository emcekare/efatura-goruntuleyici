/**
 * Görünüm şablonu gömülü olmayan belgeler için uzantıyla gelen standart şablon
 * (`sablonlar/standart.xslt`). Uzantının kendi dosyasıdır; ağdan yüklenmez.
 */

import { api } from "./aktarim.js";

/** Standart şablonun gösterebildiği belge türleri. */
export const STANDART_TURLER = ["Invoice", "DespatchAdvice"];

let onbellek = null;

/** @returns {Promise<string>} */
export async function standartSablonAl() {
  onbellek ??= fetch(api.runtime.getURL("sablonlar/standart.xslt"))
    .then((yanit) => {
      if (!yanit.ok) throw new Error(`standart şablon okunamadı (${yanit.status})`);
      return yanit.text();
    })
    .catch((e) => {
      onbellek = null;
      throw e;
    });
  return onbellek;
}
