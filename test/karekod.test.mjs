/**
 * Karekod metni ve görseli birim testleri.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DOMParser } from "@xmldom/xmldom";

import { karekodMetni, karekodGorseli } from "../uzanti/lib/karekod.js";

const ORNEKLER = join(dirname(fileURLToPath(import.meta.url)), "..", "ornekler");
const belge = (ad) => new DOMParser().parseFromString(readFileSync(join(ORNEKLER, ad), "utf8"), "application/xml");

test("karekod metni GİB şablonlarındaki alan sırası ve değerleriyle üretilir", () => {
  const veri = JSON.parse(karekodMetni(belge("efatura-ornek.xml")));
  assert.deepEqual(Object.keys(veri), [
    "vkntckn", "avkntckn", "senaryo", "tip", "tarih", "no", "ettn", "parabirimi",
    "malhizmettoplam", "kdvmatrah(20)", "hesaplanankdv(20)", "vergidahil", "odenecek",
  ]);
  assert.equal(veri.vkntckn, "9990000001");
  assert.equal(veri.avkntckn, "9990000002");
  assert.equal(veri.no, "ORN2026000000001");
  assert.equal(veri["kdvmatrah(20)"], "32254.50");
  assert.equal(veri.odenecek, "38705.40");
});

test("birden fazla KDV oranı ve TCKN'li alıcı", () => {
  const veri = JSON.parse(karekodMetni(belge("sablonsuz-dovizli-tevkifatli.xml")));
  assert.equal(veri.avkntckn, "10000000146");
  assert.equal(veri.parabirimi, "USD");
  assert.equal(veri["kdvmatrah(10)"], "300.00");
  assert.equal(veri["hesaplanankdv(20)"], "205.20");
  assert.equal(veri["kdvmatrah(0)"], "600.00");
});

test("e-İrsaliye için karekod metni üretilmez", () => {
  assert.equal(karekodMetni(belge("eirsaliye-ornek.xml")), null);
});

test("karekod görseli SVG data URL'i, Türkçe karakterli metinle de", () => {
  const { url, boyut } = karekodGorseli('{"no":"ÇĞİÖŞÜ çğıöşü","tutar":"1.234,56"}');
  assert.ok(boyut >= 100 && boyut <= 140, `boyut ${boyut}`);
  assert.match(url, /^data:image\/svg\+xml;base64,/);
  const svg = Buffer.from(url.split(",")[1], "base64").toString("utf8");
  assert.match(svg, /^<svg[^>]*viewBox="0 0 \d+ \d+"/);
  assert.match(svg, /<path d="M/);
});

test("uzun karekod metninde görsel büyür (modül başına en az 2 px)", () => {
  const { boyut } = karekodGorseli("x".repeat(600));
  assert.ok(boyut > 140 && boyut % 2 === 0, `boyut ${boyut}`);
});
