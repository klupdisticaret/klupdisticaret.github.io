/* =============================================================
   YÖNETİM PANELİ (CRM)  — Aa.txt madde 17,18,19,20
   Supabase hesabıyla giriş → merkezi leadler.
   Müşteri kartı: tüm bilgiler + durum + admin notu + takip tarihi.
   Filtreler + durum dağılımı. Supabase yoksa localStorage yedeği.
   ============================================================= */

const STORAGE_KEY = "klup_leads";
const gate = document.getElementById("gate");
const admin = document.getElementById("admin");
const pwErr = document.getElementById("pwErr");
let CACHE = [];
let activeStatus = "Tümü";
let activeAction = "Tüm aksiyonlar";
let activeCallResult = "Tümü";   // "Arama sonucu" filtresi (CALL_RESULT_FILTERS)
let activeNextAction = "Tümü";   // "Sonraki aksiyon" filtresi (NEXT_ACTION_FILTERS)
let activeGroup = "tumu";   // ürün grubu filtresi (aşağıdaki GROUP_FILTERS anahtarları)
let activeClass = "tumu";   // sınıf filtresi (aşağıdaki CLASS_FILTERS anahtarları)
let classSort = 0;          // 0 = tarihe göre, 1 = VIP üstte, -1 = Düşük üstte
let SELECTED = new Set();   // çoklu seçim: lead anahtarları (Supabase'de id, yereldeyse refNo)

// Supabase kaydında id, localStorage yedeğinde refNo tekil anahtardır.
const leadKey = l => (l.id != null ? l.id : l.refNo);

const RLS_UYARI =
  "Silinemedi — 0 satır etkilendi.\n\n" +
  "Supabase'de leads tablosu için DELETE politikası tanımlı değil, " +
  "bu yüzden silme isteği sessizce reddediliyor.\n\n" +
  "Çözüm: Supabase → SQL Editor'de DELETE politikasını ekle " +
  "(SUPABASE-KURULUM.md içindeki SQL).";

// Lead durumları (yeni CRM akışı)
const STATUSES = [
  "Yeni lead", "İncelenecek", "Whatsapptan bilgi gönderildi", "Cevap bekleniyor", "Ulaşılamadı", "Görüşme yapıldı",
  "Potansiyel müşteri", "Teklif hazırlanıyor", "Teklif gönderildi", "Karar bekleniyor", "Siparişe döndü", "Kapatıldı",
];
// Kart alanı seçenekleri
const CALL_RESULTS  = ["Seçilmedi","Ulaşıldı","Ulaşılamadı","Meşgul / sonra","Geri aranacak","Yanlış numara","İlgilenmiyor"];
const NEXT_ACTIONS  = ["Seçilmedi","Ara","WhatsApp gönder","Teklif hazırla","Teklif gönder","Toplantı planla","Numune/evrak iste","Takibe al","Kapat"];
// "Tüm Lead'ler" panelindeki filtre satırları (karttaki callResult / nextAction alanına göre süzer)
const CALL_RESULT_FILTERS = ["Tümü", ...CALL_RESULTS];
const NEXT_ACTION_FILTERS = ["Tümü", ...NEXT_ACTIONS];
const CLOSE_REASONS = ["Seçilmedi","Fiyat yüksek","Rakip firmayı seçti","Zamanlama uygun değil","İlgilenmiyor","Ulaşılamadı","Bütçe yetersiz","Diğer"];

// funnel'dan gelen eski status alanı için (geriye uyum; leadStatus'tan ayrı)
function normStatus(s) {
  if (!s || s === "Yeni") return "Yeni lead";
  if (s === "Toplantı Planlandı") return "Toplantı planlandı";
  return s;
}
// Eski "WhatsApp gönderildi" lead durumu yeni ada çevrilir (geriye uyum)
function normLeadStatus(s) {
  if (s === "WhatsApp gönderildi" || s === "Whatsapptan gönderildi") return "Whatsapptan bilgi gönderildi";
  return s || "İncelenecek";
}
// leadStatus -> renk sınıfı
function statusClass(s) {
  return {
    "Yeni lead":"ls-yeni", "İncelenecek":"ls-incele", "Whatsapptan bilgi gönderildi":"ls-wa",
    "Cevap bekleniyor":"ls-cevap", "Görüşme yapıldı":"ls-gorusme", "Potansiyel müşteri":"ls-potansiyel",
    "Teklif hazırlanıyor":"ls-thaz",
    "Teklif gönderildi":"ls-tgon", "Karar bekleniyor":"ls-karar", "Siparişe döndü":"ls-siparis",
    "Ulaşılamadı":"ls-ulasilamaz",
    "Kapatıldı":"ls-kapali",
  }[s] || "ls-incele";
}
// Bugün (YYYY-AA-GG)
function todayStr() { const d = new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }

// Lead durumu filtreleri
const STATUS_FILTERS = ["Tümü","Yeni lead","İncelenecek","Whatsapptan bilgi gönderildi","Potansiyel müşteri","Cevap bekleniyor","Ulaşılamadı","Teklif hazırlanıyor","Teklif gönderildi","Karar bekleniyor","Siparişe döndü","Kapatıldı"];
// Aksiyon filtreleri (takip tarihine göre)
const ACTION_FILTERS = ["Tüm aksiyonlar","Bugün takip edilecekler","Geciken takipler","Takip tarihi olmayanlar"];

/* --- Sınıf filtreleri + sıralama ---
   klass: lead.klass alanındaki tam değer ("" = hiç sınıflanmamış lead).
   CLASS_ORDER, "Sınıf" sütun başlığına basınca kullanılan öncelik sırası:
   küçük numara üstte kalır. */
const CLASS_FILTERS = [
  { key: "tumu",  label: "Tümü" },
  { key: "vip",   label: "👑 VIP",   klass: "VIP Lead" },
  { key: "sicak", label: "🔥 Sıcak", klass: "Sıcak Lead" },
  { key: "takip", label: "👀 Takip", klass: "Takip Edilecek Lead" },
  { key: "dusuk", label: "❄️ Düşük", klass: "Düşük Öncelikli Lead" },
  { key: "yok",   label: "Sınıfsız", klass: "" },   // sayısı 0 ise gizlenir
];
const CLASS_ORDER = {
  "VIP Lead": 0, "Sıcak Lead": 1, "Takip Edilecek Lead": 2,
  "Düşük Öncelikli Lead": 3, "Düşük Lead": 3, "": 4,
};
// Sıralama açıkken tabloya giren blok başlıkları
const CLASS_BLOK = {
  "VIP Lead": "👑 VIP Lead", "Sıcak Lead": "🔥 Sıcak Lead",
  "Takip Edilecek Lead": "👀 Takip Edilecek Lead",
  "Düşük Öncelikli Lead": "❄️ Düşük Öncelikli Lead",
  "Düşük Lead": "❄️ Düşük Öncelikli Lead", "": "Sınıfsız",
};
const classRank = l => (CLASS_ORDER[l.klass || ""] != null ? CLASS_ORDER[l.klass || ""] : 4);

/* --- Ürün grubu filtreleri ---
   key: lead.group alanındaki değer ("tumu" ve "yok" sanal anahtarlardır).
   "hepsi" seçen müşteri ayrı butonda listelenir; tek tek grup filtrelerinde çıkmaz. */
const GROUP_FILTERS = [
  { key: "tumu",     label: "Tümü" },
  { key: "hepsi",    label: "📦 Ambalaj 1" },   // etikette "Ambalaj 1"; veri anahtarı "hepsi" olarak korunuyor
  { key: "cin",      label: "🏮 Çin'den Ürün Getirme" },  // ayrı hizmet (dondurulmuş gıda değil)
  { key: "ambalaj",  label: "📦 Ambalaj Sarf Malzemeleri" },  // ayrı hizmet; 3 bilgi sorusu + bütçeye göre sınıflandırma VAR
  { key: "nalburiye", label: "🔧 Çin'den Nalburiye ve İnşaat Hırdavatı" },  // ayrı hizmet; bütçe + 2 bilgi sorusu, bütçeye göre sınıflandırma VAR
  { key: "yok",      label: "Belirtilmemiş" },   // sayısı 0 ise gizlenir
];
// Tabloda ve grup sütununda gösterilecek kısa etiketler
// (Not: 🫘 ❔ 🇨🇳 Windows 10 emoji fontunda yok, kutu olarak çıkıyor — kullanmıyoruz.)
const GROUP_SHORT = { hepsi:"📦 Ambalaj 1", cin:"🏮 Çin", ambalaj:"📦 Ambalaj", nalburiye:"🔧 Nalburiye" };

/* İş Nalburiye/Çin/Ambalaj yönüne çevrildi. Dondurulmuş gıda gruplarına
   (meyve/sebze/deniz/bakliyat) ait eski leadler panelde HİÇ gösterilmez:
   ne tabloda, ne sayaçlarda, ne üst panelde, ne funnel'da (bkz. renderAll).
   Kayıtlar silinmez; yalnızca gizlenir. */
const RETIRED_GROUPS = ["meyve", "sebze", "deniz", "bakliyat"];

/* Ambalaj Sarf Malzemeleri hizmetinin 3 sorusu. Sıra sabit: kartta, tabloda ve
   içe aktarma eşleştirmesinde hep bu sırayla gösterilir. */
