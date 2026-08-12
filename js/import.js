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
  if (/hepsi|tümü|tumu|birden_?fazla|hepsini/.test(s)) return "hepsi";
  if (/bakliyat|fasulye|mercimek|nohut/.test(s))       return "bakliyat";
  if (/deniz|balık|balik|su_?ürün|su_?urun/.test(s))   return "deniz";
  if (/sebze/.test(s))                                 return "sebze";
  if (/meyve/.test(s))                                 return "meyve";
  return "";
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

  const state = {
    company: al("company"), contact: al("contact"), phone: tel,
    whatsapp: tel, email: al("email"),
    location: al("location"), port: al("port"),
    group: impGrupEsle(al("group")),
    tonnage: tonaj, budget: butce,
    timing: al("timing"), experience: al("experience"),
    products: [],
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
];

function impEksikleri(dosyaLead, kayit) {
  const alanlar = {};
  IMP_TAMAMLANABILIR.forEach(([anahtar, kolon]) => {
    const yeniDeger = String(dosyaLead[anahtar] || "").trim();
    const eski = String(kayit[anahtar] || "").trim();
    if (yeniDeger && !eski) alanlar[kolon] = yeniDeger;
  });
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

  window._IMP_YUKLENECEK = yeni;
  window._IMP_TAMAMLANACAK = tamamlanacak;

  let h = '<div class="fn-top">' +
    '<div class="fn-kpi"><b>' + leadler.length + '</b><span>dosyadaki satır</span></div>' +
    '<div class="fn-kpi"><b style="color:#1a7a45">' + yeni.length + '</b><span>eklenecek</span></div>' +
    (tamamlanacak.length ? '<div class="fn-kpi"><b style="color:#1a5fa8">' + tamamlanacak.length + '</b><span>tamamlanacak</span></div>' : "") +
    '<div class="fn-kpi"><b style="color:#c0392b">' + (cift + telsiz - tamamlanacak.length) + '</b><span>atlanacak</span></div>' +
    '</div>';

  if (IMP_ESLES.contact == null)
    h += '<p class="form-err">⚠️ <b>Yetkili kişi</b> sütunu eşleşmedi — bu hâlde leadler <b>isimsiz</b> aktarılır. Yukarıdaki eşleştirmeden ad/soyad sütununu seçin.</p>';
  if (tamamlanacak.length)
    h += '<p class="row-hint">🔄 ' + tamamlanacak.length + ' kayıt zaten var ama bazı alanları boş; dosyadaki bilgilerle <b>tamamlanacak</b> (dolu alanlar değişmez).</p>';
  if (cift)   h += '<p class="row-hint">↩︎ ' + cift + ' satır zaten kayıtlı (aynı telefon), yeniden eklenmeyecek.</p>';
  if (telsiz) h += '<p class="row-hint">⚠️ ' + telsiz + ' satırda telefon yok — çift kontrolü yapılamadığı için atlanacak. Telefon sütununu doğru eşleştirdiğinizden emin olun.</p>';
  if (taninmayan) h += '<p class="fn-hint">⚠️ ' + taninmayan + ' satırda tonaj/bütçe cevabı tanınamadı. Bunlar yine eklenir ama <b>sınıflandırma boş kalır</b> (VIP/Sıcak hesaplanmaz). Aşağıdaki tabloda ⚠️ ile işaretli.</p>';

  const gost = yeni.slice(0, 12);
  if (gost.length) {
    h += '<div class="table-wrap" style="margin-top:12px"><table><thead><tr>' +
      '<th>Firma</th><th>Yetkili</th><th>Telefon</th><th>Grup</th><th>Tonaj</th><th>Bütçe</th><th>Sınıf</th></tr></thead><tbody>' +
      gost.map(l => '<tr>' +
        '<td>' + escapeHtml(l.company || "—") + '</td>' +
        '<td>' + escapeHtml(l.contact || "—") + '</td>' +
        '<td>' + escapeHtml(l.phone || "—") + '</td>' +
        '<td>' + escapeHtml(l.group || "—") + '</td>' +
        '<td>' + (l._tonajTanindi ? escapeHtml(l.tonnage || "—") : '⚠️ ' + escapeHtml(l._tonajHam)) + '</td>' +
        '<td>' + (l._butceTanindi ? escapeHtml(l.budget || "—") : '⚠️ ' + escapeHtml(l._butceHam)) + '</td>' +
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
      products: [], score: l.score, klass: l.klass, lead_group: l.leadGroup,
      wa_shown: l.showWhatsapp, meeting_shown: l.showMeeting,
      // Kolon adı "status" (lead_status DEĞİL): admin.js yeni CRM alanlarını
      // lead_status'a yazmaya çalışıyor ama o kolon Supabase'de yok. Buradan
      // lead_status gönderilirse PGRST204 ile TÜM içe aktarma başarısız olur.
      status: "Yeni lead",
      notes: "Meta reklamından içe aktarıldı",
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
    impOnizle();
  } catch (err) {
    box.innerHTML = '<p class="form-err">Dosya okunamadı: ' + escapeHtml(String(err.message || err)) + '</p>';
  }
}
