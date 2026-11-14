/**
 * Uzantı simgelerini (16/32/48/128 px PNG) bağımlılıksız üretir:
 * orman yeşili yuvarlatılmış kare üzerinde köşesi kıvrık krem bir belge ve satırlar.
 * Kullanım: node araclar/simge-uret.mjs
 */

import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HEDEF = join(dirname(fileURLToPath(import.meta.url)), "..", "uzanti", "simgeler");
const YESIL = [0x1f, 0x3a, 0x2e];
const KREM = [0xf5, 0xf1, 0xea];
const KIVRIM = [0xc9, 0xbf, 0xad];

/** 0..1 birim karede bir noktanın rengi (null = saydam). */
function renk(x, y) {
  // Yuvarlatılmış kare zemin
  const r = 0.2;
  const dx = Math.max(r - x, 0, x - (1 - r));
  const dy = Math.max(r - y, 0, y - (1 - r));
  if (dx * dx + dy * dy > r * r) return null;

  // Belge: x 0.27–0.73, y 0.16–0.84, sağ üst köşe kıvrık
  const sol = 0.27, sag = 0.73, ust = 0.16, alt = 0.84, k = 0.15;
  if (x >= sol && x <= sag && y >= ust && y <= alt) {
    const koseX = sag - k, koseY = ust + k;
    if (x > koseX && y < koseY) {
      // Kıvrım üçgeni: köşegenin altı kıvrım, üstü zemin
      if (x - koseX > y - ust) return YESIL;
      return KIVRIM;
    }
    // Satırlar
    for (const [sy, bitis] of [[0.43, 0.63], [0.54, 0.63], [0.65, 0.53]]) {
      if (Math.abs(y - sy) < 0.035 && x > 0.35 && x < bitis) return YESIL;
    }
    return KREM;
  }
  return YESIL;
}

function crc32(baytlar) {
  let c = ~0;
  for (const b of baytlar) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function parca(tur, veri) {
  const uzunluk = Buffer.alloc(4);
  uzunluk.writeUInt32BE(veri.length);
  const turVeri = Buffer.concat([Buffer.from(tur, "ascii"), veri]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(turVeri));
  return Buffer.concat([uzunluk, turVeri, crc]);
}

function png(boyut) {
  const ornek = 4; // kenar yumuşatma için piksel başına 4x4 örnek
  const satirlar = [];
  for (let py = 0; py < boyut; py++) {
    const satir = Buffer.alloc(1 + boyut * 4);
    for (let px = 0; px < boyut; px++) {
      let [r, g, b, a] = [0, 0, 0, 0];
      for (let sy = 0; sy < ornek; sy++) {
        for (let sx = 0; sx < ornek; sx++) {
          const c = renk((px + (sx + 0.5) / ornek) / boyut, (py + (sy + 0.5) / ornek) / boyut);
          if (!c) continue;
          r += c[0]; g += c[1]; b += c[2]; a++;
        }
      }
      const o = 1 + px * 4;
      if (a) {
        satir[o] = Math.round(r / a);
        satir[o + 1] = Math.round(g / a);
        satir[o + 2] = Math.round(b / a);
      }
      satir[o + 3] = Math.round((a / (ornek * ornek)) * 255);
    }
    satirlar.push(satir);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(boyut, 0);
  ihdr.writeUInt32BE(boyut, 4);
  ihdr[8] = 8; // bit derinliği
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    parca("IHDR", ihdr),
    parca("IDAT", deflateSync(Buffer.concat(satirlar))),
    parca("IEND", Buffer.alloc(0)),
  ]);
}

for (const boyut of [16, 32, 48, 128]) {
  writeFileSync(join(HEDEF, `simge-${boyut}.png`), png(boyut));
  console.log(`simge-${boyut}.png yazıldı`);
}