const AMBALAJ_SORULAR = [
  { key: "ambalajBambu",     soru: "Hangi bambu sarf ambalaj malzemelerini getirmek istiyorsunuz?" },
  { key: "ambalajHijyen",    soru: "Hangi temizlik hijyen sarf malzemelerini getirmek istiyorsunuz?" },
  { key: "ambalajPaketleme", soru: "Hangi ambalaj ve paketleme malzemelerini getirmek istiyorsunuz?" },
];

/* Nalburiye hizmetinin bütçe DIŞINDAKİ 2 bilgi amaçlı sorusu (bütçe zaten
   normal "Bütçe" alanı — sınıflandırmayı o belirliyor, bkz. scoring.js). */
const NALBURIYE_SORULAR = [
  { key: "nalburiyeKategori", soru: "Hangi ana ürün grubu ile ilgileniyorsunuz?" },
  { key: "nalburiyeUrun",     soru: "İlgilendiğiniz ürünü veya ürünleri kısaca yazınız." },
];
// Geçerli grup/hizmet anahtarları ("tumu" ve "yok" sanaldır, listede yer almaz)
const GROUP_KEYS = GROUP_FILTERS.filter(g => g.key !== "tumu" && g.key !== "yok").map(g => g.key);

/* Müşteri kartındaki "Ürün grubu / Hizmet" açılır listesi.
   Tanımadığımız bir değer kayıtlıysa (eski/elle girilmiş) listeye olduğu gibi
   eklenir — kart açılıp kaydedildiğinde o bilgi silinmesin diye. */
function groupOpt(secili) {
  const s = String(secili || "");
  const sec = v => (v === s ? " selected" : "");
  let h = `<option value=""${sec("")}>— Belirtilmemiş —</option>`;
  h += GROUP_FILTERS.filter(g => g.key !== "tumu" && g.key !== "yok")
        .map(g => `<option value="${g.key}"${sec(g.key)}>${escapeHtml(g.label)}</option>`).join("");
  if (s && !GROUP_KEYS.includes(s)) h += `<option value="${escapeHtml(s)}" selected>${escapeHtml(s)}</option>`;
  return h;
}

/* Bir metin Çin'den ürün getirme talebinden mi söz ediyor?
   Kampanya adı ("TR_Cinden_Urun_Getirme"), grup sütunu ve serbest metin ürün
   cevabı için ortak ölçüt — import.js de bunu kullanır.
   Sözcük sınırına bakılır: düz "cin" araması "ürün cinsi" gibi masum
   başlıkları da Çin sanıyordu. */
function cinMetniMi(metin) {
  const s = String(metin || "").toLocaleLowerCase("tr").replace(/[_\-.]+/g, " ");
  return /(^|[^a-zçğıöşü])(çin|cin|china)(den|dan|de|da|li|lı|e|i)?([^a-zçğıöşü]|$)/.test(s);
}

/* Lead'in ürün grubunu döndürür.
   group_type boşsa (çoğu Meta/CSV içe aktarması böyle) seçilen ürünlerden
   tahmin edilir: "Karides" → deniz, "Brokoli" → sebze… Birden fazla farklı
   gruba ait ürün varsa "hepsi" kabul edilir. Hiçbiri tutmazsa "yok". */
function leadGroupOf(l) {
  const g = String(l.group || "").toLocaleLowerCase("tr");
  if (GROUP_KEYS.includes(g)) return g;

  const urunler = l.products || [];
  // Damgası eksik kalmış Çin leadleri kendiliğinden yerine otursun: ürün cevabında
  // ya da grup alanında "Çin'den …" geçiyorsa bu bir Çin talebidir. Dondurulmuş
  // gıda tahmininden ÖNCE bakılır (ayrı hizmet, ürün listesiyle ilgisi yok).
  if (cinMetniMi(l.group) || cinMetniMi(urunler.join(" "))) return "cin";

  if (urunler.length && typeof PRODUCTS !== "undefined" && typeof normalizeTR === "function") {
    const bulunan = new Set();
    urunler.forEach(u => {
      const n = normalizeTR(u);
      const p = PRODUCTS.find(x => normalizeTR(x.name) === n);
      if (p) bulunan.add(p.type);
    });
    if (bulunan.size === 1) return [...bulunan][0];
    if (bulunan.size > 1)   return "hepsi";
  }
  return "yok";
}

/* --- Giriş / oturum --- */
async function tryLogin() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("pw").value;
  pwErr.hidden = true;
  if (!sb) { showPanel(); return; }
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { pwErr.hidden = false; pwErr.textContent = "Giriş başarısız: " + error.message; return; }
  showPanel();
}
async function logout() {
  if (sb) { try { await sb.auth.signOut(); } catch (e) {} }
  location.reload();
}
function showPanel() { gate.hidden = true; admin.hidden = false; renderFilters(); renderAll(); initAvail(); }

document.getElementById("loginBtn").addEventListener("click", tryLogin);
document.getElementById("pw").addEventListener("keydown", e => { if (e.key === "Enter") tryLogin(); });
document.getElementById("email").addEventListener("keydown", e => { if (e.key === "Enter") tryLogin(); });
document.getElementById("logoutBtn").addEventListener("click", logout);

(async function () {
  if (sb) {
    try { const { data } = await sb.auth.getSession(); if (data && data.session) showPanel(); } catch (e) {}
  }
})();

/* --- Veri çekme --- */
function rowToLead(r) {
  return {
    id: r.id, createdAt: r.created_at, refNo: r.ref_no,
    group: r.group_type, products: r.products || [],
    tonnage: r.tonnage, budget: r.budget, timing: r.timing, experience: r.experience,
    company: r.company, contact: r.contact, phone: r.phone, whatsapp: r.whatsapp,
    email: r.email, location: r.location, port: r.port,
    score: r.score, klass: r.klass, leadGroup: r.lead_group,
    waShown: r.wa_shown, meetingShown: r.meeting_shown,
    selectedSlot: r.selected_slot, status: normStatus(r.status),
    // Yeni CRM alanları (yoksa varsayılan — eski kayıtlar bozulmaz)
    leadStatus: normLeadStatus(r.lead_status),
    callResult: r.call_result || "Seçilmedi",
    nextAction: r.next_action || "Seçilmedi",
    followUpDate: r.next_followup || "",
    closeReason: r.close_reason || "",
    adminNote: r.notes || "",
    // Çin hizmetindeki ücret sorusunun cevabı (kolon yoksa boş — panel bozulmaz)
    cinPaid: r.cin_paid || "",
    // Ambalaj Sarf Malzemeleri hizmetinin 3 sorusunun cevabı (kolon yoksa boş)
    ambalajBambu: r.ambalaj_bambu || "",
    ambalajHijyen: r.ambalaj_hijyen || "",
    ambalajPaketleme: r.ambalaj_paketleme || "",
    // Nalburiye hizmetinin bütçe dışındaki 2 sorusunun cevabı (kolon yoksa boş)
    nalburiyeKategori: r.nalburiye_kategori || "",
    nalburiyeUrun: r.nalburiye_urun || "",
  };
}
function localLeads() {
  try {
    return (JSON.parse(localStorage.getItem(STORAGE_KEY)) || []).map(l =>
      Object.assign({ status: "Yeni lead", notes: "", nextFollowup: "",
        leadStatus: "İncelenecek", callResult: "Seçilmedi", nextAction: "Seçilmedi",
        followUpDate: l.nextFollowup || "", closeReason: "", adminNote: l.notes || "",
        cinPaid: l.cinPaid || "",
        ambalajBambu: l.ambalajBambu || "", ambalajHijyen: l.ambalajHijyen || "",
        ambalajPaketleme: l.ambalajPaketleme || "",
        nalburiyeKategori: l.nalburiyeKategori || "", nalburiyeUrun: l.nalburiyeUrun || "",
        leadGroup: l.leadGroup, waShown: l.showWhatsapp, meetingShown: l.showMeeting },
        l, { status: normStatus(l.status), leadStatus: normLeadStatus(l.leadStatus) }));
  } catch (e) { return []; }
}

async function loadLeads() {
  const note = document.getElementById("sourceNote");
  if (sb) {
    const { data, error } = await sb.from("leads").select("*").order("created_at", { ascending: false });
    if (error) {
      note.innerHTML = "⚠️ Veritabanı okunamadı: <b>" + escapeHtml(error.message) + "</b>. " +
        "SUPABASE-KURULUM.md'deki SQL'i çalıştırdın mı? (Şimdilik bu tarayıcıdaki kayıtlar gösteriliyor.)";
      return localLeads();
    }
    note.innerHTML = "✅ Merkezi veritabanı (Supabase) — toplam <b>" + data.length + "</b> lead.";
    return data.map(rowToLead);
  }
  note.innerHTML = "ℹ️ Supabase bağlı değil; yalnızca bu tarayıcıdaki kayıtlar gösteriliyor.";
  return localLeads();
}

async function renderAll() {
  CACHE = await loadLeads();
  // Dondurulmuş gıda gruplarına ait eski leadler tamamen gizlenir (bkz. RETIRED_GROUPS).
  CACHE = CACHE.filter(l => !RETIRED_GROUPS.includes(leadGroupOf(l)));
  // Artık var olmayan (silinmiş) leadler seçimde asılı kalmasın
  const mevcut = new Set(CACHE.map(leadKey));
  SELECTED.forEach(k => { if (!mevcut.has(k)) SELECTED.delete(k); });
  renderPanels();
  renderFilters();
  renderTable(getFiltered());
  renderFunnel();
}

