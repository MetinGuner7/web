# DGS konu anlatımı — ortak okuyucu tasarımı

Onaylanan pillsiz tasarımın 62 konu sayfasına uygulanmasıdır. Matematik ve
Türkçe defterleri, destek/gizlilik sayfaları, diğer sınavlar kapsam dışıdır.

## Değişmeyen içerik

Konu sayfalarının `<body>` içeriği aynen korunur: anlatım, başlık sırası,
örnekler, formüller, çözümler, şekiller ve önceki/sonraki konu bağlantıları.
Yeni bir özet, örnek, alıştırma veya pill eklenmez. Mevcut açılır çözümler
native HTML `details/summary` olarak çalışmaya devam eder.

`reader.js` yalnız sunum için mevcut düğümleri taşır: bölüm başlığını kartın
dışında bırakır, kalan bölümü beyaz kartta toplar, bölüm numarası ve ders
etiketi ekler. Dekoratif emojiler metinden silinmez; ayrı bir span içinde
görsel olarak gizlenir. İçerik değişikliği için bu script kullanılmamalıdır.
Script yüklenmezse eski HTML okunabilir durumda kalır.

## Tasarım değerleri

- Zemin `#F7F8FA`, kart `#FFFFFF`, ana metin `#18283A`.
- İkincil metin `#40516A`, yardımcı metin `#62718A`.
- DGS mavisi `#1768C5`, formül zemini `#EAF4FF`.
- Not zemini `#FFF8E9`, vurgu `#986000`, sınır `#EDD8A7`.
- Inter 400/500/600/700 yerel olarak paketlenir; uygulamayla aynı font
  dosyaları ve SIL OFL lisansı kullanılır. Font için üçüncü taraf çağrı yoktur.
- Konu başlığı 28 px, bölüm 20 px, kart başlığı 18 px, metin 16 px / 1.65
  satır yüksekliği. Küçük açıklamalar 14–15 px, ders etiketi 12 px.
- Dış boşluk telefonda 16–24 px, kart içi 20 px (tablette 24 px), kart
  yarıçapı 16 px, bölüm aralığı 28 px. Okuma alanı en fazla 800 px.
- 600 px altında tek sütun; geniş ekranda uygun bilgi kartları iki sütun.
- Koyu tema aynı hiyerarşiyi okunabilir renklerle korur. `?theme=light` ve
  `?theme=dark` cihaz temasından önceliklidir; tema yoksa cihaz izlenir.
- Uzun formüller, sayı doğruları ve tablolar kendi alanında kaydırılır.
  KaTeX fontları ve SVG ölçüleri değiştirilmez. Pinch zoom engeli kaldırılır.

Uygulamanın üst barı ve alttaki tamamlanma butonları Compose tarafında kalır;
web içeriğine ikinci bir bar veya buton eklenmez. Bu PR yalnız okuyucu içidir.

## Kontroller

`tests/reader.test.mjs`, 62 sayfanın kaynak gövdesini `origin/main` ile
karşılaştırır. Chromium'da 390 px açık/koyu, 320 px açık (cihaz koyu) ve
1180 px yatay tablet olmak üzere 248 sayfa görünümü denetlenir. DOM metni,
gerçek Inter yüklemesi, tema, yatay taşma, bölüm numaraları, açılır çözümler,
KaTeX çıktısı ve parse hataları kontrol edilir. Ek olarak otomatik koyu tema
ve %150 gövde yazısı stres testi çalışır. Ekran görüntüleri çıktı klasörüne
yazılır; testler gerçek kullanıcı verisi okumaz/yazmaz.

```powershell
cd dgs/shared/tests
npm install --ignore-scripts
$env:CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
node reader.test.mjs ../../..
```

Testler KaTeX'in mevcut sabitlenmiş CDN sürümünü kullanır; internet gerektirir.
`PLAYWRIGHT_MODULE` tanımlanırsa kurulu Playwright modülünün mutlak `index.mjs`
yolu kullanılabilir. iOS WKWebView ve Android uygulama içi cihaz kontrolü,
masaüstü Chromium testlerinden ayrı değerlendirilmelidir.
