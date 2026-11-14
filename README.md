# e-Fatura Görüntüleyici

e-Fatura, e-Arşiv ve e-İrsaliye (UBL-TR) XML dosyalarını, içlerine gömülü görünüm şablonuyla (XSLT) kağıttaki hallerinde gösteren Chrome ve Firefox uzantısı.

Firefox'ta bir e-Fatura XML'i açınca ham kod görünür, Chrome ise XSLT desteğini kaldırıyor. Bu uzantı şablonu XML'in içinden çıkarır, tarayıcıda uygular ve faturayı okunur hale getirir. Her şey bilgisayarınızda olur: uzantı **ağa hiçbir istek atmaz**, uzaktan kod yüklemez, veri toplamaz.

> Mali mühür / e-imza (XAdES) doğrulaması **yapmaz**. Görüntülenen fatura, belgenin geçerli olduğunu kanıtlamaz.

## Özellikler

- Adresi `.xml` ile biten sekmeler (http, https, `file://`) UBL fatura/irsaliye ise otomatik olarak görüntüleyicide açılır. Açılır pencereden kapatılabilir.
- Sağ tık → **Bu XML'i fatura olarak göster**: adresi `.xml` ile bitmeyen sekmeler için.
- Uzantı simgesi → **Dosya aç / sürükle-bırak**: dosyayı seçerek ya da sayfaya sürükleyerek açma. Birden fazla dosya bırakırsanız her biri ayrı sekmede açılır. `file://` erişimi vermek istemeyenler için de bu yol.
- Şablonu olmayan (ya da şablonu bozuk) e-Fatura, e-Arşiv ve e-İrsaliye'ler uzantının **standart şablonuyla** gösterilir. Yerleşim GİB'in örnek fatura görünümüne benzer: taraflar, fatura bilgileri, kalemler (iskonto, KDV, diğer vergiler, tevkifat), toplamlar, istisna sebebi, ödeme bilgileri ve notlar. Döviz ve kur, şahıs alıcı (TCKN) desteklenir. Hesap yapmaz; tutarlar belgede yazdığı gibi gösterilir.
- Şablonlu faturalarda **Standart şablon / Faturanın şablonu** düğmesiyle iki görünüm arasında geçilebilir.
- Okunur (girintili) ham XML görünümü; gömülü ekler kısaltılır.
- **Ham XML / Fatura görünümü** geçişi, **Yazdır** düğmesi (Ctrl+P de faturayı yazdırır).
- windows-1254, ISO-8859-9 ve BOM'lu dosyalar doğru okunur.
- Türkçe ve İngilizce arayüz.

### Şablon nasıl bulunur

`cac:AdditionalDocumentReference` → `cac:Attachment` → `cbc:EmbeddedDocumentBinaryObject` içindeki base64 ekler taranır:

1. PDF ekleri (adı, MIME türü ya da `%PDF` imzası) atlanır.
2. İçeriği `xsl:stylesheet` / `xsl:transform` olan ekler şablon adayıdır.
3. Adı `.xslt` ile biten (ya da MIME türünde `xsl` geçen) aday tercih edilir; yoksa ilk aday kullanılır.
4. Şablon yoksa ya da uygulanamıyorsa fatura ve irsaliye için standart şablon ([`uzanti/sablonlar/standart.xslt`](uzanti/sablonlar/standart.xslt)), diğer belgeler için ham XML gösterilir.

Standart şablon bu proje için sıfırdan yazılmıştır (MIT); GİB'in şablon dosyası değildir.

### Dönüşüm

Firefox'un yerleşik `XSLTProcessor`'ı kullanılır. Chrome'da yerleşik destek varsa o, yoksa uzantıyla birlikte gelen [xslt-polyfill](https://github.com/mfreed7/xslt_polyfill) (Chrome ekibinden Mason Freed, libxslt'nin WebAssembly derlemesi) kullanılır. Polyfill uzantının içindedir; internetten indirilmez.

## Güvenlik

Görünüm şablonu faturayı gönderen tarafın yazdığı koddur; uzantı ona güvenmez:

- Fatura `sandbox=""` bir iframe'de gösterilir: şablondaki betikler ve `onclick` gibi olay öznitelikleri **çalışmaz**, şablon uzantıya ya da başka sekmelere erişemez.
- Çıktının başına kısıtlayıcı bir içerik güvenliği politikası (CSP) eklenir: dış görsel, stil, yazı tipi yüklenemez; yalnızca satır içi stil ve `data:` görseller (logo, karekod, imza) çalışır. `meta refresh` ve `<base>` atılır, dış bağlantılar tıklanamaz (adres, üzerine gelince görünür).
- Uzantı sayfalarının CSP'si `connect-src 'self'`: uzantı yalnızca kendi dosyalarını (standart şablon) okuyabilir, hiçbir sunucuya bağlanamaz. Şablondaki `document('http://…')` ile dış belge çekme denemesinin sunucuya ulaşmadığı Chrome'da uçtan uca testle doğrulanıyor (Firefox'ta henüz otomatik test yok).
- Yazdırmada çıktı ayrıca betiklerden, olay özniteliklerinden ve `javascript:` bağlantılarından temizlenir ve betik çalıştıramayan ayrı bir çerçevede basılır.
- XML'ler yalnızca tarayıcı belleğinde (`storage.session`) tutulur, tarayıcı kapanınca silinir; en fazla 15 belge saklanır.

### İzinler

| İzin | Neden |
|---|---|
| `.xml` ile biten adreslerde içerik betiği (tüm siteler) | Açılan XML'in UBL fatura olup olmadığına bakmak. Betik başka sayfalarda çalışmaz; XML fatura değilse hiçbir şey yapmaz. Chrome bunu "tüm sitelerdeki verilerinizi okuma" uyarısıyla gösterir. |
| `activeTab`, `scripting` | Sağ tık / açılır pencereden "bu sekmedeki XML'i göster" dendiğinde yalnızca o sekmeyi okumak. |
| `contextMenus` | Sağ tık menüsü. |
| `storage` | Açılan XML'i görüntüleyici sekmesine taşımak ve "otomatik aç" ayarı. |

`tabs`, `downloads`, `webRequest` ya da herhangi bir sunucu izni **yoktur**.

## Kurulum (geliştirici modu)

Mağaza sürümü henüz yok. Kaynaktan yüklemek için:

### Chrome / Edge / Brave

1. Bu depoyu indirin (`git clone` ya da ZIP).
2. `chrome://extensions` adresini açın, sağ üstten **Geliştirici modu**'nu açın.
3. **Paketlenmemiş öğe yükle** → depodaki `uzanti` klasörünü seçin.
4. Yerel dosyalar (`file://`) için: uzantının **Ayrıntılar** sayfasında **Dosya URL'lerine erişime izin ver**'i açın. Açmak istemezseniz dosyaları uzantı simgesi → **Dosya aç** ile açabilirsiniz.

### Firefox

**Firefox'ta bilinmesi gerekenler**

- Firefox, bilgisayardaki dosyalarda (`file://`) uzantıların çalışmasına izin vermiyor (MV2'de de, tüm izinler verilse de; Firefox 160'ta denendi). Bu yüzden bilgisayarınızdaki bir XML'i Firefox'ta açınca ham kod görünür. Yerel dosyaları uzantı simgesi → **Dosya aç** sayfasına sürükleyin ya da oradan seçin. Web'den açılan `.xml` adresleri otomatik açılır.
- Firefox site erişimini kullanıcıya bırakıyor: ilk kurulumda açılan sayfada (ya da uzantı penceresinde) **İzin ver**'e basın. İzin verilmezse `.xml` sekmeleri otomatik açılmaz; dosya açma ve sağ tık yine çalışır.
- Yerel dosyaların otomatik açılması gerekiyorsa Chrome / Edge kullanın (uzantı ayrıntılarında "Dosya URL'lerine erişime izin ver" açık olmalı).

Geçici yükleme (Firefox kapanınca kalkar):

1. `about:debugging#/runtime/this-firefox` → **Geçici Eklenti Yükle…**
2. `uzanti/manifest.json` dosyasını seçin.

#### Kalıcı kurulum: Mozilla imzası (ücretsiz)

Firefox yalnızca Mozilla'nın imzaladığı uzantıları kalıcı kurar. Mağazada listelemeden ("unlisted") imzalatıp `.xpi` dosyasını kendiniz kurabilirsiniz:

1. [addons.mozilla.org](https://addons.mozilla.org) üzerinde hesap açın (Mozilla hesabı).
2. [Geliştirici Merkezi → API anahtarları](https://addons.mozilla.org/developers/addon/api/key/) sayfasında anahtar oluşturun: **JWT issuer** (`user:…`) ve **JWT secret**. Bunları kimseyle paylaşmayın, depoya koymayın.
3. Depo klasöründe, anahtarları yalnızca o terminal oturumu için ortam değişkeni olarak verip imzalatın (PowerShell):

   ```powershell
   $env:WEB_EXT_API_KEY = Read-Host "JWT issuer"
   $env:WEB_EXT_API_SECRET = [System.Net.NetworkCredential]::new("", (Read-Host "JWT secret" -AsSecureString)).Password
   npm run imzala:firefox
   ```

   Otomatik doğrulama genelde birkaç dakika sürer. İmzalı dosya `dist/imzali/` altına iner.
4. `.xpi` dosyasını Firefox penceresine sürükleyin (ya da `about:addons` → dişli → **Dosyadan eklenti yükle…**) ve kurulumu onaylayın. Sonra uzantı penceresindeki **İzin ver**'e basın.

Her yeni imza için `uzanti/manifest.json`'daki `version` artırılmalıdır (aynı sürüm ikinci kez imzalanamaz). Uzantı kimliği (`browser_specific_settings.gecko.id`) ilk imzadan sonra değiştirilmemelidir.

## Geliştirme

Node.js 20+ gerekir.

```bash
npm install
npm test              # şablon çıkarma birim testleri (node:test + xmldom)
npm run test:e2e      # uzantıyı Chromium'a yükleyip örnekleri açar (Playwright)
npm run lint:firefox  # web-ext lint
npm run paketle       # dist/ altında Chrome ve Firefox zip'leri
npm run firefox       # uzantıyla geçici bir Firefox açar
```

- Uçtan uca test Playwright'ın Chromium'unu (`npx playwright-core install chromium`) ya da `CHROMIUM_YOLU` ile verilen Chrome'u kullanır. Markalı Chrome `--load-extension`'ı yok saydığı için uzantı DevTools protokolüyle (`Extensions.loadUnpacked`) yüklenir. Test, şablondaki betiklerin çalışmadığını ve `127.0.0.1:8719`'daki izleme sunucusuna istek gitmediğini de doğrular. `viewer.html?polyfill=1` yerleşik XSLT olsa bile polyfill'i zorlar.
- `ornekler/` altındaki dosyalar **sentetiktir** (`npm run ornekler` ile üretilir). Gerçek mükellef faturalarını depoya koymayın.
- Paketleme: Chrome zip'inde Firefox'a özgü anahtarlar yok; Firefox zip'inde polyfill ve `wasm-unsafe-eval` yok (Firefox'ta yerleşik XSLT var).

### Dosya düzeni

```
uzanti/
  manifest.json        Manifest V3 (Chrome + Firefox)
  arkaplan.js          service worker / olay sayfası: sağ tık menüsü, sekme yönlendirme
  icerik.js            .xml sekmelerinde UBL algılama
  viewer.html/.js/.css görüntüleyici
  popup.html/.js/.css  açılır pencere
  lib/sablon.js        şablon çıkarma (saf, test edilebilir)
  lib/donustur.js      XSLT dönüşümü + polyfill yükleme
  lib/temizle.js       çıktıya CSP ekleme, yazdırma temizliği
  lib/ham-xml.js       okunur ham XML
  lib/aktarim.js       XML'i görüntüleyiciye taşıma (storage.session)
  lib/standart-sablon.js  standart şablonu yükleme
  sablonlar/standart.xslt şablonsuz fatura / irsaliye görünümü
  vendor/xslt-polyfill xslt-polyfill 1.0.33 (BSD-3-Clause)
test/                  birim ve uçtan uca testler
ornekler/              sentetik UBL-TR örnekleri
araclar/               örnek, simge ve paket üreticileri
```

## Lisans

[MIT](LICENSE). Üçüncü taraf bileşenler için [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

---

## English

**e-Invoice Viewer** is a Chrome/Firefox extension that renders Turkish e-Fatura, e-Arşiv and e-İrsaliye (UBL-TR) XML files using the XSLT view template embedded in the document (`cac:AdditionalDocumentReference` → `cbc:EmbeddedDocumentBinaryObject`, base64).

- Opens `.xml` tabs that contain a UBL Invoice / DespatchAdvice automatically; also via the context menu, or by choosing / dropping files in the viewer.
- Documents without an embedded template (e-invoice / e-despatch) are rendered with the extension's own standard template, laid out like the GİB sample invoice.
- Uses the native `XSLTProcessor` when available, otherwise the bundled [xslt-polyfill](https://github.com/mfreed7/xslt_polyfill) (WebAssembly libxslt, BSD-3-Clause). Nothing is downloaded at runtime.
- The template is untrusted: output is rendered in a `sandbox=""` iframe with a restrictive CSP (no scripts, no external resources). The extension pages use `connect-src 'self'` (own files only); the extension makes **no network requests** and collects no data.
- Does **not** verify the financial seal / XAdES signature.

Install from source: `chrome://extensions` → Developer mode → *Load unpacked* → select the `uzanti` folder. Firefox: `about:debugging` → *Load Temporary Add-on* → `uzanti/manifest.json`.

Development: `npm install`, `npm test`, `npm run test:e2e`, `npm run paketle`. Sample files in `ornekler/` are synthetic. License: MIT.