/* Üst panel: özet kartları + dağılım çubukları. Hepsi seçili ürün grubuna
   (statsScope) göre çizilir; ürün grubu değişince yeniden çağrılır. */
function renderPanels() {
  const s = statsScope();
  renderStats(s);
  renderStatusDist(s);
  renderClassDist(s);
  renderProductDist(s);
  renderFieldDist("distTonnage", s, "tonnage");
  renderFieldDist("distBudget", s, "budget");
}

function matchStatusFilter(l) { return activeStatus === "Tümü" || l.leadStatus === activeStatus; }
function matchActionFilter(l) {
  const t = todayStr();
  if (activeAction === "Tüm aksiyonlar") return true;
  if (activeAction === "Bugün takip edilecekler") return l.followUpDate === t;
  if (activeAction === "Geciken takipler") return l.followUpDate && l.followUpDate < t;
  if (activeAction === "Takip tarihi olmayanlar") return !l.followUpDate;
  return true;
}
function matchCallResultFilter(l) { return activeCallResult === "Tümü" || (l.callResult || "Seçilmedi") === activeCallResult; }
function matchNextActionFilter(l) { return activeNextAction === "Tümü" || (l.nextAction || "Seçilmedi") === activeNextAction; }
function matchGroupFilter(l) { return activeGroup === "tumu" || leadGroupOf(l) === activeGroup; }
/* Üst panelin (özet kartları + dağılım çubukları + durum/sınıf/aksiyon filtre
   rozetleri) kapsamı: yalnızca seçili ÜRÜN GRUBUNUN leadleri. Grup "Tümü" ise
   tüm leadler. Ürün grubu butonlarının kendi sayıları (groupCount) bundan
   etkilenmez — orası grup büyüklüğünü göstermeye devam eder. */
function statsScope() { return activeGroup === "tumu" ? CACHE : CACHE.filter(matchGroupFilter); }
function matchClassFilter(l) {
  if (activeClass === "tumu") return true;
  const f = CLASS_FILTERS.find(x => x.key === activeClass);
  return !!f && (l.klass || "") === f.klass;
}
function getFiltered() {
  const list = CACHE.filter(l =>
    matchStatusFilter(l) && matchActionFilter(l) && matchGroupFilter(l) && matchClassFilter(l)
    && matchCallResultFilter(l) && matchNextActionFilter(l));
  // Sınıf sıralaması kapalıyken liste veritabanından geldiği gibi (yeniden eskiye) kalır.
  if (classSort !== 0) {
    list.sort((a, b) => {
      const fark = classRank(a) - classRank(b);
      if (fark !== 0) return classSort * fark;
      // Aynı sınıf içinde yine yeniden eskiye
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
  }
  return list;
}

// Bu rozet sayıları seçili ürün grubu içinde sayılır (statsScope); groupCount hariç.
function statusCount(name) { const s = statsScope(); return name === "Tümü" ? s.length : s.filter(l => l.leadStatus === name).length; }
function groupCount(key) { return key === "tumu" ? CACHE.length : CACHE.filter(l => leadGroupOf(l) === key).length; }
function classCount(key) {
  const s = statsScope();
  if (key === "tumu") return s.length;
  const f = CLASS_FILTERS.find(x => x.key === key);
  return f ? s.filter(l => (l.klass || "") === f.klass).length : 0;
}
function actionCount(name) {
  const t = todayStr();
  const s = statsScope();
  if (name === "Tüm aksiyonlar") return s.length;
  if (name === "Bugün takip edilecekler") return s.filter(l => l.followUpDate === t).length;
  if (name === "Geciken takipler") return s.filter(l => l.followUpDate && l.followUpDate < t).length;
  return s.filter(l => !l.followUpDate).length;
}
function callResultCount(name) { const s = statsScope(); return name === "Tümü" ? s.length : s.filter(l => (l.callResult || "Seçilmedi") === name).length; }
function nextActionCount(name) { const s = statsScope(); return name === "Tümü" ? s.length : s.filter(l => (l.nextAction || "Seçilmedi") === name).length; }

/* --- Filtre butonları (durum + aksiyon) --- */
function renderFilters() {
  const gf = document.getElementById("groupFilters");
  if (gf) {
    gf.innerHTML = "";
    GROUP_FILTERS.forEach(({ key, label }) => {
      const n = groupCount(key);
      // "Belirtilmemiş" ve "Ambalaj 1" (key: "hepsi") butonları, o grupta lead yoksa yer kaplamasın.
      // (Ama seçili durumdaysa gizlemeyiz; yoksa aktif filtre görünmez olur.)
      if (n === 0 && key !== activeGroup && (key === "yok" || key === "hepsi")) return;
      const b = document.createElement("button");
      b.className = "filter-btn" + (key === activeGroup ? " is-active" : "");
      b.innerHTML = escapeHtml(label) + ` <span class="cnt">${n}</span>`;
      b.addEventListener("click", () => { activeGroup = key; renderPanels(); renderFilters(); renderTable(getFiltered()); });
      gf.appendChild(b);
    });
  }
  const sf = document.getElementById("filters");
  if (sf) {
    sf.innerHTML = "";
    STATUS_FILTERS.forEach(name => {
      const b = document.createElement("button");
      b.className = "filter-btn" + (name === activeStatus ? " is-active" : "");
      b.innerHTML = escapeHtml(name) + ` <span class="cnt">${statusCount(name)}</span>`;
      b.addEventListener("click", () => { activeStatus = name; renderFilters(); renderTable(getFiltered()); });
      sf.appendChild(b);
    });
  }
  const cf = document.getElementById("classFilters");
  if (cf) {
    cf.innerHTML = "";
    CLASS_FILTERS.forEach(({ key, label }) => {
      const n = classCount(key);
      // Hiç sınıflanmamış lead yoksa "Sınıfsız" butonu yer kaplamasın
      if (n === 0 && key === "yok" && key !== activeClass) return;
      const b = document.createElement("button");
      b.className = "filter-btn" + (key === activeClass ? " is-active" : "");
      b.innerHTML = escapeHtml(label) + ` <span class="cnt">${n}</span>`;
      b.addEventListener("click", () => { activeClass = key; renderFilters(); renderTable(getFiltered()); });
      cf.appendChild(b);
    });
  }
  const crf = document.getElementById("callResultFilters");
  if (crf) {
    crf.innerHTML = "";
    CALL_RESULT_FILTERS.forEach(name => {
      const n = callResultCount(name);
      // Hiç kaydı olmayan seçenek yer kaplamasın (seçili ya da "Tümü" ise kalır)
      if (n === 0 && name !== activeCallResult && name !== "Tümü") return;
      const b = document.createElement("button");
      b.className = "filter-btn" + (name === activeCallResult ? " is-active" : "");
      b.innerHTML = escapeHtml(name) + ` <span class="cnt">${n}</span>`;
      b.addEventListener("click", () => { activeCallResult = name; renderFilters(); renderTable(getFiltered()); });
      crf.appendChild(b);
    });
  }
  const naf = document.getElementById("nextActionFilters");
  if (naf) {
    naf.innerHTML = "";
    NEXT_ACTION_FILTERS.forEach(name => {
      const n = nextActionCount(name);
      // Hiç kaydı olmayan seçenek yer kaplamasın (seçili ya da "Tümü" ise kalır)
      if (n === 0 && name !== activeNextAction && name !== "Tümü") return;
      const b = document.createElement("button");
      b.className = "filter-btn" + (name === activeNextAction ? " is-active" : "");
      b.innerHTML = escapeHtml(name) + ` <span class="cnt">${n}</span>`;
      b.addEventListener("click", () => { activeNextAction = name; renderFilters(); renderTable(getFiltered()); });
      naf.appendChild(b);
    });
  }
  const af = document.getElementById("actionFilters");
  if (af) {
    af.innerHTML = "";
    ACTION_FILTERS.forEach(name => {
      const b = document.createElement("button");
      b.className = "filter-btn" + (name === activeAction ? " is-active" : "");
      b.innerHTML = escapeHtml(name) + ` <span class="cnt">${actionCount(name)}</span>`;
      b.addEventListener("click", () => { activeAction = name; renderFilters(); renderTable(getFiltered()); });
      af.appendChild(b);
    });
  }
}

/* --- İstatistikler --- */
function renderStats(leads) {
  const total = leads.length;
  const hotVip = leads.filter(l => l.klass === "Sıcak Lead" || l.klass === "VIP Lead").length;
  const meetings = leads.filter(l => l.selectedSlot).length;
  const orders = leads.filter(l => l.leadStatus === "Siparişe döndü").length;
  const stats = [
    ["Toplam Lead", total],
    ["Sıcak + VIP", hotVip],
    ["Toplantı", meetings],
    ["Siparişe Dönen", orders],
  ];
  document.getElementById("stats").innerHTML = stats
    .map(([s, b]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join("");
}

function distBars(containerId, pairs) {
  const max = Math.max(1, ...pairs.map(p => p[1]));
  document.getElementById(containerId).innerHTML = pairs.length
    ? pairs.map(([lbl, n]) => `
      <div class="dist-row">
        <span class="lbl">${escapeHtml(lbl)}</span>
        <span class="bar"><i style="width:${(n / max) * 100}%"></i></span>
        <span class="val">${n}</span>
      </div>`).join("")
    : `<p class="empty">Veri yok.</p>`;
}
function renderStatusDist(leads) {
  const pairs = STATUSES.map(s => [s, leads.filter(l => l.leadStatus === s).length]).filter(p => p[1] > 0);
  distBars("distStatus", pairs);
}
function renderClassDist(leads) {
  const order = ["VIP Lead", "Sıcak Lead", "Takip Edilecek Lead", "Düşük Öncelikli Lead"];
  distBars("distClass", order.map(k => [k, leads.filter(l => l.klass === k).length]));
}
function renderProductDist(leads) {
  const map = {};
  leads.forEach(l => (l.products || []).forEach(p => { map[p] = (map[p] || 0) + 1; }));
  distBars("distProduct", Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 15));
}
function renderFieldDist(containerId, leads, field) {
  const map = {};
  leads.forEach(l => { const v = l[field] || "—"; map[v] = (map[v] || 0) + 1; });
  distBars(containerId, Object.entries(map).sort((a, b) => b[1] - a[1]));
}

/* --- Sınıf sıralaması ---
   "Sınıf" başlığına her basışta: VIP üstte → Düşük üstte → tarihe geri dön. */
function toggleClassSort() {
  classSort = classSort === 0 ? 1 : classSort === 1 ? -1 : 0;
  renderTable(getFiltered());
}

/* --- Sınıf filtresi / sıralaması özet çubuğu ---
   Telefonda sütun başlıkları gizlendiği için sıralama butonu da burada duruyor. */
function renderSortBar(leads) {
  const bar = document.getElementById("sortBar");
  if (!bar) return;
  const f = CLASS_FILTERS.find(x => x.key === activeClass);
  const filtreAd = (activeClass === "tumu" || !f) ? "Tüm sınıflar" : f.label;
  const siraAd = classSort === 1 ? "Sınıf — VIP üstte"
    : classSort === -1 ? "Sınıf — Düşük üstte" : "Tarih (yeniden eskiye)";
  bar.innerHTML =
    `Sınıf filtresi: <b>${escapeHtml(filtreAd)}</b> &nbsp;·&nbsp; ` +
    `Sıralama: <b>${escapeHtml(siraAd)}</b> &nbsp;·&nbsp; ` +
    `Görünen: <b>${leads.length} lead</b>` +
    `<span class="sb-btns">` +
      `<button type="button" class="mobil-sirala" id="mobilSirala">⇅ Sınıfa göre sırala</button>` +
      `<button type="button" id="sinifSifirla">Sıfırla</button>` +
    `</span>`;
  const m = document.getElementById("mobilSirala");
  if (m) m.addEventListener("click", toggleClassSort);
  document.getElementById("sinifSifirla").addEventListener("click", () => {
    activeClass = "tumu"; classSort = 0; renderFilters(); renderTable(getFiltered());
  });
}

/* --- Tablo (tıklanabilir satırlar) --- */
function renderTable(leads) {
  const table = document.getElementById("leadTable");
  renderSortBar(leads);
  if (!leads.length) {
    table.innerHTML = `<tr><td class="empty" colspan="10">Bu filtrede lead yok.</td></tr>`;
    updateBulkBar(leads);   // çubuk eski sayıyla asılı kalmasın
    return;
  }
  // "Sınıf" başlığı tıklanabilir: VIP üstte → Düşük üstte → tarihe geri dön
  const ok = classSort === 1 ? "▼" : classSort === -1 ? "▲" : "⇅";
  const head = `<tr>
    <th class="c-sel"><input type="checkbox" id="selAll" title="Görünen tümünü seç" aria-label="Görünen tümünü seç"></th>
    <th>Tarih</th><th>Grup</th><th>Firma</th><th>Telefon numarası</th>
    <th>Tonaj / Ücret / Ambalaj / Nalburiye cevabı</th>
    <th class="sortable${classSort ? " is-sorted" : ""}" id="thSinif" tabindex="0" role="button"
        title="Sınıfa göre sırala">Sınıf <span class="ok">${ok}</span></th>
    <th>Durum</th><th>Sonraki takip</th><th>Sil</th></tr>`;
  // Sıralama açıkken her sınıfın önüne blok başlığı girer (VIP'ler bir arada, sıcaklar bir arada...)
  let oncekiKlass = null;
  const rows = leads.map((l, idx) => {
    let basi = "";
    if (classSort !== 0) {
      const k = l.klass || "";
      if (k !== oncekiKlass) {
        const adet = leads.filter(x => (x.klass || "") === k).length;
        basi = `<tr class="grup-basi"><td colspan="10">${escapeHtml(CLASS_BLOK[k] || k)}` +
               ` <span class="n">— ${adet} lead</span></td></tr>`;
        oncekiKlass = k;
      }
    }
    return basi + `<tr class="clickable" data-idx="${idx}">
    <td class="c-sel" data-label="Seç"><input type="checkbox" class="row-sel" data-idx="${idx}"
      ${SELECTED.has(leadKey(l)) ? "checked" : ""} aria-label="Bu lead'i seç"></td>
    <td data-label="Tarih">${l.createdAt ? new Date(l.createdAt).toLocaleDateString("tr-TR") : "-"}</td>
    <td data-label="Grup">${groupCell(l)}</td>
    <td data-label="Firma">${firmaCell(l)}</td>
    <td data-label="Telefon numarası">${telefonCell(l)}</td>
    <td data-label="${leadGroupOf(l) === "cin" ? "Ücret cevabı" : leadGroupOf(l) === "ambalaj" ? "Ambalaj cevabı" : leadGroupOf(l) === "nalburiye" ? "Nalburiye cevabı" : "Tonaj"}">${tonajCell(l)}</td>
    <td data-label="Sınıf">${klassCell(l)}</td>
    <td data-label="Durum"><span class="status-badge ${statusClass(l.leadStatus)}">${escapeHtml(l.leadStatus)}</span></td>
    <td data-label="Sonraki takip">${followCell(l.followUpDate)}</td>
    <td data-label="Sil"><button class="row-del" data-idx="${idx}" title="Bu lead'i sil" aria-label="Sil">🗑️</button></td>
  </tr>`;
  }).join("");
  table.innerHTML = head + rows;
  const th = document.getElementById("thSinif");
  if (th) {
    th.addEventListener("click", toggleClassSort);
    th.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleClassSort(); }
    });
  }
  table.querySelectorAll("tr.clickable").forEach(tr => {
    tr.addEventListener("click", () => openCard(leads[+tr.dataset.idx]));
  });
  table.querySelectorAll(".row-del").forEach(b => {
    // Satır tıklaması kartı açıyor; silme butonu onu tetiklemesin.
    b.addEventListener("click", e => { e.stopPropagation(); deleteLead(leads[+b.dataset.idx], b); });
  });
  table.querySelectorAll(".row-sel").forEach(c => {
    c.addEventListener("click", e => e.stopPropagation()); // kart açılmasın
    c.addEventListener("change", e => {
      const k = leadKey(leads[+c.dataset.idx]);
      e.target.checked ? SELECTED.add(k) : SELECTED.delete(k);
      updateBulkBar(leads);
    });
  });
  const all = document.getElementById("selAll");
  if (all) all.addEventListener("change", e => {
    leads.forEach(l => e.target.checked ? SELECTED.add(leadKey(l)) : SELECTED.delete(leadKey(l)));
    renderTable(leads);
  });
  updateBulkBar(leads);
}

