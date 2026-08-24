/* =============================================================
   LEAD İÇE AKTARMA (Meta Lead Ads CSV / Excel)
   Meta'dan indirilen dosyayı panele yükler.
   Sütun adları forma göre değiştiği için eşleştirme ELLE
   ayarlanabilir; yaygın adlar otomatik tahmin edilir.
   ============================================================= */

/* Panelin kolonlarına karşılık gelen hedef alanlar.
   ipuclari: sütun başlığında bunlardan biri geçerse otomatik eşleşir. */
const IMP_ALANLAR = [
  { key: "company",    ad: "Şirket adı",   ipuclari: ["company name", "company", "şirket adı", "şirket", "firma adı", "firma", "kurum", "işletme"] },
  { key: "contact",    ad: "Yetkili kişi", ipuclari: ["full name", "ad soyad", "adı soyadı", "adınız", "isim", "yetkili kişi", "yetkili", "iletişim kişisi", "kişi adı", "name", "ad", "adı"] },
  { key: "group",      ad: "Ürün grubu",   ipuclari: ["ürün grubu", "grubunu", "grubu", "grup", "group", "kategori", "ürün tipi"] },
  // Serbest metin ürün cevabı ("Çin'den hangi ürünü getirmek istiyorsunuz?").
  // "Ürün grubu"ndan SONRA gelir: ipuçları çakışırsa grup sütunu önceliklidir.
  { key: "products",   ad: "Ürünler",      ipuclari: ["hangi ürün", "ürünler", "ürün", "product", "products", "talep ettiğiniz", "getirmek istediğiniz"] },
  // Çin hizmetindeki ücret uyarısı sorusunun cevabı ("…Devam etmek ister misiniz?").
  // Bu leadlerde tonaj sorulmadığı için sınıfı BU cevap belirler (scoring.js).
  // Sütun başlığı sorunun tamamı olabiliyor; birden çok ipucu, başlık kısaltılmış
  // gelse de tutsun diye. ("ücretli" ipucu "ücretsiz danışmanlık"a takılmaz.)
  { key: "cinPaid",    ad: "Ücretli hizmet cevabı",
    ipuclari: ["ücretli hizmet", "ücretlendirilir", "danışmanlık", "devam etmek", "hizmeti değerlendir"] },
  // Ambalaj Sarf Malzemeleri hizmetinin 3 sorusu. İpuçları TEK kelime gibi
  // görünse de birbirinin başlığında da geçebiliyor (üçü de "…malzemelerini
  // getirmek istiyorsunuz?" ile bitiyor); her ipucu o soruya ÖZGÜ kelimeye
  // dayanır (bambu / hijyen / "ambalaj ve paketleme" birlikte) ki sütunlar
  // birbirine karışmasın.
  { key: "ambalajBambu",     ad: "Bambu ambalaj cevabı",     ipuclari: ["bambu"] },
  { key: "ambalajHijyen",    ad: "Hijyen malzemesi cevabı",  ipuclari: ["hijyen", "temizlik hijyen"] },
  { key: "ambalajPaketleme", ad: "Ambalaj/paketleme cevabı", ipuclari: ["ambalaj ve paketleme", "paketleme"] },
  // Çin'den Nalburiye ve İnşaat Hırdavatı hizmetinin bütçe DIŞINDAKİ 2 sorusu
  // (bütçe zaten aşağıdaki genel "budget" alanıyla eşleşir — bu hizmette sınıfı
  // tonaj yerine bütçe cevabı belirler, bkz. scoring.js). İpuçları birden çok
  // kelimeli seçildi ki "group"/"products" alanlarının kısa ipuçlarını yenip
  // doğru sütuna otursun (impSkor uzun ipucuna daha yüksek puan verir).
  { key: "nalburiyeKategori", ad: "Nalburiye — ana ürün grubu",
    ipuclari: ["ana ürün grubu", "hangi ana ürün", "ürün grubu ile ilgileniyor"] },
  { key: "nalburiyeUrun",     ad: "Nalburiye — ürün detayı",
    ipuclari: ["ilgilendiğiniz ürün", "kısaca yazınız", "ürünü veya ürünleri"] },
  { key: "phone",      ad: "Telefon",      ipuclari: ["phone number", "phone", "telefon", "gsm", "cep", "tel", "numara"] },
  { key: "email",      ad: "E-posta",      ipuclari: ["email", "e posta", "eposta", "e mail", "mail"] },
  { key: "location",   ad: "Şehir",        ipuclari: ["city", "şehir", "şehr", "il", "location", "konum", "bulunduğunuz"] },
  { key: "port",       ad: "Liman",        ipuclari: ["port", "liman"] },
  { key: "tonnage",    ad: "Tonaj",        ipuclari: ["tonaj", "tonnage", "kaç ton", "ton", "miktar"] },
  { key: "budget",     ad: "Bütçe",        ipuclari: ["bütçe", "butce", "budget", "usd", "dolar", "bedel"] },
  { key: "timing",     ad: "Zamanlama",    ipuclari: ["ne zaman", "ithalat zamanı", "zamanlama", "zaman", "timing"] },
  { key: "experience", ad: "Tecrübe",      ipuclari: ["tecrübe", "experience", "deneyim", "daha önce", "geçmiş"] },
  { key: "createdAt",  ad: "Tarih",        ipuclari: ["created time", "created", "tarih", "date", "oluşturma"] },
];

let IMP_BASLIK = [];   // dosyadaki sütun başlıkları
let IMP_SATIR  = [];   // dosyadaki veri satırları
let IMP_ESLES  = {};   // { hedefAlan: sütunIndeksi }

/* --- Kampanya (hizmet) damgası ---
   Meta dosyalarında çoğu zaman "ürün grubu" sütunu hiç gelmez; o leadler panele
   "Belirtilmemiş" düşer ve hangi kampanyadan geldikleri kaybolur. Buradaki hizmet
   dosyadaki TÜM satırlara uygulanır (dosyada grup sütunu olsa bile önceliklidir).

   Değer ELLE seçilmez: dosya okununca kampanya adından tanınır (impKampanyaTani).
   Aşağıdaki kutu yalnızca algılama yanlışsa düzeltmek içindir.
     ""        -> henüz belli değil; içe aktarma başlamaz
     "__dosya" -> grup her satırda dosyadaki sütundan okunsun
     "cin" ...  -> tüm satırlar bu hizmete damgalansın
   Her dosya sonrası sıfırlanır — bir sonraki dosya yanlış damgalanmasın diye. */
