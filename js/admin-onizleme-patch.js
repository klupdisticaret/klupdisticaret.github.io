/* =============================================================
   ÖNİZLEME YAMASI — "Ürün grubuna göre üst panel"
   Bu dosya SADECE admin-onizleme.html tarafından yüklenir.
   Canlı panel (admin.html + js/admin.js) etkilenmez.

   Ne yapar: Bir ürün grubu seçildiğinde (ör. "Ambalaj Sarf
   Malzemeleri") tablonun üstündeki özet kartları, dağılım
   çubukları ve durum/sınıf/aksiyon filtre rozetleri YALNIZCA
   o grubun leadlerinden yeniden hesaplanır.
   Ürün grubu butonlarının kendi sayıları tüm leadleri gösterir.
   Sınıf/durum/aksiyon filtresine basmak üst paneli daraltmaz —
   panel yalnızca ÜRÜN GRUBU seçimini izler.
   ============================================================= */
(function () {
  if (typeof matchGroupFilter !== "function") {
    console.warn("[önizleme] admin.js yüklenmemiş, yama atlandı.");
    return;
  }

  /* Üst panelin kapsamı = yalnızca seçili ürün grubu. */
  function statsScope() {
    return activeGroup === "tumu" ? CACHE : CACHE.filter(matchGroupFilter);
  }
  window.statsScope = statsScope;

  /* --- Panel çizicileri: hangi listeyle çağrılırsa çağrılsın
         ürün grubu kapsamını kullanır --- */
  const _renderStats      = renderStats;
  const _renderStatusDist = renderStatusDist;
  const _renderClassDist  = renderClassDist;
  const _renderProductDist = renderProductDist;
  const _renderFieldDist  = renderFieldDist;

  renderStats      = () => _renderStats(statsScope());
  renderStatusDist = () => _renderStatusDist(statsScope());
  renderClassDist  = () => _renderClassDist(statsScope());
  renderProductDist = () => _renderProductDist(statsScope());
  renderFieldDist  = (containerId, _leads, field) => _renderFieldDist(containerId, statsScope(), field);

  /* --- Filtre rozet sayıları: seçili ürün grubu içinde sayılır.
         (groupCount değişmez — grup butonları tüm leadleri gösterir.) --- */
  statusCount = function (name) {
    const s = statsScope();
    return name === "Tümü" ? s.length : s.filter(l => l.leadStatus === name).length;
  };
  classCount = function (key) {
    const s = statsScope();
    if (key === "tumu") return s.length;
    const f = CLASS_FILTERS.find(x => x.key === key);
    return f ? s.filter(l => (l.klass || "") === f.klass).length : 0;
  };
  actionCount = function (name) {
    const t = todayStr();
    const s = statsScope();
    if (name === "Tüm aksiyonlar") return s.length;
    if (name === "Bugün takip edilecekler") return s.filter(l => l.followUpDate === t).length;
    if (name === "Geciken takipler") return s.filter(l => l.followUpDate && l.followUpDate < t).length;
    return s.filter(l => !l.followUpDate).length;
  };
  callResultCount = function (name) {
    const s = statsScope();
    return name === "Tümü" ? s.length : s.filter(l => (l.callResult || "Seçilmedi") === name).length;
  };
  nextActionCount = function (name) {
    const s = statsScope();
    return name === "Tümü" ? s.length : s.filter(l => (l.nextAction || "Seçilmedi") === name).length;
  };

  /* --- Ürün grubu değişince üst paneli de yenile ---
         renderFilters() her çağrıldığında grup butonlarını yeniden
         kurar; buradaki delege dinleyici, tıklamadan (ve admin.js'in
         kendi handler'ından) sonra çalışıp panelleri tazeler. --- */
  function refreshPanels() {
    renderStats();
    renderStatusDist();
    renderClassDist();
    renderProductDist();
    renderFieldDist("distTonnage", null, "tonnage");
    renderFieldDist("distBudget", null, "budget");
    renderFilters();
  }

  function bindGroupClicks() {
    const gf = document.getElementById("groupFilters");
    if (!gf || gf.dataset.onizlemeBound) return;
    gf.dataset.onizlemeBound = "1";
    gf.addEventListener("click", (e) => {
      if (e.target.closest("button")) setTimeout(refreshPanels, 0);
    }, false);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", bindGroupClicks);
  else
    bindGroupClicks();

  console.info("[önizleme] Ürün grubuna göre üst panel yaması etkin.");
})();