/* --- Çoklu seçim çubuğu --- */
function updateBulkBar(leads) {
  const bar = document.getElementById("bulkBar");
  if (!bar) return;
  bar.hidden = SELECTED.size === 0;
  const cnt = document.getElementById("bulkCount");
  if (cnt) cnt.textContent = SELECTED.size + " lead seçildi";

  // Başlık kutusu: görünenlerin hepsi seçiliyse dolu, bir kısmıysa karışık
  const all = document.getElementById("selAll");
  if (all) {
    const secili = leads.filter(l => SELECTED.has(leadKey(l))).length;
    all.checked = leads.length > 0 && secili === leads.length;
    all.indeterminate = secili > 0 && secili < leads.length;
  }
}

/* --- Seçilenleri toplu sil --- */
async function bulkDelete() {
  const keys = [...SELECTED];
  if (!keys.length) return;
  if (!confirm(`${keys.length} lead silinecek.\n\nBu işlem geri alınamaz. Emin misiniz?`)) return;

  const btn = document.getElementById("bulkDel");
  const eski = btn.textContent;
  btn.disabled = true; btn.textContent = "Siliniyor…";

  if (sb) {
    const res = await sbAdminDeleteMany(keys);
    if (res.error === "rls") { alert(RLS_UYARI); btn.disabled = false; btn.textContent = eski; return; }
    if (res.error) {
      alert("Silinemedi: " + res.error + (res.deleted ? `\n\n${res.deleted} lead silindikten sonra durdu.` : ""));
    }
  } else {
    try {
      const arr = (JSON.parse(localStorage.getItem(STORAGE_KEY)) || []).filter(l => !SELECTED.has(l.refNo));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch (e) { alert("Silinemedi: " + e); }
  }

  SELECTED.clear();
  btn.disabled = false; btn.textContent = eski;
  await renderAll();
}

/* --- Lead silme (satır butonu) --- */
async function deleteLead(lead, btn) {
  const ad = lead.company || lead.contact || lead.refNo || "Bu lead";
  if (!confirm(`"${ad}" silinecek.\n\nBu işlem geri alınamaz. Emin misiniz?`)) return;

  const eski = btn.textContent;
  btn.disabled = true; btn.textContent = "…";

  if (sb && lead.id) {
    const res = await sbAdminDelete(lead.id);
    if (res.error === "rls") {
      alert(RLS_UYARI);
      btn.disabled = false; btn.textContent = eski; return;
    }
    if (res.error) {
      alert("Silinemedi: " + res.error);
      btn.disabled = false; btn.textContent = eski; return;
    }
  } else {
    // Supabase yoksa localStorage yedeğinden sil
    try {
      const arr = (JSON.parse(localStorage.getItem(STORAGE_KEY)) || [])
        .filter(l => l.refNo !== lead.refNo);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch (e) { alert("Silinemedi: " + e); btn.disabled = false; btn.textContent = eski; return; }
  }

  await renderAll();
}

/* --- Müşteri Kartı (CRM) --- */
const overlay = document.getElementById("overlay");
document.getElementById("cardClose").addEventListener("click", closeCard);
overlay.addEventListener("click", e => { if (e.target === overlay) closeCard(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeCard(); });
function closeCard() { overlay.hidden = true; }

/* Kartta ücret sorusunun cevabı: müşterinin verdiği HAM cevap, iki sütunu
   birden kaplayan bir blok olarak. Önce tek satırlık küçük bir alandı ve cevap
   boşken yalnızca "-" yazıyordu; bu, "müşteri cevaplamamış" gibi okunuyordu —
   oysa çoğu kayıtta cevap hiç saklanmamıştı (cin_paid kolonu açılmadan önce
   aktarılan leadler). Artık boşluğun sebebi ve çözümü yazıyor.
   Sorunun tam metni kartta gösterilmiyor: soru zaten sabit, cevabı yeterli. */
function cinCevapKutusu(lead) {
  const ham  = String(lead.cinPaid || "").trim();
  const info = typeof cinPaidInfo === "function" ? cinPaidInfo(cinPaidKey(ham)) : null;
  const ipucu = (m) => '<span class="row-hint" style="margin:4px 0 0">' + m + "</span>";

  let govde;
  if (ham && info)
    govde = "<b>" + escapeHtml(ham) + "</b>" +
      ipucu("Sınıf karşılığı: <b>" + escapeHtml(info.klass) + "</b> (" + info.score + " puan)");
  else if (ham)
    govde = "<b>" + escapeHtml(ham) + "</b>" +
      ipucu("Bu cevap üç şıktan birine oturtulamadı; sınıfı aşağıdaki listeden elle seçebilirsin.");
  else
    govde = '<b class="due-none">Kayıtlı değil</b>' +
      ipucu("Bu lead, cevap alanı veritabanında açılmadan önce aktarılmış olabilir. " +
            "Aynı Meta dosyasını yeniden içe aktarırsan boş cevaplar dolar (kayıt çoğaltmaz).");

  return '<div style="grid-column:1/-1">' +
    "<span>Ücretli hizmet sorusuna cevabı</span>" + govde +
    "</div>";
}

/* Ambalaj Sarf Malzemeleri kartında 3 soru da kendi kutusunda, soru metni +
   ham cevabıyla gösterilir. Bütçe ayrı bir kv alanı olarak kalır — burada
   tekrar edilmez — çünkü sınıflandırmayı bütçe belirliyor (scoring.js,
   nalburiyeCevapKutusu ile aynı desen). Bu 3 soru salt bilgi amaçlı kalır,
   o yüzden düzenlenebilir bir açılır liste yok. */
function ambalajCevapKutusu(lead) {
  const kutular = AMBALAJ_SORULAR.map(s => {
    const cevap = String(lead[s.key] || "").trim();
    return '<div class="ambalaj-q"><span>' + escapeHtml(s.soru) + "</span>" +
      (cevap ? "<b>" + escapeHtml(cevap) + "</b>" : '<b class="due-none">Kayıtlı değil</b>') +
      "</div>";
  }).join("");
  return '<div style="grid-column:1/-1" class="ambalaj-box">' + kutular + "</div>";
}

/* Nalburiye kartında bütçe dışındaki 2 soru da kendi kutusunda gösterilir
   (Ambalaj'la aynı desen). Bütçe ayrı bir kv alanı olarak kalır — burada
   tekrar edilmez — çünkü sınıflandırmayı bütçe belirliyor (scoring.js). */
function nalburiyeCevapKutusu(lead) {
  const kutular = NALBURIYE_SORULAR.map(s => {
    const cevap = String(lead[s.key] || "").trim();
    return '<div class="nalburiye-q"><span>' + escapeHtml(s.soru) + "</span>" +
      (cevap ? "<b>" + escapeHtml(cevap) + "</b>" : '<b class="due-none">Kayıtlı değil</b>') +
      "</div>";
  }).join("");
  return '<div style="grid-column:1/-1" class="nalburiye-box">' + kutular + "</div>";
}

function openCard(lead) {
  document.getElementById("cardTitle").textContent = lead.company || lead.contact || "Müşteri Kartı";
  document.getElementById("cardRef").textContent =
    (lead.refNo ? "Talep No: " + lead.refNo + "  •  " : "") +
    (lead.createdAt ? new Date(lead.createdAt).toLocaleString("tr-TR") : "");

  const kv = (s, v) => `<div><span>${s}</span><b>${escapeHtml(v || "-")}</b></div>`;
  const yn = (v) => v ? "Evet" : "Hayır";
  const opt = (list, sel) => list.map(o => `<option${o === sel ? " selected" : ""}>${escapeHtml(o)}</option>`).join("");

  /* Çin hizmetinde tonaj sorulmaz; sınıfı ücret sorusunun cevabı belirler.
     Kartta hem müşterinin verdiği ham cevap, hem de görüşmeden sonra
     değiştirilebilsin diye açılır liste gösterilir.
     data-ilk = listenin AÇILIŞ değeri: kaydederken sınıf yalnızca bu değer
     değiştiyse yeniden hesaplanır (bkz. saveCard). */
  const cinLead = leadGroupOf(lead) === "cin";
  const ambalajLead = leadGroupOf(lead) === "ambalaj";
  const nalburiyeLead = leadGroupOf(lead) === "nalburiye";
  const cinKey  = typeof cinPaidKey === "function" ? cinPaidKey(lead.cinPaid) : "";
  const cinAlan = !cinLead ? "" : `
      <div class="field full"><label class="field-label">Ücretli hizmet cevabı
        <span style="font-weight:400;text-transform:none">(sınıfı bu belirler)</span></label>
        <select id="stCin" class="text-input" data-ilk="${escapeHtml(cinKey)}">
          <option value=""${cinKey ? "" : " selected"}>— Cevap yok / bilinmiyor —</option>
          ${(typeof CIN_PAID_ANSWERS !== "undefined" ? CIN_PAID_ANSWERS : []).map(a =>
            `<option value="${a.key}"${a.key === cinKey ? " selected" : ""}>${escapeHtml(a.label)}</option>`).join("")}
        </select>
        ${(!cinKey && lead.klass) ? '<p class="row-hint" style="margin:6px 0 0">Müşterinin cevabı kayıtlı değil. Dokunmazsan mevcut sınıf (<b>' +
            escapeHtml(klassShort(lead.klass)) + '</b>) korunur; listeden seçersen sınıf yeniden hesaplanır.</p>' : ""}
        </div>`;

  document.getElementById("cardBody").innerHTML = `
    <div class="kv">
      ${kv("Ad soyad (yetkili)", lead.contact)}
      ${kv("Firma adı", lead.company)}
      ${kv("Telefon", lead.phone)}
      ${kv("WhatsApp", lead.whatsapp)}
      ${kv("Şehir", lead.location)}
      ${kv("Liman", lead.port)}
      ${kv("Girilen ürünler", (lead.products || []).join(", "))}
      ${cinLead ? cinCevapKutusu(lead) : ambalajLead ? ambalajCevapKutusu(lead) : nalburiyeLead ? nalburiyeCevapKutusu(lead) : kv("Tonaj", lead.tonnage)}
      ${cinLead ? "" : kv("Bütçe", lead.budget)}
      ${(ambalajLead || nalburiyeLead) ? "" : kv("İthalat zamanı", lead.timing)}
      ${(cinLead || ambalajLead || nalburiyeLead) ? "" : kv("Daha önce ithalat?", lead.experience)}
      ${kv("Lead grubu", lead.leadGroup)}
      ${kv("Lead etiketi", lead.klass)}
      ${kv("Lead puanı", lead.score == null ? "-" : String(lead.score))}
      ${kv("WhatsApp gösterildi mi?", yn(lead.waShown))}
      ${kv("Toplantı gösterildi mi?", yn(lead.meetingShown))}
      ${kv("Seçilen görüşme", lead.selectedSlot)}
    </div>

    <div class="edit-grid">
      <div class="field"><label class="field-label">Ürün grubu / Hizmet</label><select id="stGroup" class="text-input">${groupOpt(lead.group)}</select></div>
      ${cinAlan}
      <div class="field"><label class="field-label">Lead durumu</label><select id="stSelect" class="text-input">${opt(STATUSES, lead.leadStatus)}</select></div>
      <div class="field"><label class="field-label">Arama sonucu</label><select id="stCall" class="text-input">${opt(CALL_RESULTS, lead.callResult)}</select></div>
      <div class="field"><label class="field-label">Sonraki aksiyon</label><select id="stNext" class="text-input">${opt(NEXT_ACTIONS, lead.nextAction)}</select></div>
      <div class="field"><label class="field-label">Sonraki takip tarihi</label><input id="stFollow" class="text-input" type="date" value="${escapeHtml(lead.followUpDate || "")}"></div>
      <div class="field full"><label class="field-label">Kapatma nedeni <span style="font-weight:400;text-transform:none">(yalnızca “Kapatıldı” durumunda)</span></label><select id="stClose" class="text-input">${opt(CLOSE_REASONS, lead.closeReason)}</select></div>
      <div class="field full"><label class="field-label">Admin notu</label><textarea id="stNotes" class="text-input" placeholder="Görüşme notu, hatırlatma, teklif detayı...">${escapeHtml(lead.adminNote || "")}</textarea></div>
    </div>

    <div class="card-actions">
      <button class="btn btn--cta" id="stSave" style="flex:1">💾 Kaydet</button>
      <a class="btn btn--wa" id="stWa" target="_blank" rel="noopener">📲 WhatsApp</a>
    </div>
    <p id="stMsg" style="margin:10px 0 0"></p>
  `;

  const waNum = waNumber(lead.whatsapp || lead.phone);
  const waBtn = document.getElementById("stWa");
  if (waNum.length >= 11) waBtn.href = "https://wa.me/" + waNum;
  else waBtn.style.display = "none";

  document.getElementById("stSave").addEventListener("click", () => saveCard(lead));
  overlay.hidden = false;
}

async function saveCard(lead) {
  const msg = document.getElementById("stMsg");
  lead.group        = document.getElementById("stGroup").value;
  lead.leadStatus   = document.getElementById("stSelect").value;
  lead.callResult   = document.getElementById("stCall").value;
  lead.nextAction   = document.getElementById("stNext").value;
  lead.followUpDate = document.getElementById("stFollow").value;
  lead.closeReason  = document.getElementById("stClose").value;
  lead.adminNote    = document.getElementById("stNotes").value;

  /* Ücret cevabı değiştiyse sınıf yeniden hesaplanır — rozet, "Sıcak + VIP"
     sayacı ve sınıf dağılımı hep aynı alandan beslendiği için hepsi birlikte
     yerine oturur.
     SINIF YALNIZCA LİSTE ELLE DEĞİŞTİRİLDİYSE HESAPLANIR (data-ilk ile
     karşılaştırma): ham cevap elde olmayan leadlerde (cin_paid kolonu açılmamış
     ya da içe aktarmada sütun eşleşmemiş) liste "cevap yok"ta açılıyor, sadece
     not/durum kaydetmek bile rozeti (VIP/Sıcak/Düşük) siliyordu.
     leadGroupOf yukarıdaki lead.group ATANDIKTAN SONRA sorulur: hizmet aynı
     kayıtta Çin'den başka bir gruba çevrildiyse Çin kuralı artık işlemez,
     yoksa dondurulmuş gıda leadine ücret cevabından sınıf yazardık.
     (Karttaki Çin alanı grup değişikliğinden sonra kart yeniden açılınca kaybolur.) */
  const cinSec = document.getElementById("stCin");
  let sinifDegisti = false;
  if (cinSec && leadGroupOf(lead) === "cin" && typeof classifyLead === "function"
      && cinSec.value !== (cinSec.dataset.ilk || "")) {
    lead.cinPaid = cinSec.value;
    const c = classifyLead({ group: "cin", cinPaid: lead.cinPaid });
    lead.klass = c.klass; lead.score = c.score; lead.leadGroup = c.group;
    sinifDegisti = true;
    cinSec.dataset.ilk = cinSec.value; // kart açık kalırsa ikinci kayıt tekrar tetiklemesin
  }

  const refresh = () => { renderPanels(); renderFilters(); renderTable(getFiltered()); };

  if (sb && lead.id != null) {
    msg.textContent = "Kaydediliyor…"; msg.className = "muted";
    const full = {
      group_type: lead.group || null,
      lead_status: lead.leadStatus, call_result: lead.callResult, next_action: lead.nextAction,
      close_reason: lead.closeReason, next_followup: lead.followUpDate || null, notes: lead.adminNote,
    };
    if (sinifDegisti) {
      full.cin_paid = lead.cinPaid || null;
      full.klass = lead.klass || null; full.score = lead.score; full.lead_group = lead.leadGroup;
    }
    let res = await sbAdminUpdate(lead.id, full);
    if (res.error && /column|schema cache|PGRST204/i.test(res.error)) {
      // Yeni kolonlar henüz eklenmemiş -> mevcut kolonları kaydet (kalanlar bu oturumda görünür)
      // group_type eski kolonlardan biri; yedek kayıtta da gönderilir ki hizmet değişikliği kaybolmasın.
      // klass/score/lead_group kurulumun ilk günden beri var olan kolonları: Çin
      // leadinin sınıfı, cin_paid kolonu hiç açılmamış olsa bile kalıcı olsun diye.
      const yedek = { group_type: lead.group || null, next_followup: lead.followUpDate || null, notes: lead.adminNote };
      if (sinifDegisti) { yedek.klass = lead.klass || null; yedek.score = lead.score; yedek.lead_group = lead.leadGroup; }
      res = await sbAdminUpdate(lead.id, yedek);
      if (!res.error) {
        msg.innerHTML = "✓ Kaydedildi. <b>Not:</b> Durum/aksiyon alanlarının kalıcı olması için Supabase'e yeni kolonları ekleyin (kurulum SQL'i).";
        msg.className = "save-ok"; refresh(); return;
      }
    }
    if (res.error) { msg.textContent = "Hata: " + res.error; msg.className = "form-err"; return; }
    msg.textContent = "✓ Kaydedildi"; msg.className = "save-ok";
  } else {
    try {
      const arr = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      const i = arr.findIndex(x => x.refNo === lead.refNo);
      if (i >= 0) {
        Object.assign(arr[i], {
          group: lead.group,
          leadStatus: lead.leadStatus, callResult: lead.callResult, nextAction: lead.nextAction,
          followUpDate: lead.followUpDate, closeReason: lead.closeReason, adminNote: lead.adminNote,
          notes: lead.adminNote, nextFollowup: lead.followUpDate,
        });
        if (sinifDegisti) Object.assign(arr[i], {
          cinPaid: lead.cinPaid, klass: lead.klass, score: lead.score, leadGroup: lead.leadGroup,
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
      }
    } catch (e) {}
    msg.textContent = "✓ Kaydedildi (yerel)"; msg.className = "save-ok";
  }
  refresh();
}

/* --- Dışa aktarma --- */
function exportJSON() { download("leadler.json", JSON.stringify(CACHE, null, 2), "application/json"); }
function exportCSV() {
  const cols = ["createdAt","refNo","company","contact","phone","whatsapp","location","port",
                "group","products","tonnage","budget","timing","experience","cinPaid",
                "ambalajBambu","ambalajHijyen","ambalajPaketleme",
                "nalburiyeKategori","nalburiyeUrun","leadGroup","klass","score",
                "selectedSlot","leadStatus","callResult","nextAction","followUpDate","closeReason","adminNote"];
  const rows = CACHE.map(l => cols.map(c => {
    let v = l[c];
    if (Array.isArray(v)) v = v.join(" | ");
    return `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  }).join(","));
  download("leadler.csv", "﻿" + [cols.join(","), ...rows].join("\r\n"), "text/csv");
}
function download(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name; a.click();
  URL.revokeObjectURL(a.href);
}
/* Eleman yoksa sessizce atla. Öncesinde düz getElementById(...).addEventListener
   kullanılıyordu; tarayıcıda admin.html'in ESKİ sürümü önbellekten gelip
   admin.js'in yenisi yüklendiğinde (ya da tersi) eksik bir eleman TypeError
   fırlatıyor, script orada duruyor ve ALTTAKİ TÜM bağlantılar kurulmuyordu —
   yenile/dışa aktar/toplu silme çalışmaz hâle geliyordu. */
function on(id, olay, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(olay, fn);
  else console.warn("admin: '" + id + "' bulunamadı (admin.html eski sürüm olabilir — Ctrl+Shift+R).");
}

on("impFile", "change", impDosyaSecildi);
on("impRun", "click", impCalistir);
// İçe aktarmadaki hizmet seçicisi GROUP_FILTERS'tan dolar; import.js bu dosyadan
// önce yüklendiği için kurulumu buradan yapılır.
if (typeof impGrupSeciciKur === "function") impGrupSeciciKur();
on("funnelRange", "change", e => { funnelGun = +e.target.value; renderFunnel(); });
on("bulkDel", "click", bulkDelete);
on("bulkClear", "click", () => { SELECTED.clear(); renderTable(getFiltered()); });
on("exportCsv", "click", exportCSV);
on("exportJson", "click", exportJSON);
on("refresh", "click", renderAll);

/* --- Funnel düşüş raporu (ziyaretçi hangi adımda vazgeçti?) --- */
const FUNNEL_ADIMLAR = [
  { key: "landing",    ad: "Siteye girdi" },
  { key: "start",      ad: "“Teklif Al”a bastı" },
  { key: "group",      ad: "1. Ürün grubu" },
  { key: "products",   ad: "2. Ürün seçimi" },
  { key: "tonnage",    ad: "3. Tonaj" },
  { key: "budget",     ad: "4. Bütçe" },
  { key: "timing",     ad: "5. Zamanlama" },
  { key: "experience", ad: "6. Tecrübe" },
  { key: "contact",    ad: "7. İletişim formu" },
  { key: "finish",     ad: "✅ Talebi gönderdi" },
];

let funnelGun = 30;

async function renderFunnel() {
  const box = document.getElementById("funnelReport");
  if (!box) return;
  box.innerHTML = '<p class="muted">Yükleniyor…</p>';

  const { rows, error } = await sbFunnelEvents(funnelGun);
  if (error) {
    const yok = /does not exist|schema cache|PGRST205/i.test(error);
    box.innerHTML = yok
      ? '<p class="muted">📋 Takip tablosu henüz kurulmamış. <b>SUPABASE-KURULUM.md → bölüm 1b</b>’deki SQL’i çalıştırın; sonra ziyaretçiler geldikçe rapor burada dolar.</p>'
      : '<p class="muted">Rapor okunamadı: ' + escapeHtml(error) + '</p>';
    return;
  }

  // Adım -> kaç FARKLI ziyaretçi ulaştı
  const sayac = {};
  FUNNEL_ADIMLAR.forEach(a => sayac[a.key] = new Set());
  rows.forEach(r => { if (sayac[r.step]) sayac[r.step].add(r.session_id); });

  const giren = sayac.landing.size;
  if (!giren) {
    box.innerHTML = '<p class="muted">Bu dönemde ziyaretçi kaydı yok. (Takip yeni kurulduysa ilk ziyaretçileri bekleyin.)</p>';
    return;
  }

  const bitiren = sayac.finish.size;
  const oran = giren ? ((bitiren / giren) * 100).toFixed(1) : "0";

  let html =
    '<div class="fn-top">' +
      '<div class="fn-kpi"><b>' + giren + '</b><span>siteye giren</span></div>' +
      '<div class="fn-kpi"><b>' + bitiren + '</b><span>form gönderen</span></div>' +
      '<div class="fn-kpi"><b>%' + oran + '</b><span>dönüşüm</span></div>' +
    '</div>';

  let onceki = null;
  FUNNEL_ADIMLAR.forEach(a => {
    const n = sayac[a.key].size;
    const yuzde = giren ? (n / giren) * 100 : 0;
    // Bir önceki adıma göre kaç kişi kayboldu
    const kayip = (onceki === null || onceki === 0) ? null : onceki - n;
    const kayipYuzde = (onceki && kayip > 0) ? ((kayip / onceki) * 100).toFixed(0) : null;
    html +=
      '<div class="fn-row' + (a.key === "finish" ? " is-final" : "") + '">' +
        '<div class="fn-lbl">' + escapeHtml(a.ad) + '</div>' +
        '<div class="fn-bar"><i style="width:' + yuzde.toFixed(1) + '%"></i></div>' +
        '<div class="fn-n">' + n + '</div>' +
        '<div class="fn-drop">' + (kayipYuzde && kayip > 0 ? '−' + kayip + ' (%' + kayipYuzde + ')' : '') + '</div>' +
      '</div>';
    onceki = n;
  });

  // En büyük düşüşün olduğu adımı bul ve vurgula
  let enBuyuk = { ad: null, kayip: 0 };
  for (let i = 1; i < FUNNEL_ADIMLAR.length; i++) {
    const onc = sayac[FUNNEL_ADIMLAR[i - 1].key].size;
    const simdi = sayac[FUNNEL_ADIMLAR[i].key].size;
    if (onc - simdi > enBuyuk.kayip) enBuyuk = { ad: FUNNEL_ADIMLAR[i].ad, kayip: onc - simdi, onceki: FUNNEL_ADIMLAR[i - 1].ad };
  }
  if (enBuyuk.ad && enBuyuk.kayip > 0) {
    html += '<p class="fn-hint">🔎 En büyük kayıp: <b>' + escapeHtml(enBuyuk.onceki) +
            '</b> → <b>' + escapeHtml(enBuyuk.ad) + '</b> arasında <b>' + enBuyuk.kayip + ' kişi</b> vazgeçti.</p>';
  }
  box.innerHTML = html;
}

/* --- Görüşme müsaitliği yönetimi (admin ayarlar; funnel okur) --- */
const AV_TIMES = []; for (let _h = 10; _h <= 18; _h++) AV_TIMES.push(String(_h).padStart(2, "0") + ":00");
let AVAIL = {};        // date -> { closed, openTimes }
let avOpenSet = {};
let avInited = false;

function avPad(n) { return String(n).padStart(2, "0"); }
function avTrDate(s) {
  const M = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  const D = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
  const p = String(s).split("-"); const d = new Date(+p[0], +p[1] - 1, +p[2]);
  return (+p[2]) + " " + M[+p[1] - 1] + " " + p[0] + " " + D[d.getDay()];
}
async function loadAvail() {
  if (typeof sbGetAvailability === "function" && sb) {
    const rows = await sbGetAvailability();
    AVAIL = {};
    (rows || []).forEach(r => { if (r && r.date) AVAIL[r.date] = { closed: !!r.closed, openTimes: r.open_times || [] }; });
  } else {
    try { AVAIL = JSON.parse(localStorage.getItem("klup_availability")) || {}; } catch (e) { AVAIL = {}; }
  }
}
function saveLocalAvail() { try { localStorage.setItem("klup_availability", JSON.stringify(AVAIL)); } catch (e) {} }
function avCurrentOpen() { return AV_TIMES.filter(t => avOpenSet[t]); }
function avRenderEffect() {
  const e = document.getElementById("avEffect"); if (!e) return;
  if (document.getElementById("avClosed").checked) { e.textContent = "Müşteri bu gün hiç saat görmez (kapalı)."; return; }
  const op = avCurrentOpen();
  if (op.length === AV_TIMES.length) { e.textContent = "Müşteri tüm saatleri görür (dolu olanlar hariç)."; return; }
  if (!op.length) { e.textContent = "Hiç saat açık değil → müşteri saat göremez."; return; }
  e.textContent = "Müşteri yalnızca şunları görür: " + op.join(", ") + " (dolu olanlar hariç).";
}
function avRenderHours() {
  const wrap = document.getElementById("avHours"); if (!wrap) return;
  const closed = document.getElementById("avClosed").checked;
  wrap.innerHTML = "";
  AV_TIMES.forEach(t => {
    const b = document.createElement("button"); b.type = "button";
    b.className = "hbtn" + (avOpenSet[t] ? " on" : ""); b.textContent = t; b.disabled = closed;
    b.addEventListener("click", () => { avOpenSet[t] = !avOpenSet[t]; avRenderHours(); });
    wrap.appendChild(b);
  });
  const lbl = document.getElementById("avHoursLbl"); if (lbl) lbl.style.opacity = closed ? ".4" : "1";
  avRenderEffect();
}
function avLoadDateIntoForm() {
  const d = document.getElementById("avDate").value;
  const o = AVAIL[d];
  document.getElementById("avClosed").checked = o ? !!o.closed : false;
  avOpenSet = {}; AV_TIMES.forEach(t => { avOpenSet[t] = (o && o.openTimes && o.openTimes.length) ? o.openTimes.indexOf(t) >= 0 : true; });
  avRenderHours();
}
function avRenderList() {
  const list = document.getElementById("avList"); if (!list) return;
  const keys = Object.keys(AVAIL).sort();
  if (!keys.length) { list.innerHTML = '<p class="empty">Henüz özel gün ayarı yok.</p>'; return; }
  list.innerHTML = "";
  keys.forEach(k => {
    const o = AVAIL[k]; let summary;
    if (o.closed) summary = "KAPALI";
    else if (o.openTimes && o.openTimes.length && o.openTimes.length < AV_TIMES.length) summary = "Sadece: " + o.openTimes.join(", ");
    else summary = "Tüm saatler açık";
    const row = document.createElement("div"); row.className = "ov" + (o.closed ? " closed" : "");
    row.innerHTML = '<div><div class="d">' + escapeHtml(avTrDate(k)) + '</div><div class="s">' + escapeHtml(summary) + '</div></div><button class="rm">Kaldır</button>';
    row.querySelector(".rm").addEventListener("click", async () => {
      delete AVAIL[k];
      if (typeof sbDeleteAvailability === "function" && sb) await sbDeleteAvailability(k); else saveLocalAvail();
      avRenderList();
      if (document.getElementById("avDate").value === k) avLoadDateIntoForm();
    });
    list.appendChild(row);
  });
}
async function avSaveDay() {
  const d = document.getElementById("avDate").value; if (!d) return;
  const msg = document.getElementById("avMsg");
  const closed = document.getElementById("avClosed").checked;
  let row, del = false;
  if (closed) { AVAIL[d] = { closed: true, openTimes: [] }; row = { date: d, closed: true, open_times: [] }; }
  else {
    const op = avCurrentOpen();
    if (op.length === AV_TIMES.length) { delete AVAIL[d]; del = true; }   // tümü açık = varsayılan
    else { AVAIL[d] = { closed: false, openTimes: op }; row = { date: d, closed: false, open_times: op }; }
  }
  if (typeof sbSetAvailability === "function" && sb) {
    msg.textContent = "Kaydediliyor…"; msg.className = "muted";
    const res = del ? await sbDeleteAvailability(d) : await sbSetAvailability(row);
    if (res && res.error) { msg.textContent = "Hata: " + res.error + " (meeting_availability tablosu eklendi mi?)"; msg.className = "form-err"; return; }
  } else saveLocalAvail();
  msg.textContent = del ? "✓ Kaydedildi (bu gün varsayılana döndü)" : "✓ Kaydedildi"; msg.className = "save-ok";
  avRenderList();
}
async function initAvail() {
  const dateEl = document.getElementById("avDate"); if (!dateEl) return;
  if (!avInited) {
    avInited = true;
    const t = new Date(); t.setDate(t.getDate() + 1);
    const min = t.getFullYear() + "-" + avPad(t.getMonth() + 1) + "-" + avPad(t.getDate());
    if (!dateEl.value) dateEl.value = min;
    dateEl.min = min;
    dateEl.addEventListener("change", avLoadDateIntoForm);
    document.getElementById("avClosed").addEventListener("change", avRenderHours);
    document.getElementById("avSave").addEventListener("click", avSaveDay);
  }
  await loadAvail();
  avLoadDateIntoForm();
  avRenderList();
}

/* --- yardımcılar --- */
function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function followCell(s) {
  if (!s) return '<span class="due-none">—</span>';
  const t = todayStr(), p = String(s).split("-"), shown = p[2]+"."+p[1]+"."+p[0];
  if (s === t) return '<span class="due-today">'+shown+' • bugün</span>';
  if (s < t)  return '<span class="due-late">'+shown+' • gecikti</span>';
  return shown;
}
/* Tablodaki "Firma" hücresi: altında müşterinin yazdığı ürün(ler).
   Çin formundaki cevap serbest metin ve uzun olabiliyor; hücre tek satıra
   kısaltır, tamamı fareyle üzerine gelince ve müşteri kartında görünür. */
function firmaCell(l) {
  const ad = '<span class="ad">' + escapeHtml(l.company) + "</span>";
  const urun = (l.products || []).join(", ");
  if (!urun) return '<span class="firma-cell">' + ad + "</span>";
  return '<span class="firma-cell">' + ad +
    '<span class="urun" title="' + escapeHtml(urun) + '">' + escapeHtml(urun) + "</span></span>";
}

/* Tablodaki "Telefon numarası" hücresi. Sütun Firma'nın yanına alındı: en
   sonda, "Sil" butonunun yanındayken dar ekranda sağa kayıyor ve numara
   görünmüyordu (özellikle Çin leadlerinde sorun oluyordu).
   Telefon alanı boşsa WhatsApp numarasına düşülür — içe aktarmada ikisi de
   aynı numaradan doldurulur, ama elle girilmiş eski kayıtlarda biri boş
   kalabiliyor. İkisi de yoksa boş hücre yerine "—" yazılır: boş hücre
   "numara yok"tan çok "tablo bozuk" gibi duruyordu. */
function telefonCell(l) {
  const ham = String(l.phone || l.whatsapp || "").trim();
  if (!ham) return '<span class="due-none" title="Numara kayıtlı değil">—</span>';
  return '<span class="tel-cell">' + escapeHtml(telefonBicim(ham)) + "</span>";
}

/* Lead'in telefon/WhatsApp numarasını wa.me'nin beklediği biçime çevirir:
   ülke kodu + numara; artı, boşluk ve baştaki sıfır olmadan.
   Eskiden yalnızca baştaki "0" -> "90" yapılıyordu. "0532…" doğru dönüşüyordu
   ama "532…" / "553…" gibi başında sıfır olmadan girilen numaralar hiç
   dokunulmadan geçiyor, WhatsApp da baştaki "55"i Brezilya ülke kodu (+55)
   sanıp "numara bulunamadı" veriyordu. Artık 10 haneli ve 5 ile başlayan
   (Türk cep) numaralara da "90" ekleniyor. Yurt dışı numaraları (ör. +49…)
   ham haliyle bırakılır. */
function waNumber(raw) {
  let n = String(raw || "").replace(/\D/g, "");
  if (!n) return "";
  if (n.startsWith("00")) n = n.slice(2);              // 0090 553… -> 90 553…
  if (n.startsWith("0"))  n = n.slice(1);              // 0553…     -> 553…
  if (n.length === 10 && n[0] === "5") n = "90" + n;   // 553…      -> 90553… (asıl düzeltme)
  return n;
}

/* Türkiye numarasını okunur yazar: 5321234567 -> 0532 123 45 67.
   Yurt dışı numarası veya tanınmayan biçim olduğu gibi bırakılır — körlemesine
   biçimlendirmek "+49 176 …" gibi numaraları bozuyordu. */
function telefonBicim(ham) {
  let n = String(ham).replace(/\D/g, "");
  if (n.length === 12 && n.startsWith("90")) n = n.slice(2);
  else if (n.length === 11 && n.startsWith("0")) n = n.slice(1);
  if (n.length !== 10) return ham;
  return "0" + n.slice(0, 3) + " " + n.slice(3, 6) + " " + n.slice(6, 8) + " " + n.slice(8);
}

// Tablodaki "Grup" hücresi
function groupCell(l) {
  const g = leadGroupOf(l);
  if (g === "yok") return '<span class="grp-badge grp-yok">—</span>';
  return '<span class="grp-badge grp-'+g+'">'+escapeHtml(GROUP_SHORT[g] || g)+'</span>';
}
/* Tablodaki "Sınıf" hücresi. Sınıfı boş olan lead ROZETSİZ gösterilir:
   düz rozet basılırsa "Düşük" renginde bir "-" çıkıyor ve cevabı bilinmeyen
   Çin leadi, gerçekten "hayır" diyenle aynı görünüyordu. */
/* Çin leadinde tonaj sorulmaz; o sütun boş duruyordu. Yerine sınıfı belirleyen
   ücret cevabı yazılır — hangi leadin neye "evet" dediği tablodan görünsün.
   Tam cevap metni hücrenin title'ında (üstüne gelince) durur. */
function tonajCell(l) {
  const g = leadGroupOf(l);
  if (g === "ambalaj") return ambalajOzetHucre(l);
  if (g === "nalburiye") return nalburiyeOzetHucre(l);
  if (g !== "cin") return escapeHtml(l.tonnage);
  const ham  = String(l.cinPaid || "").trim();
  const info = typeof cinPaidInfo === "function" ? cinPaidInfo(cinPaidKey(ham)) : null;
  if (info) return '<b title="' + escapeHtml(ham || info.label) + '">' + escapeHtml(info.kisa) + "</b>";
  if (ham) return '<span title="' + escapeHtml(ham) + '">' +
    escapeHtml(ham.length > 24 ? ham.slice(0, 23) + "…" : ham) + "</span>";
  return '<span class="due-none" title="Ücret sorusunun cevabı kayıtlı değil">—</span>';
}

/* Ambalaj lead'inde 3 cevap tek hücrede kısa özet olarak gösterilir (Çin'in
   Tonaj sütununu yeniden kullanmasıyla aynı desen). Tam 3 soru + cevap
   title'da (üstüne gelince) durur. */
function ambalajKisa(metin, uzunluk) {
  const t = String(metin || "").trim();
  if (!t) return "";
  return t.length > uzunluk ? t.slice(0, uzunluk - 1) + "…" : t;
}
function ambalajOzetHucre(l) {
  const cevaplar = AMBALAJ_SORULAR.map(s => String(l[s.key] || "").trim());
  if (!cevaplar.some(Boolean))
    return '<span class="due-none" title="Ambalaj sorularının cevabı kayıtlı değil">—</span>';
  const baslik = AMBALAJ_SORULAR.map((s, i) => (i + 1) + ") " + s.soru + ": " + (cevaplar[i] || "—")).join("\n");
  const ozet = cevaplar.map(c => ambalajKisa(c, 18)).filter(Boolean).join(" · ");
  return '<span title="' + escapeHtml(baslik) + '">' + escapeHtml(ozet) + "</span>";
}

/* Nalburiye lead'inde bütçe dışındaki 2 cevap tek hücrede kısa özet olarak
   gösterilir (ambalajOzetHucre ile aynı desen). */
function nalburiyeOzetHucre(l) {
  const cevaplar = NALBURIYE_SORULAR.map(s => String(l[s.key] || "").trim());
  if (!cevaplar.some(Boolean))
    return '<span class="due-none" title="Nalburiye sorularının cevabı kayıtlı değil">—</span>';
  const baslik = NALBURIYE_SORULAR.map((s, i) => (i + 1) + ") " + s.soru + ": " + (cevaplar[i] || "—")).join("\n");
  const ozet = cevaplar.map(c => ambalajKisa(c, 18)).filter(Boolean).join(" · ");
  return '<span title="' + escapeHtml(baslik) + '">' + escapeHtml(ozet) + "</span>";
}

function klassCell(l) {
  if (!l.klass) return '<span class="due-none" title="Sınıflandırılmadı">—</span>';
  return '<span class="lead-badge lead-' + cssClass(l.klass) + '">' + escapeHtml(klassShort(l.klass)) + "</span>";
}
function cssClass(klass) {
  return {
    "VIP Lead":"vip", "Sıcak Lead":"hot", "Takip Edilecek Lead":"follow",
    "Düşük Öncelikli Lead":"low", "Düşük Lead":"low",
  }[klass] || "low";
}
function klassShort(klass) {
  return {
    "VIP Lead":"VIP", "Sıcak Lead":"Sıcak", "Takip Edilecek Lead":"Takip",
    "Düşük Öncelikli Lead":"Düşük", "Düşük Lead":"Düşük",
  }[klass] || (klass || "-");
}