let IMP_SABIT_GRUP = "";
let IMP_ALGI_GEREKCE = "";   // hizmet nasıl bulundu (kullanıcıya gösterilir)

// Grup listesi admin.js'te (GROUP_FILTERS). Bu dosya ondan ÖNCE yüklendiği için
// seçici, admin.js'in en altındaki kurulum satırından çağrılır.
function impGrupSeciciKur() {
  const s = document.getElementById("impGroup");
  if (!s || typeof GROUP_FILTERS === "undefined") return;
  s.innerHTML = '<option value="">— Seçilmedi —</option>' +
    '<option value="__dosya">Dosyadaki sütundan oku</option>' +
    GROUP_FILTERS.filter(g => g.key !== "tumu" && g.key !== "yok")
      .map(g => `<option value="${g.key}">${escapeHtml(g.label)}</option>`).join("");
  s.value = IMP_SABIT_GRUP;
  s.addEventListener("change", e => {
    IMP_SABIT_GRUP = e.target.value;
    IMP_ALGI_GEREKCE = "";               // elle değiştirildi; algılama gerekçesi düşer
    impGrupIpucu();
    if (IMP_SATIR.length) impOnizle();   // önizleme açıksa grup sütunu hemen güncellensin
  });
  impGrupIpucu();
}

// Seçili hizmetin adı (baştaki simge atılır — not alanına düz metin yazılsın diye)
function impGrupAdi(key) {
  if (typeof GROUP_FILTERS === "undefined") return key;
  const g = GROUP_FILTERS.find(x => x.key === key);
  return g ? g.label.replace(/^[^A-Za-zÇĞİÖŞÜçğıöşü]+/, "").trim() : key;
}

// Dosyanın tamamına uygulanan sabit bir hizmet var mı? ("__dosya" sabit değildir)
const impSabitGrupVar = () => !!IMP_SABIT_GRUP && IMP_SABIT_GRUP !== "__dosya";

function impGrupIpucu() {
  const p = document.getElementById("impGroupHint");
  if (!p) return;
  if (impSabitGrupVar()) {
    p.innerHTML = "Dosyadaki <b>tüm</b> leadler <b>" + escapeHtml(impGrupAdi(IMP_SABIT_GRUP)) + "</b> hizmetine işaretlenir." +
      (IMP_ALGI_GEREKCE ? ' <span class="muted">(' + escapeHtml(IMP_ALGI_GEREKCE) + ")</span>" : "");
  } else if (IMP_SABIT_GRUP === "__dosya") {
    p.innerHTML = "Grup her satırda dosyadaki sütundan okunur; sütun yoksa lead <b>Belirtilmemiş</b> kalır.";
  } else {
    p.innerHTML = "Dosya seçilince kampanya adından otomatik bulunur. Bulunamazsa buradan seçmeniz gerekir — " +
      "leadler sessizce <b>Belirtilmemiş</b> kaydedilmesin diye.";
  }
}

/* --- Hizmeti dosyadan tanı ---
   Meta dosyasında reklam/kampanya/form adı sütunları hep bulunur ve dosyanın
   hangi kampanyaya ait olduğunu söyler ("TR_Cinden_Urun_Getirme_LeadGen").
   Bu sütunlar alan eşleştirmesinde yok sayılır (bkz. IMP_YOKSAY: "ad_name"
   başlığı "Yetkili kişi" alanına reklam adını yazdırıyordu) ama hizmeti
   okumak için elverişliler.
   Kampanya adı bir şey söylemezse ürün cevaplarına bakılır: satırların çoğunda
   "Çin'den …" geçiyorsa dosya Çin kampanyasıdır.
   Dönüş: { grup, gerekce } veya null. */
const IMP_KAMPANYA_SUTUN = ["campaign name", "adset name", "ad name", "form name", "kampanya", "reklam", "form adi"];

function impKampanyaTani() {
  // 1) Kampanya / reklam / form adı sütunları
  for (let i = 0; i < IMP_BASLIK.length; i++) {
    const bas = impNorm(IMP_BASLIK[i]);
    if (!IMP_KAMPANYA_SUTUN.includes(bas)) continue;
    for (const satir of IMP_SATIR) {
      const g = impGrupEsle(satir[i]);
      if (g) return { grup: g, gerekce: IMP_BASLIK[i] + ": " + String(satir[i]).trim() };
    }
  }
  // 2) Ürün cevapları — satırların yarıdan fazlası tek bir hizmete işaret ediyorsa
  const u = IMP_ESLES.products;
  if (u != null && IMP_SATIR.length) {
    const sayac = {};
    IMP_SATIR.forEach(s => { const g = impGrupEsle(s[u]); if (g) sayac[g] = (sayac[g] || 0) + 1; });
    const en = Object.entries(sayac).sort((a, b) => b[1] - a[1])[0];
    if (en && en[1] > IMP_SATIR.length / 2)
      return { grup: en[0], gerekce: IMP_SATIR.length + " satırın " + en[1] + "'inde ürün cevabı bu hizmete işaret ediyor" };
  }
  return null;
}

/* --- CSV çözümleyici (tırnak, gömülü virgül, CRLF, BOM) --- */
function impCSVCoz(metin) {
  metin = metin.replace(/^﻿/, "");
  const ilkSon = metin.indexOf("\n");
  const ilk = ilkSon >= 0 ? metin.slice(0, ilkSon) : metin;
  // Ayraç ilk satırdaki sayıya göre seçilir. Meta'nın "Leads" indirmesi SEKME
  // kullanır; Excel'den gelen Türkçe dosyalar noktalı virgül, klasik CSV virgül.
  const aday = ["\t", ";", ","];
  const ayr = aday.reduce((a, b) => ilk.split(b).length > ilk.split(a).length ? b : a);

  const satirlar = [];
  let satir = [], alan = "", tirnak = false;
  for (let i = 0; i < metin.length; i++) {
    const c = metin[i];
    if (tirnak) {
      if (c === '"') {
        if (metin[i + 1] === '"') { alan += '"'; i++; }
        else tirnak = false;
      } else alan += c;
    } else {
      if (c === '"') tirnak = true;
      else if (c === ayr) { satir.push(alan); alan = ""; }
      else if (c === "\n") { satir.push(alan); satirlar.push(satir); satir = []; alan = ""; }
      else if (c !== "\r") alan += c;
    }
  }
  if (alan.length || satir.length) { satir.push(alan); satirlar.push(satir); }
  return satirlar.filter(r => r.some(h => String(h).trim().length));
}

