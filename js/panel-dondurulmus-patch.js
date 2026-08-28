/* =============================================================
   DONDURULMUŞ GIDA PANELİ — YAMA
   Bu dosya SADECE panel-dondurulmus.html tarafından yüklenir.
   Canlı panel (admin.html + js/admin.js) etkilenmez.

   Ne yapar:
   1) Leadleri yalnızca 4 dondurulmuş gıda grubuyla sınırlar:
      🍓 Meyve · 🥦 Sebze · 🐟 Deniz Ürünleri · 🥜 Bakliyat
      + grubu belirlenemeyen ("Belirtilmemiş") leadler de bu
        panelde görünür (kullanıcı isteği).
   2) Çin'den Ürün Getirme, Ambalaj Sarf Malzemeleri,
      Çin'den Nalburiye ve "Ambalaj 1" (veri anahtarı "hepsi")
      gruplarını ürün grubu filtre satırından ve içe aktarma
      hizmet seçicisinden çıkarır. Bu leadler listede, üst
      özetlerde ve dağılımlarda hiç yer almaz.

   Ziyaretçi Düşüş Raporu (funnel) aynen kalır — ürün grubu
   bilgisi taşımadığı için iki panelde de aynı görünür.
   Görüşme Saatleri paneli bu panelde HTML'den kaldırıldı.
   ============================================================= */
(function () {
  if (typeof loadLeads !== "function" || typeof leadGroupOf !== "function"
      || typeof GROUP_FILTERS === "undefined") {
    console.warn("[dondurulmuş] admin.js yüklenmemiş, yama atlandı.");
    return;
  }

  // Bu panelde görünecek gruplar. "yok" = grubu belirlenemeyen lead.
  var GIDA = ["meyve", "sebze", "deniz", "bakliyat", "yok"];
  function gidaLeadMi(l) { return GIDA.indexOf(leadGroupOf(l)) !== -1; }

  /* --- 1) Ürün grubu filtre satırını ve kart açılır listesini daralt ---
     GROUP_FILTERS admin.js'te `const` ama dizi; yerinde ayıklıyoruz ki
     renderFilters() ve groupOpt() otomatik olarak yalnızca gıda gruplarını
     göstersin. ("tumu" ve "yok" sanal anahtarları korunur.) */
  var AT = { hepsi: 1, cin: 1, ambalaj: 1, nalburiye: 1 };
  for (var i = GROUP_FILTERS.length - 1; i >= 0; i--) {
    if (AT[GROUP_FILTERS[i].key]) GROUP_FILTERS.splice(i, 1);
  }

  /* İçe aktarma hizmet seçicisi (#impGroup) admin.js yüklenirken bir kez
     dolduruluyor — o an liste henüz tamdı. Daraltılmış listeyle yeniden kur. */
  if (typeof impGrupSeciciKur === "function") {
    try { impGrupSeciciKur(); } catch (e) {}
  }

  /* --- 2) Veri kaynağını süz ---
     loadLeads() Supabase'den / localStorage'dan tüm leadleri getirir;
     burada yalnızca gıda leadlerini geçiriyoruz. renderAll() bunun
     dönüşünü CACHE'e yazdığı için TÜM panel (tablo, üst kartlar,
     dağılımlar, filtre sayıları) bu daraltılmış küme üzerinden çalışır. */
  var _loadLeads = loadLeads;
  loadLeads = async function () {
    var all = await _loadLeads();
    var sadece = (all || []).filter(gidaLeadMi);
    var note = document.getElementById("sourceNote");
    if (note && all) {
      note.innerHTML = "✅ Dondurulmuş gıda panelidir — <b>" + sadece.length +
        "</b> lead gösteriliyor (toplam " + all.length +
        " kayıttan; Çin / Ambalaj / Nalburiye leadleri diğer paneldedir).";
    }
    return sadece;
  };

  console.info("[dondurulmuş] Panel yaması etkin — yalnızca 4 gıda grubu + Belirtilmemiş.");
})();
