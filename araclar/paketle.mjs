/**
 * Mağaza paketlerini üretir (bağımlılıksız zip):
 *   dist/chrome/   + dist/efatura-goruntuleyici-chrome-<sürüm>.zip
 *   dist/firefox/  + dist/efatura-goruntuleyici-firefox-<sürüm>.zip
 *
 * Chrome paketinde Firefox'a özgü anahtarlar, Firefox paketinde service_worker ve
 * XSLT polyfill'i yoktur (Firefox'ta yerleşik XSLTProcessor var; AMO incelemesi de
 * küçültülmüş üçüncü taraf koddan arınır).
 * Kullanım: node araclar/paketle.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, statSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";

const KOK = join(dirname(fileURLToPath(import.meta.url)), "..");
const KAYNAK = join(KOK, "uzanti");
const CIKTI = join(KOK, "dist");

const manifest = JSON.parse(readFileSync(join(KAYNAK, "manifest.json"), "utf8"));
const surum = manifest.version;

function crc32(baytlar) {
  let c = ~0;
  for (const b of baytlar) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function dosyalariListele(klasor) {
  return readdirSync(klasor).flatMap((ad) => {
    const yol = join(klasor, ad);
    return statSync(yol).isDirectory() ? dosyalariListele(yol) : [yol];
  });
}

/** Klasörü zip'ler (deflate, UTF-8 dosya adları). */
function zipYaz(klasor, hedef) {
  const yerel = [];
  const merkez = [];
  let konum = 0;
  for (const yol of dosyalariListele(klasor).sort()) {
    const ad = Buffer.from(relative(klasor, yol).split(sep).join("/"), "utf8");
    const veri = readFileSync(yol);
    const sikisik = deflateRawSync(veri, { level: 9 });
    const crc = crc32(veri);

    const bas = Buffer.alloc(30);
    bas.writeUInt32LE(0x04034b50, 0);
    bas.writeUInt16LE(20, 4); // sürüm
    bas.writeUInt16LE(0x0800, 6); // UTF-8 ad
    bas.writeUInt16LE(8, 8); // deflate
    bas.writeUInt16LE(0, 10); // saat
    bas.writeUInt16LE(0x21, 12); // tarih: 1980-01-01 (tekrarlanabilir paket)
    bas.writeUInt32LE(crc, 14);
    bas.writeUInt32LE(sikisik.length, 18);
    bas.writeUInt32LE(veri.length, 22);
    bas.writeUInt16LE(ad.length, 26);
    yerel.push(bas, ad, sikisik);

    const m = Buffer.alloc(46);
    m.writeUInt32LE(0x02014b50, 0);
    m.writeUInt16LE(20, 4);
    m.writeUInt16LE(20, 6);
    m.writeUInt16LE(0x0800, 8);
    m.writeUInt16LE(8, 10);
    m.writeUInt16LE(0, 12);
    m.writeUInt16LE(0x21, 14);
    m.writeUInt32LE(crc, 16);
    m.writeUInt32LE(sikisik.length, 20);
    m.writeUInt32LE(veri.length, 24);
    m.writeUInt16LE(ad.length, 28);
    m.writeUInt32LE(konum, 42);
    merkez.push(m, ad);
    konum += bas.length + ad.length + sikisik.length;
  }
  const merkezBoyu = merkez.reduce((t, b) => t + b.length, 0);
  const son = Buffer.alloc(22);
  son.writeUInt32LE(0x06054b50, 0);
  son.writeUInt16LE(merkez.length / 2, 8);
  son.writeUInt16LE(merkez.length / 2, 10);
  son.writeUInt32LE(merkezBoyu, 12);
  son.writeUInt32LE(konum, 16);
  writeFileSync(hedef, Buffer.concat([...yerel, ...merkez, son]));
}

function hazirla(tarayici, manifestDuzenle, haric = []) {
  const klasor = join(CIKTI, tarayici);
  rmSync(klasor, { recursive: true, force: true });
  cpSync(KAYNAK, klasor, { recursive: true, filter: (yol) => !haric.some((h) => relative(KAYNAK, yol).split(sep).join("/").startsWith(h)) });
  const m = structuredClone(manifest);
  manifestDuzenle(m);
  writeFileSync(join(klasor, "manifest.json"), `${JSON.stringify(m, null, 2)}\n`);
  const zip = join(CIKTI, `efatura-goruntuleyici-${tarayici}-${surum}.zip`);
  zipYaz(klasor, zip);
  console.log(`${relative(KOK, zip)} (${(statSync(zip).size / 1024).toFixed(0)} KB)`);
}

mkdirSync(CIKTI, { recursive: true });

hazirla("chrome", (m) => {
  delete m.browser_specific_settings;
  delete m.background.scripts;
});

hazirla(
  "firefox",
  (m) => {
    delete m.background.service_worker;
    // Firefox'ta polyfill yok; WASM izni de gerekmez
    m.content_security_policy.extension_pages = m.content_security_policy.extension_pages.replace(" 'wasm-unsafe-eval'", "");
  },
  ["vendor"],
);