/* --- Excel (.xlsx): kütüphaneyi sadece gerektiğinde yükle --- */
function impSheetJSYukle() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((ok, hata) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    s.onload = ok;
    s.onerror = () => hata(new Error("Excel okuyucu yüklenemedi (internet?)"));
    document.head.appendChild(s);
  });
}

/* --- Değer normalleştirme: Meta cevabını panelin beklediği şıkka çevirir --- */
const impSayilar = s => (String(s).match(/\d+/g) || []).map(Number);

function impTonajEsle(ham) {
  if (!ham) return "";
  const s = String(ham).toLocaleLowerCase("tr");
  const n = impSayilar(s);
  if (/üzeri|üstü|uzeri|ustu|\+/.test(s) && n.includes(25)) return "25 ton üzeri";
  if (n.includes(1) && n.includes(5))   return "1–5 ton";
  if (n.includes(10) && n.includes(15)) return "10–15 ton";
  if (n.includes(20) && n.includes(25)) return "20–25 ton";
  if (n.length === 1 && n[0] >= 25)     return "25 ton üzeri";
  return "";
}

function impButceEsle(ham) {
  if (!ham) return "";
  const s = String(ham).toLocaleLowerCase("tr");
  // "10.000" -> 10000 olacak şekilde nokta/boşluk temizle
  const n = (s.replace(/[.\s]/g, "").match(/\d+/g) || []).map(Number);
  if (/altı|alti|az|under|</.test(s) && n.includes(10000)) return "10.000 USD altı";
  if (/üzeri|üstü|uzeri|ustu|\+|fazla/.test(s) && n.includes(50000)) return "50.000 USD üzeri";
  if (n.includes(10000) && n.includes(25000)) return "10.000 – 25.000 USD";
  if (n.includes(25000) && n.includes(50000)) return "25.000 – 50.000 USD";
  if (n.length === 1) {
    const v = n[0];
    if (v < 10000)  return "10.000 USD altı";
    if (v <= 25000) return "10.000 – 25.000 USD";
    if (v <= 50000) return "25.000 – 50.000 USD";
    return "50.000 USD üzeri";
  }
  return "";
}

/* Ürün grubu: Meta cevabı "dondurulmuş_meyve" / "_bakliyat" gibi gelir.
   Sitenin kullandığı kısa koda çevrilir (funnel.js ile aynı: meyve/sebze/
   deniz/bakliyat/hepsi), böylece panelde ve tedarik ekranında aynı görünür. */
function impGrupEsle(ham) {
  if (!ham) return "";
  const s = String(ham).toLocaleLowerCase("tr");
  // Çin kampanyası ayrı bir hizmet; dondurulmuş gıda gruplarından ÖNCE bakılır.
  // (cinMetniMi admin.js'te; bu dosya panelde onunla birlikte yüklenir.)
  if (typeof cinMetniMi === "function" && cinMetniMi(s)) return "cin";
  if (/hepsi|tümü|tumu|birden_?fazla|hepsini/.test(s)) return "hepsi";
  if (/bakliyat|fasulye|mercimek|nohut/.test(s))       return "bakliyat";
  if (/deniz|balık|balik|su_?ürün|su_?urun/.test(s))   return "deniz";
  if (/sebze/.test(s))                                 return "sebze";
  if (/meyve/.test(s))                                 return "meyve";
  return "";
}

/* Ürün cevabı SERBEST METİNDİR ("Çin'den paslanmaz çelik fritöz getirmek
   istiyorum"). Kısa bir liste ise ("Karides, kalamar") ayrı ürünlere bölünür;
   uzun bir cümleyi virgülden bölmek anlamı parçalayacağı için tek parça kalır. */
function impUrunEsle(ham) {
  const s = String(ham || "").trim();
  if (!s) return [];
  const parca = s.split(/[,;\n•|]+/).map(x => x.trim()).filter(Boolean);
  if (parca.length > 1 && parca.length <= 6 && parca.every(p => p.length <= 40)) return parca;
  return [s];
}

/* Telefon: Meta "p:+905321234567" gibi verebilir.
   Türkiye numaraları 10 haneye indirilir (5321234567) — çift kayıt kontrolü
   sitedeki formdan gelenlerle aynı biçimde çalışsın diye.
   YURT DIŞI numaralarda ülke kodu KORUNUR: körlemesine son 10 haneyi almak
   "+49 176 7028213" gibi bir numarayı tanınmaz hâle getiriyor, hem yanlış
   görünüyor hem de farklı ülkelerden iki numara yanlışlıkla eşleşebiliyordu. */
function impTelefonNorm(ham) {
  const d = String(ham || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("90")) return d.slice(2);  // 905321234567
  if (d.length === 11 && d.startsWith("0"))  return d.slice(1);  // 05321234567
  return d;                                                       // 10 hane veya yurt dışı
}

/* --- Metni kodlamasına göre çöz ---
   Meta'nın "Leads indir" dosyası UTF-16 LE'dir (her karakterin arasında 0x00
   baytı vardır). Düz text() ile okunursa harfler arasında boşluk varmış gibi
   görünür ve hiçbir sütun eşleşmez. BOM'a bakıp doğru çözücüyü seçiyoruz. */
function impMetneCevir(buf) {
  const b = new Uint8Array(buf);
  if (b.length >= 2 && b[0] === 0xFF && b[1] === 0xFE)
    return new TextDecoder("utf-16le").decode(buf);
  if (b.length >= 2 && b[0] === 0xFE && b[1] === 0xFF)
    return new TextDecoder("utf-16be").decode(buf);
  return new TextDecoder("utf-8").decode(buf);
}

/* Dosya GERÇEKTEN elektronik tablo mu? Uzantıya değil içeriğe bakılır.
   Sebep: Meta bazen UTF-16 metin dosyasını ".xls" adıyla indiriyor; uzantıya
   güvenilirse SheetJS'e metin verilip bozuk sonuç çıkıyordu. Tersi de olur:
   gerçek bir xlsx ".csv" adıyla kaydedilmiş olabilir.
     PK      -> xlsx/ods (zip)
     D0 CF   -> eski ikili .xls (OLE2) */
function impTabloMu(buf) {
  const b = new Uint8Array(buf, 0, Math.min(8, buf.byteLength));
  return (b[0] === 0x50 && b[1] === 0x4B) || (b[0] === 0xD0 && b[1] === 0xCF);
}

/* --- Dosyayı oku --- */
async function impDosyaOku(dosya) {
  const buf = await dosya.arrayBuffer();

  if (impTabloMu(buf)) {
    await impSheetJSYukle();
    const wb = XLSX.read(buf, { type: "array" });
    const sh = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sh, { header: 1, raw: false, defval: "" })
      .filter(r => r.some(h => String(h).trim().length));
  }

  // Metin dosyası (uzantısı .csv, .xls, .txt — fark etmez)
  return impCSVCoz(impMetneCevir(buf));
}

/* Meta'nın teknik sütunları. Otomatik eşleştirmede atlanır: aksi hâlde
   "ad_name" / "campaign_name" gibi başlıklar "name" ipucuna takılıp
   Yetkili kişi alanına reklam adını yazdırıyordu. Elle seçilebilir kalır. */
const IMP_YOKSAY = [
  "ad_id", "ad_name", "adset_id", "adset_name", "campaign_id", "campaign_name",
  "form_id", "form_name", "is_organic", "platform", "lead_status", "id",
];

/* --- Başlıkları hedef alanlara otomatik eşle ---
   Eşleştirme KELİME bazlıdır, düz "içeriyor mu" değil. Sebep: Meta'nın Türkçe
   başlıkları soru metninden üretiliyor ("Ad ve soyad", "Adınız Soyadınız") ve
   düz arama bunları "ad_soyad" ipucuna takamıyordu — Yetkili kişi sütunu hiç
   eşleşmiyor, panelde isim alanı boş kalıyordu. */

// "Şehriniz" -> "sehriniz": Türkçe harfleri sadeleştirir, noktalama atılır.
function impNorm(s) {
  return String(s).toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ç/g, "c").replace(/ö/g, "o").replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, " ").trim();
}
const impKelimeler = s => impNorm(s).split(" ").filter(Boolean);

// Türkçe ek alır: "grubu" ipucu "grubunu" başlığına da uysun diye ön-ek kabul
// edilir. 3 harften kısa ipuçlarında (ad, il) yalnızca birebir eşleşme geçerli;
// aksi hâlde "ad" ipucu "adres" başlığını yakalardı.
function impKelimeUyar(bas, ipucu) {
  return bas === ipucu || (ipucu.length >= 3 && bas.startsWith(ipucu));
}

// İpucundaki TÜM kelimeler başlıkta geçmeli. Puan: uzun/çok kelimeli ipucu
// daha güvenilir sayılır ("firma adı" ipucu "adı" ipucunu yener).
function impSkor(basKelimeler, ipucu) {
  const ik = impKelimeler(ipucu);
  if (!ik.length) return 0;
  let puan = 0;
  for (const k of ik) {
    if (!basKelimeler.some(b => impKelimeUyar(b, k))) return 0;
    puan += 10 + k.length;
  }
  return puan + (basKelimeler.length === ik.length ? 5 : 0); // başlığın tamamıysa
}

function impOtoEslestir() {
  IMP_ESLES = {};
  const yoksay = new Set(IMP_YOKSAY.map(impNorm));
  const adaylar = [];

  IMP_ALANLAR.forEach((alan, sira) => {
    IMP_BASLIK.forEach((b, i) => {
      if (yoksay.has(impNorm(b))) return;
      const bk = impKelimeler(b);
      let en = 0;
      alan.ipuclari.forEach(ip => { en = Math.max(en, impSkor(bk, ip)); });
      if (en) adaylar.push({ alan: alan.key, sutun: i, skor: en, sira });
    });
  });

  // En güçlü eşleşme önce yerleşir: böylece zayıf bir ipucu ("name") güçlü bir
  // alanın sütununu ("company name") kapmaz. Beraberlikte alan sırası belirler.
  adaylar.sort((a, b) => b.skor - a.skor || a.sira - b.sira || a.sutun - b.sutun);
  const doluAlan = new Set(), doluSutun = new Set();
  adaylar.forEach(a => {
    if (doluAlan.has(a.alan) || doluSutun.has(a.sutun)) return;
    IMP_ESLES[a.alan] = a.sutun;
    doluAlan.add(a.alan); doluSutun.add(a.sutun);
  });
}

/* --- Eşleştirme arayüzü --- */
function impEslesCiz() {
  const box = document.getElementById("impMap");
  if (!box) return;
  box.innerHTML = IMP_ALANLAR.map(alan => {
    const secili = IMP_ESLES[alan.key];
    const opts = ['<option value="">— yok —</option>'].concat(
      IMP_BASLIK.map((b, i) =>
        `<option value="${i}"${secili === i ? " selected" : ""}>${escapeHtml(b)}</option>`)
    ).join("");
    return `<label class="imp-row"><span>${alan.ad}</span>
      <select data-alan="${alan.key}" class="text-input">${opts}</select></label>`;
  }).join("");
  box.querySelectorAll("select").forEach(s => {
    s.addEventListener("change", e => {
      const v = e.target.value;
      if (v === "") delete IMP_ESLES[e.target.dataset.alan];
      else IMP_ESLES[e.target.dataset.alan] = +v;
      impOnizle();
    });
  });
}

/* --- Satırdan lead nesnesi üret --- */
function impSatirdanLead(satir) {
  const al = k => IMP_ESLES[k] != null ? String(satir[IMP_ESLES[k]] || "").trim() : "";
  const tonajHam  = al("tonnage");
  const butceHam  = al("budget");
  const tonaj = impTonajEsle(tonajHam);
  const butce = impButceEsle(butceHam);

  // Telefon NORMALLEŞTİRİLMİŞ hâliyle saklanır. Ham değer "p:+905321234567"
  // gibi gelir; olduğu gibi kaydedilirse panelde öyle görünür ve WhatsApp
  // bağlantısı çalışmaz. Site formundan gelen leadlerle de aynı biçim olur.
  const tel = impTelefonNorm(al("phone"));
  const urunler = impUrunEsle(al("products"));

  // Grup sırası: dosyaya damgalanan hizmet > dosyadaki grup sütunu > ürün cevabı.
  // Sonuncusu, kampanya adı tanınmayan karışık dosyalarda Çin taleplerinin
  // "Belirtilmemiş" düşmesini engeller.
  const grup = impSabitGrupVar() ? IMP_SABIT_GRUP
             : (impGrupEsle(al("group")) || impGrupEsle(urunler.join(" ")));

  const cinPaidHam = al("cinPaid");

  const state = {
    company: al("company"), contact: al("contact"), phone: tel,
    whatsapp: tel, email: al("email"),
    location: al("location"), port: al("port"),
    group: grup,
    tonnage: tonaj, budget: butce,
    timing: al("timing"), experience: al("experience"),
    products: urunler,
    cinPaid: cinPaidHam,
    ambalajBambu: al("ambalajBambu"),
    ambalajHijyen: al("ambalajHijyen"),
    ambalajPaketleme: al("ambalajPaketleme"),
    nalburiyeKategori: al("nalburiyeKategori"),
    nalburiyeUrun: al("nalburiyeUrun"),
  };
  const c = (typeof classifyLead === "function") ? classifyLead(state) : {};
  return {
    ...state,
    klass: c.klass || "", score: c.score || 0, leadGroup: c.group || null,
    showWhatsapp: !!c.showWhatsapp, showMeeting: !!c.showMeeting,
    createdAt: al("createdAt"),
    _tonajHam: tonajHam, _butceHam: butceHam,
    _tonajTanindi: !tonajHam || !!tonaj,
    _butceTanindi: !butceHam || !!butce,
    // Çin leadinin cevabı okunabildi mi? (boş cevap uyarı sayılmaz)
    _cinPaidTanindi: grup !== "cin" || !cinPaidHam ||
      (typeof cinPaidKey === "function" && !!cinPaidKey(cinPaidHam)),
  };
}

/* Zaten kayıtlı bir lead'de BOŞ olan alanlar, dosyada dolu geliyorsa
   tamamlanır. Var olan bilgi ASLA ezilmez — yalnızca boşluklar doldurulur.
   (Yetkili kişi sütunu eşleşmeden aktarılmış eski kayıtlar, aynı dosya tekrar
   seçilerek isimlerine kavuşsun diye.) */
const IMP_TAMAMLANABILIR = [
  ["contact",    "contact"],
  ["company",    "company"],
  ["email",      "email"],
  ["location",   "location"],
  ["port",       "port"],
  ["group",      "group_type"],
  ["tonnage",    "tonnage"],
  ["budget",     "budget"],
  ["timing",     "timing"],
  ["experience", "experience"],
  ["cinPaid",    "cin_paid"],
  ["ambalajBambu",     "ambalaj_bambu"],
  ["ambalajHijyen",    "ambalaj_hijyen"],
  ["ambalajPaketleme", "ambalaj_paketleme"],
  ["nalburiyeKategori", "nalburiye_kategori"],
  ["nalburiyeUrun",     "nalburiye_urun"],
];

function impEksikleri(dosyaLead, kayit) {
  const alanlar = {};
  IMP_TAMAMLANABILIR.forEach(([anahtar, kolon]) => {
    const yeniDeger = String(dosyaLead[anahtar] || "").trim();
    const eski = String(kayit[anahtar] || "").trim();
    if (yeniDeger && !eski) alanlar[kolon] = yeniDeger;
  });
  // Ürünler dizi olduğu için ayrı ele alınır. Damgasız/ürünsüz aktarılmış eski
  // kayıtlar, aynı dosya yeniden yüklendiğinde ürünlerine kavuşsun diye.
  if ((dosyaLead.products || []).length && !(kayit.products || []).length)
    alanlar.products = dosyaLead.products;
  // Ücret cevabı yeni geliyorsa sınıf da onunla birlikte tazelenir; aksi hâlde
  // kayıt cevabına kavuşur ama "Düşük" damgasıyla asılı kalırdı.
  if (alanlar.cin_paid && dosyaLead.klass) {
    alanlar.klass = dosyaLead.klass;
    alanlar.score = dosyaLead.score;
    alanlar.lead_group = dosyaLead.leadGroup;
  }
  return alanlar;
}

/* --- Önizleme --- */
function impOnizle() {
  const box = document.getElementById("impPreview");
  const btn = document.getElementById("impRun");
  if (!box) return;

  const leadler = IMP_SATIR.map(impSatirdanLead);

  // Çift kayıt: paneldeki mevcut leadler + dosya içi tekrarlar (telefona göre)
  const mevcut = new Map();
  (CACHE || []).forEach(l => {
    const t = impTelefonNorm(l.phone);
    if (t && !mevcut.has(t)) mevcut.set(t, l);
  });
  const dosyada = new Set();
  leadler.forEach(l => {
    const t = impTelefonNorm(l.phone);
    l._telefonYok = !t;
    l._cift = t ? (mevcut.has(t) || dosyada.has(t)) : false;
    l._tamamla = null;
    if (t && mevcut.has(t)) {
      const kayit = mevcut.get(t);
      const alanlar = impEksikleri(l, kayit);
      if (kayit.id && Object.keys(alanlar).length) {
        l._tamamla = { id: kayit.id, alanlar, ad: l.contact || l.company || t };
      }
    }
    if (t) dosyada.add(t);
  });

  const yeni = leadler.filter(l => !l._cift && !l._telefonYok);
  const tamamlanacak = leadler.filter(l => l._tamamla).map(l => l._tamamla);
  const cift = leadler.filter(l => l._cift).length;
  const telsiz = leadler.filter(l => l._telefonYok).length;
  const taninmayan = yeni.filter(l => !l._tonajTanindi || !l._butceTanindi).length;
  // Çin leadleri: sınıf ücret cevabından gelir, o yüzden ayrı uyarılır.
  const cinler = yeni.filter(l => l.group === "cin");
  const cinCevapsiz = cinler.filter(l => !l.cinPaid).length;
  const cinAnlasilmaz = cinler.filter(l => !l._cinPaidTanindi).length;

  window._IMP_YUKLENECEK = yeni;
  window._IMP_TAMAMLANACAK = tamamlanacak;

  let h = '<div class="fn-top">' +
    '<div class="fn-kpi"><b>' + leadler.length + '</b><span>dosyadaki satır</span></div>' +
    '<div class="fn-kpi"><b style="color:#1a7a45">' + yeni.length + '</b><span>eklenecek</span></div>' +
    (tamamlanacak.length ? '<div class="fn-kpi"><b style="color:#1a5fa8">' + tamamlanacak.length + '</b><span>tamamlanacak</span></div>' : "") +
    '<div class="fn-kpi"><b style="color:#c0392b">' + (cift + telsiz - tamamlanacak.length) + '</b><span>atlanacak</span></div>' +
    '</div>';

  if (impSabitGrupVar())
    h += '<p class="save-ok">🏷️ Bu dosyanın tamamı <b>' + escapeHtml(impGrupAdi(IMP_SABIT_GRUP)) + '</b> hizmetine işaretlenecek' +
      (IMP_ALGI_GEREKCE ? " — kampanya dosyadan tanındı" : "") + '.</p>';
  else if (!IMP_SABIT_GRUP)
    h += '<p class="form-err">⚠️ Bu dosyanın hangi hizmete ait olduğu <b>anlaşılamadı</b>. Yukarıdaki <b>hizmet</b> kutusundan seçin; ' +
      'seçmeden içe aktarma başlamaz (leadler "Belirtilmemiş" düşmesin diye).</p>';

  if (IMP_ESLES.contact == null)
    h += '<p class="form-err">⚠️ <b>Yetkili kişi</b> sütunu eşleşmedi — bu hâlde leadler <b>isimsiz</b> aktarılır. Yukarıdaki eşleştirmeden ad/soyad sütununu seçin.</p>';
  if (tamamlanacak.length)
    h += '<p class="row-hint">🔄 ' + tamamlanacak.length + ' kayıt zaten var ama bazı alanları boş; dosyadaki bilgilerle <b>tamamlanacak</b> (dolu alanlar değişmez).</p>';
  if (cift)   h += '<p class="row-hint">↩︎ ' + cift + ' satır zaten kayıtlı (aynı telefon), yeniden eklenmeyecek.</p>';
  if (telsiz) h += '<p class="row-hint">⚠️ ' + telsiz + ' satırda telefon yok — çift kontrolü yapılamadığı için atlanacak. Telefon sütununu doğru eşleştirdiğinizden emin olun.</p>';
  if (taninmayan) h += '<p class="fn-hint">⚠️ ' + taninmayan + ' satırda tonaj/bütçe cevabı tanınamadı. Bunlar yine eklenir ama <b>sınıflandırma boş kalır</b> (VIP/Sıcak hesaplanmaz). Aşağıdaki tabloda ⚠️ ile işaretli.</p>';

  // Çin leadlerinde tonaj yok; sınıfı ücret sorusunun cevabı belirler.
  if (cinler.length && IMP_ESLES.cinPaid == null)
    h += '<p class="form-err">⚠️ <b>Ücretli hizmet cevabı</b> sütunu eşleşmedi — ' + cinler.length +
      ' Çin leadi <b>sınıfsız</b> aktarılır (VIP/Sıcak/Düşük hesaplanmaz). Yukarıdaki eşleştirmeden ' +
      '“Devam etmek ister misiniz?” sorusunun sütununu seçin.</p>';
  else if (cinCevapsiz)
    h += '<p class="fn-hint">⚠️ ' + cinCevapsiz + ' Çin leadinde ücret sorusu cevapsız — sınıfları boş kalır, müşteri kartından elle işaretleyebilirsiniz.</p>';
  if (cinAnlasilmaz)
    h += '<p class="fn-hint">⚠️ ' + cinAnlasilmaz + ' Çin leadinde cevap <b>anlaşılamadı</b> (aşağıdaki tabloda ⚠️ ile işaretli). Bunlar da sınıfsız aktarılır.</p>';

  // Ambalaj leadleri: sınıf BÜTÇE cevabından geliyor (genel "budget" alanı),
  // 3 soru (bambu/hijyen/paketleme) salt bilgi amaçlı — eksik eşleşme uyarısı
  // Çin'deki kadar kritik değil, o yüzden tek satırlık ipucu yeter.
  const ambalajler = yeni.filter(l => l.group === "ambalaj");
  const ambalajSutun = IMP_ESLES.ambalajBambu != null || IMP_ESLES.ambalajHijyen != null || IMP_ESLES.ambalajPaketleme != null;
  if (ambalajler.length && !ambalajSutun)
    h += '<p class="fn-hint">⚠️ Ambalaj sorularının hiçbiri eşleşmedi — ' + ambalajler.length +
      ' leadin 3 cevabı da boş aktarılacak. Yukarıdaki eşleştirmeden 3 soru sütununu seçebilirsiniz.</p>';
  const ambalajButcesiz = ambalajler.filter(l => !l.budget).length;
  if (ambalajButcesiz)
    h += '<p class="fn-hint">⚠️ ' + ambalajButcesiz + ' Ambalaj leadinde bütçe cevabı tanınamadı — sınıfları boş kalır (bütçe bu hizmette sınıfı belirliyor).</p>';

  // Nalburiye leadleri: sınıf BÜTÇE cevabından geliyor (genel "budget" alanı),
  // o yüzden Çin'deki kadar kritik bir uyarı gerekmiyor — 2 bilgi sorusu için
  // Ambalaj'daki gibi tek satırlık ipucu yeter.
  const nalburiyeler = yeni.filter(l => l.group === "nalburiye");
  const nalburiyeSutun = IMP_ESLES.nalburiyeKategori != null || IMP_ESLES.nalburiyeUrun != null;
  if (nalburiyeler.length && !nalburiyeSutun)
    h += '<p class="fn-hint">⚠️ Nalburiye sorularının hiçbiri eşleşmedi — ' + nalburiyeler.length +
      ' leadin 2 cevabı da boş aktarılacak. Yukarıdaki eşleştirmeden soru sütunlarını seçebilirsiniz.</p>';
  const nalburiyeButcesiz = nalburiyeler.filter(l => !l.budget).length;
  if (nalburiyeButcesiz)
    h += '<p class="fn-hint">⚠️ ' + nalburiyeButcesiz + ' Nalburiye leadinde bütçe cevabı tanınamadı — sınıfları boş kalır (bütçe bu hizmette tonaj yerine sınıfı belirliyor).</p>';

  const gost = yeni.slice(0, 12);
  if (gost.length) {
    // "Ücret cevabı"/"Ambalaj cevapları"/"Nalburiye cevapları" sütunları yalnızca
    // dosyada o soru(lar) varsa gösterilir — diğer hizmet dosyalarında boş sütun yer kaplamasın.
    const cinSutun = IMP_ESLES.cinPaid != null || cinler.length > 0;
    h += '<div class="table-wrap" style="margin-top:12px"><table><thead><tr>' +
      '<th>Firma</th><th>Yetkili</th><th>Telefon</th><th>Grup</th><th>Ürün</th><th>Tonaj</th><th>Bütçe</th>' +
      (cinSutun ? '<th>Ücret cevabı</th>' : "") +
      (ambalajSutun ? '<th>Bambu</th><th>Hijyen</th><th>Ambalaj/paketleme</th>' : "") +
      (nalburiyeSutun ? '<th>Ana ürün grubu</th><th>Ürün detayı</th>' : "") +
      '<th>Sınıf</th></tr></thead><tbody>' +
      gost.map(l => '<tr>' +
        '<td>' + escapeHtml(l.company || "—") + '</td>' +
        '<td>' + escapeHtml(l.contact || "—") + '</td>' +
        '<td>' + escapeHtml(l.phone || "—") + '</td>' +
        '<td>' + escapeHtml(l.group || "—") + '</td>' +
        '<td>' + escapeHtml((l.products || []).join(", ") || "—") + '</td>' +
        '<td>' + (l._tonajTanindi ? escapeHtml(l.tonnage || "—") : '⚠️ ' + escapeHtml(l._tonajHam)) + '</td>' +
        '<td>' + (l._butceTanindi ? escapeHtml(l.budget || "—") : '⚠️ ' + escapeHtml(l._butceHam)) + '</td>' +
        (cinSutun ? '<td>' + (l._cinPaidTanindi ? escapeHtml(l.cinPaid || "—") : '⚠️ ' + escapeHtml(l.cinPaid)) + '</td>' : "") +
        (ambalajSutun ? '<td>' + escapeHtml(l.ambalajBambu || "—") + '</td>' +
          '<td>' + escapeHtml(l.ambalajHijyen || "—") + '</td>' +
          '<td>' + escapeHtml(l.ambalajPaketleme || "—") + '</td>' : "") +
        (nalburiyeSutun ? '<td>' + escapeHtml(l.nalburiyeKategori || "—") + '</td>' +
          '<td>' + escapeHtml(l.nalburiyeUrun || "—") + '</td>' : "") +
        '<td>' + escapeHtml(l.klass || "—") + '</td>' +
      '</tr>').join("") + '</tbody></table></div>';
    if (yeni.length > gost.length)
      h += '<p class="row-hint">… ve ' + (yeni.length - gost.length) + ' satır daha.</p>';
  }

  if (tamamlanacak.length) {
    const g = tamamlanacak.slice(0, 8);
    h += '<div class="table-wrap" style="margin-top:12px"><table><thead><tr>' +
      '<th>Mevcut kayıt</th><th>Tamamlanacak alanlar</th></tr></thead><tbody>' +
      g.map(t => '<tr><td>' + escapeHtml(t.ad) + '</td><td>' +
        escapeHtml(Object.entries(t.alanlar).map(([k, v]) => k + ": " + v).join(" • ")) +
        '</td></tr>').join("") + '</tbody></table></div>';
    if (tamamlanacak.length > g.length)
      h += '<p class="row-hint">… ve ' + (tamamlanacak.length - g.length) + ' kayıt daha.</p>';
  }

  box.innerHTML = h;
  if (btn) {
    // Hizmet belli değilse içe aktarma başlamaz: bu, leadlerin damgasız
    // kaydedilip panelde "Belirtilmemiş" yığınına düşmesinin tek sebebiydi.
    if (!IMP_SABIT_GRUP) {
      btn.disabled = true; btn.textContent = "Önce hizmet seçin";
      return;
    }
    btn.disabled = yeni.length === 0 && tamamlanacak.length === 0;
    if (yeni.length && tamamlanacak.length)
      btn.textContent = "⬆️ " + yeni.length + " lead ekle + " + tamamlanacak.length + " kaydı tamamla";
    else if (yeni.length)        btn.textContent = "⬆️ " + yeni.length + " lead'i içe aktar";
    else if (tamamlanacak.length) btn.textContent = "🔄 " + tamamlanacak.length + " kaydı tamamla";
    else                          btn.textContent = "Eklenecek lead yok";
  }
}

/* --- İçe aktar ---
   confirm()/alert() KULLANILMAZ. Sebep: Chrome'da bir kutu kapatılırken
   "bu sayfanın ek iletişim kutuları oluşturmasını engelle" işaretlenirse
   confirm() sessizce false döner ve içe aktarma hiç çalışmaz — kullanıcı
   butona basar, hiçbir şey olmaz, hata da görünmez. Onay zaten önizlemede
   veriliyor (kaç satır eklenecek yazıyor, buton da sayıyı söylüyor). */
async function impCalistir() {
  const leadler = window._IMP_YUKLENECEK || [];
  const tamamlanacak = window._IMP_TAMAMLANACAK || [];
  const box = document.getElementById("impPreview");
  const btn = document.getElementById("impRun");

  if (!leadler.length && !tamamlanacak.length) {
    if (box) box.innerHTML = '<p class="form-err">Eklenecek lead yok. Önce dosya seçin.</p>';
    return;
  }

  const eski = btn.textContent;
  btn.disabled = true; btn.textContent = "Ekleniyor…";

  const satirlar = leadler.map((l, i) => {
    const r = {
      ref_no: "IMP-" + Date.now().toString().slice(-8) + "-" + i,
      company: l.company, contact: l.contact, phone: l.phone, whatsapp: l.whatsapp,
      email: l.email, location: l.location, port: l.port,
      group_type: l.group,
      tonnage: l.tonnage, budget: l.budget, timing: l.timing, experience: l.experience,
      products: l.products || [], score: l.score, klass: l.klass, lead_group: l.leadGroup,
      wa_shown: l.showWhatsapp, meeting_shown: l.showMeeting,
      // Çin hizmetindeki ücret sorusunun cevabı. Kolon henüz açılmamışsa
      // sbAdminInsertMany bu alanı düşürüp tekrar dener (bkz. SB_YENI_KOLONLAR).
      cin_paid: l.cinPaid || null,
      ambalaj_bambu: l.ambalajBambu || null,
      ambalaj_hijyen: l.ambalajHijyen || null,
      ambalaj_paketleme: l.ambalajPaketleme || null,
      nalburiye_kategori: l.nalburiyeKategori || null,
      nalburiye_urun: l.nalburiyeUrun || null,
      // Kolon adı "status" (lead_status DEĞİL): admin.js yeni CRM alanlarını
      // lead_status'a yazmaya çalışıyor ama o kolon Supabase'de yok. Buradan
      // lead_status gönderilirse PGRST204 ile TÜM içe aktarma başarısız olur.
      status: "Yeni lead",
      // Hangi kampanyadan geldiği kayıtta kalsın
      notes: "Meta reklamından içe aktarıldı" + (impSabitGrupVar() ? " — " + impGrupAdi(IMP_SABIT_GRUP) : ""),
    };
    const t = Date.parse(l.createdAt);
    if (!isNaN(t)) r.created_at = new Date(t).toISOString();
    return r;
  });

  const res = satirlar.length ? await sbAdminInsertMany(satirlar) : { eklenen: 0, error: null };
  btn.disabled = false; btn.textContent = eski;

  if (res.error) {
    // Hata hâlinde dosya ve önizleme DURUR: kullanıcı sütun eşleştirmesini
    // düzeltip tekrar deneyebilsin, baştan dosya seçmek zorunda kalmasın.
    box.innerHTML = '<p class="form-err">İçe aktarma hatası: ' + escapeHtml(res.error) + '</p>' +
      (res.eklenen ? '<p class="row-hint">' + res.eklenen + ' lead eklendikten sonra durdu.</p>' : "") +
      box.innerHTML;
    return;
  }

  // Mevcut kayıtların boş alanlarını tamamla (isim vb.). Tek tek gider;
  // biri hata verirse kalanlar denenmeye devam eder, sonunda rapor edilir.
  let guncellenen = 0, guncelHata = "";
  for (const t of tamamlanacak) {
    btn.textContent = "Tamamlanıyor… " + (guncellenen + 1) + "/" + tamamlanacak.length;
    const u = await sbAdminUpdate(t.id, t.alanlar);
    if (u.error) { guncelHata = u.error; break; }
    guncellenen++;
  }
  btn.textContent = eski;

  document.getElementById("impFile").value = "";
  document.getElementById("impMap").innerHTML = "";
  IMP_BASLIK = []; IMP_SATIR = []; IMP_ESLES = {};
  // Hizmet damgası da sıfırlanır: sıradaki dosya, kendi kampanyası tanınmadan
  // sessizce bu dosyanın hizmetine yazılmasın.
  IMP_SABIT_GRUP = ""; IMP_ALGI_GEREKCE = "";
  const gs = document.getElementById("impGroup");
  if (gs) { gs.value = ""; impGrupIpucu(); }
  window._IMP_YUKLENECEK = []; window._IMP_TAMAMLANACAK = [];
  btn.disabled = true; btn.textContent = "Önce dosya seçin";

  box.innerHTML =
    (guncelHata ? '<p class="form-err">Güncelleme hatası: ' + escapeHtml(guncelHata) + '</p>' : "") +
    '<p class="save-ok">✓ ' + res.eklenen + ' lead eklendi' +
    (guncellenen ? ', ' + guncellenen + ' kaydın eksik bilgileri tamamlandı' : "") +
    '. Aşağıdaki listede görünüyorlar.</p>';
  await renderAll();
}

/* --- Dosya seçildiğinde --- */
async function impDosyaSecildi(e) {
  const dosya = e.target.files && e.target.files[0];
  if (!dosya) return;
  const box = document.getElementById("impPreview");
  box.innerHTML = '<p class="muted">Okunuyor…</p>';
  try {
    const satirlar = await impDosyaOku(dosya);
    if (satirlar.length < 2) { box.innerHTML = '<p class="form-err">Dosyada veri satırı bulunamadı.</p>'; return; }
    IMP_BASLIK = satirlar[0].map(x => String(x).trim());
    IMP_SATIR  = satirlar.slice(1);
    impOtoEslestir();
    impEslesCiz();

    // Hizmeti dosyanın kendisinden bul; kutu elle doldurulmasın diye.
    const algi = impKampanyaTani();
    IMP_SABIT_GRUP   = algi ? algi.grup : "";
    IMP_ALGI_GEREKCE = algi ? algi.gerekce : "";
    const gs = document.getElementById("impGroup");
    if (gs) gs.value = IMP_SABIT_GRUP;
    impGrupIpucu();

    impOnizle();
  } catch (err) {
    box.innerHTML = '<p class="form-err">Dosya okunamadı: ' + escapeHtml(String(err.message || err)) + '</p>';
  }
}
