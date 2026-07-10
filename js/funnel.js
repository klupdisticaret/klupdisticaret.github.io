/* =============================================================
   FUNNEL KONTROLCÜSÜ
   Adımları yönetir, state tutar, ilerleme çubuğunu günceller,
   sonunda ön teklifi oluşturup ekrana basar.
   ============================================================= */

document.getElementById("year").textContent = new Date().getFullYear();

const state = {
  group: "",          // meyve / sebze / her ikisi
  products: [],       // seçilen ürünler
  tonnage: "",
  budget: "",
  timing: "",
  experience: "",
  company: "", contact: "", phone: "", whatsapp: "", location: "", port: "",
};

/* --- Form hatırlama (Aa.txt madde 10) ---
   Girilen bilgiler localStorage'da saklanır, tekrar gelince otomatik dolar. */
const DRAFT_KEY = "klup_form_draft";
function saveDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(state)); } catch (e) {}
}
function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY));
    if (d && typeof d === "object") {
      Object.keys(state).forEach(k => { if (d[k] != null) state[k] = d[k]; });
    }
  } catch (e) {}
}
loadDraft();

// --- Adım tanımları ---
const STEPS = [
  { key: "group",      render: renderGroup,      valid: () => !!state.group },
  { key: "products",   render: renderProducts,   valid: () => state.products.length > 0 },
  { key: "tonnage",    render: () => renderChoice("tonnage", "Yaklaşık kaç ton alım yapmayı düşünüyorsunuz?",
      ["1–5 ton","10–15 ton","20–25 ton","25 ton üzeri"]), valid: () => !!state.tonnage },
  { key: "budget",     render: () => renderChoice("budget", "Bu ithalat için yaklaşık bütçeniz nedir?",
      ["10.000 USD altı","10.000 – 25.000 USD","25.000 – 50.000 USD","50.000 USD üzeri"]), valid: () => !!state.budget },
  { key: "timing",     render: () => renderChoice("timing", "Ne zaman ithalat yapmak istiyorsunuz?",
      ["Hemen","1 ay içinde","1–3 ay içinde","3–6 ay içinde","Sadece araştırıyorum"]), valid: () => !!state.timing },
  { key: "experience", render: () => renderChoice("experience", "Daha önce ithalat yaptınız mı?",
      ["Evet, düzenli ithalat yapıyoruz","Evet, birkaç kez yaptık","Hayır, ilk kez yapacağız","Sadece araştırıyoruz"]), valid: () => !!state.experience },
  { key: "contact",    render: renderContact,    valid: validateContact },
];

let current = 0;

const els = {
  hero: document.getElementById("hero"),
  funnel: document.getElementById("funnel"),
  content: document.getElementById("stepContent"),
  progress: document.getElementById("progress"),
  counter: document.getElementById("stepCounter"),
  back: document.getElementById("backBtn"),
};

document.getElementById("startBtn").addEventListener("click", () => {
  els.hero.hidden = true;
  els.funnel.hidden = false;
  current = 0;
  showStep();
  els.funnel.scrollIntoView({ behavior: "smooth" });
});

els.back.addEventListener("click", () => {
  if (current > 0) { current--; showStep(); }
});

function showStep() {
  const step = STEPS[current];
  els.content.innerHTML = "";
  step.render();
  els.counter.textContent = `Adım ${current + 1} / ${STEPS.length}`;
  els.progress.style.width = `${(current / STEPS.length) * 100}%`;
  els.back.hidden = current === 0;
  els.content.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function goNext() {
  const step = STEPS[current];
  if (!step.valid()) { shake(); return; }
  if (current < STEPS.length - 1) { current++; showStep(); }
  else finish();
}

// --- Yardımcı: kart seçim adımı (tek seçim) ---
function renderChoice(key, question, options) {
  const wrap = document.createElement("div");
  wrap.className = "step";
  wrap.innerHTML = `<h2 class="step__q">${question}</h2>`;
  const grid = document.createElement("div");
  grid.className = "choice-grid";
  options.forEach(opt => {
    const b = document.createElement("button");
    b.className = "choice" + (state[key] === opt ? " is-active" : "");
    b.textContent = opt;
    b.addEventListener("click", () => {
      state[key] = opt;
      saveDraft();
      grid.querySelectorAll(".choice").forEach(c => c.classList.remove("is-active"));
      b.classList.add("is-active");
      setTimeout(goNext, 180); // seçince otomatik ilerle
    });
    grid.appendChild(b);
  });
  wrap.appendChild(grid);
  els.content.appendChild(wrap);
}

// --- Adım: Ürün grubu ---
function renderGroup() {
  const wrap = document.createElement("div");
  wrap.className = "step";
  wrap.innerHTML = `<h2 class="step__q">Hangi ürün grubu ile ilgileniyorsunuz?</h2>`;
  const grid = document.createElement("div");
  grid.className = "choice-grid choice-grid--3";
  [["meyve","🍓 Meyve"],["sebze","🥦 Sebze"],["deniz","🐟 Deniz ürünleri"],["bakliyat","🫘 Bakliyat"],["hepsi","🧺 Hepsi"]].forEach(([val,label]) => {
    const b = document.createElement("button");
    b.className = "choice choice--big" + (state.group === val ? " is-active" : "");
    b.innerHTML = label;
    b.addEventListener("click", () => {
      // grup değişince listede uyumsuz ürünleri temizle değil, sadece kaydet
      state.group = val;
      saveDraft();
      grid.querySelectorAll(".choice").forEach(c => c.classList.remove("is-active"));
      b.classList.add("is-active");
      setTimeout(goNext, 180);
    });
    grid.appendChild(b);
  });
  wrap.appendChild(grid);
  els.content.appendChild(wrap);
}

// --- Adım: Ürün seçimi (tıklanabilir seçenekler) ---
function renderProducts() {
  const wrap = document.createElement("div");
  wrap.className = "step";
  wrap.innerHTML = `
    <h2 class="step__q">Hangi ürünleri ithal etmek istiyorsunuz?</h2>
    <p class="step__hint">Ürünlere tıklayarak seçin veya aşağıya yazın (birden fazla seçebilirsiniz).</p>
    <div class="choice-grid choice-grid--3" id="prodOptions"></div>
    <div class="add-other">
      <div class="autocomplete" style="flex:1">
        <input id="prodInput" class="text-input" type="text" placeholder="Ürün yazın (örn: ahu... / brok...)" autocomplete="off" />
        <div id="suggestions" class="suggestions"></div>
      </div>
      <button type="button" class="btn btn--add" id="addBtn">+ Ekle</button>
    </div>
    <div id="chips" class="chips"></div>
  `;
  els.content.appendChild(wrap);

  const optWrap = wrap.querySelector("#prodOptions");
  const input = wrap.querySelector("#prodInput");
  const sug = wrap.querySelector("#suggestions");
  const addBtn = wrap.querySelector("#addBtn");
  const chips = wrap.querySelector("#chips");

  // Seçilen gruba göre bilinen ürünler
  let pool = PRODUCTS;
  if (state.group === "meyve") pool = PRODUCTS.filter(p => p.type === "meyve");
  else if (state.group === "sebze") pool = PRODUCTS.filter(p => p.type === "sebze");
  else if (state.group === "deniz") pool = PRODUCTS.filter(p => p.type === "deniz");
  else if (state.group === "bakliyat") pool = PRODUCTS.filter(p => p.type === "bakliyat");
  const known = [...new Set(pool.map(p => p.name))];

  const eq = (a, b) => a.toLocaleLowerCase("tr") === b.toLocaleLowerCase("tr");
  const isSelected = (name) => state.products.some(p => eq(p, name));

  const renderOptions = () => {
    optWrap.innerHTML = "";
    known.forEach(name => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "choice" + (isSelected(name) ? " is-active" : "");
      b.textContent = name;
      b.addEventListener("click", () => {
        if (isSelected(name)) state.products = state.products.filter(p => !eq(p, name));
        else state.products.push(name);
        saveDraft(); renderOptions(); renderChips();
      });
      optWrap.appendChild(b);
    });
  };

  const renderChips = () => {
    // yalnızca listede olmayan (elle eklenen) ürünler chip olarak gösterilir
    const custom = state.products.filter(p => !known.some(k => eq(k, p)));
    chips.innerHTML = custom.length
      ? `<p class="step__hint" style="margin:12px 0 8px">Eklediğiniz diğer ürünler:</p>` : "";
    custom.forEach(p => {
      const c = document.createElement("span");
      c.className = "chip";
      c.innerHTML = `${esc(p)} <button aria-label="kaldır">✕</button>`;
      c.querySelector("button").addEventListener("click", () => {
        state.products = state.products.filter(x => x !== p);
        saveDraft(); renderOptions(); renderChips();
      });
      chips.appendChild(c);
    });
    ensureNextButton(wrap, state.products.length > 0);
  };

  const addCustom = (name) => {
    name = (name || input.value).trim();
    if (!name) return;
    if (!isSelected(name)) state.products.push(name);
    input.value = ""; sug.innerHTML = ""; saveDraft(); renderOptions(); renderChips(); input.focus();
  };

  // Autocomplete önerileri (madde 8)
  input.addEventListener("input", () => {
    const list = suggestProducts(input.value, state.group);
    sug.innerHTML = "";
    list.forEach(name => {
      const item = document.createElement("button");
      item.type = "button"; item.className = "suggestion"; item.textContent = name;
      item.addEventListener("click", () => addCustom(name));
      sug.appendChild(item);
    });
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const first = sug.querySelector(".suggestion");
      addCustom(first ? first.textContent : input.value);
    }
  });
  addBtn.addEventListener("click", () => addCustom());

  renderOptions();
  renderChips();
}

// --- Adım: Firma & iletişim ---
function renderContact() {
  const wrap = document.createElement("div");
  wrap.className = "step";
  const cityOpts = CONFIG.CITIES.map(c => `<option value="${esc(c)}">`).join("");
  const portOpts = CONFIG.PORTS.map(p => `<option value="${esc(p)}">`).join("");
  wrap.innerHTML = `
    <h2 class="step__q">Firma ve iletişim bilgileriniz</h2>
    <p class="step__hint">Talebinizi oluşturup size ulaşabilmemiz için.</p>
    <div class="form-grid">
      <label class="bold">Şirket adı*<input id="f_company" class="text-input" value="${esc(state.company)}" required></label>
      <label class="bold">Yetkili kişi*<input id="f_contact" class="text-input" value="${esc(state.contact)}" required></label>
      <label class="bold">Telefon*<input id="f_phone" class="text-input" type="tel" value="${esc(state.phone)}" required></label>
      <label class="bold">Şehir*<input id="f_location" class="text-input" list="cityList" value="${esc(state.location)}" placeholder="Örn: İzmir" required><datalist id="cityList">${cityOpts}</datalist></label>
      <label class="bold">Liman<input id="f_port" class="text-input" list="portList" value="${esc(state.port)}" placeholder="Opsiyonel"><datalist id="portList">${portOpts}</datalist></label>
    </div>
    <p id="formErr" class="form-err" hidden></p>
  `;
  els.content.appendChild(wrap);
  ensureNextButton(wrap, true, "Talebimi Gönder");

  // canlı kayıt + hatırlama
  const map = { f_company:"company", f_contact:"contact", f_phone:"phone",
                f_location:"location", f_port:"port" };
  Object.entries(map).forEach(([id, key]) => {
    wrap.querySelector("#" + id).addEventListener("input", e => { state[key] = e.target.value; saveDraft(); });
  });
}

function validateContact() {
  const need = ["company","contact","phone","location"]; // şehir zorunlu, e-posta yok
  const ok = need.every(k => (state[k] || "").trim().length > 0);
  const err = document.getElementById("formErr");
  if (err) {
    err.hidden = ok;
    err.textContent = ok ? "" : "Lütfen zorunlu (*) alanları doldurun (şirket, yetkili, telefon, şehir).";
  }
  return ok;
}

// --- Her adıma "Devam" butonu ekler (kart adımları otomatik ilerlediği için onlarda gerekmez) ---
function ensureNextButton(wrap, enabled, label = "Devam →") {
  let btn = wrap.querySelector(".btn--next");
  if (!btn) {
    btn = document.createElement("button");
    btn.className = "btn btn--next";
    btn.addEventListener("click", goNext);
    wrap.appendChild(btn);
  }
  btn.textContent = label;
  btn.disabled = !enabled;
}

// --- Final: ön teklif oluştur ---
function finish() {
  els.progress.style.width = "100%";
  els.counter.textContent = "Talebiniz alındı";
  els.back.hidden = true;
  const p = buildProposal(state);
  window._lastProposal = p;
  renderProposal(p);
}

function renderProposal(p) {
  saveLead(p); // CRM'e kaydet (fiyat/PDF/e-posta yok)

  const c = els.content;
  c.innerHTML = "";

  const waIcon = `<svg class="wa-ico" viewBox="0 0 32 32" fill="#ffffff" aria-hidden="true"><path d="M16 .5C7.4.5.5 7.4.5 16c0 2.8.7 5.4 2 7.8L.5 31.5l7.9-2c2.3 1.2 4.9 1.9 7.6 1.9 8.6 0 15.5-6.9 15.5-15.5S24.6.5 16 .5zm0 28.3c-2.4 0-4.7-.6-6.7-1.8l-.5-.3-4.7 1.2 1.2-4.6-.3-.5c-1.3-2.1-2-4.5-2-7 0-7.2 5.9-13.1 13.1-13.1S29.1 8.8 29.1 16 23.2 28.8 16 28.8zm7.2-9.8c-.4-.2-2.3-1.1-2.7-1.3-.4-.1-.6-.2-.9.2-.3.4-1 1.3-1.2 1.5-.2.2-.4.3-.8.1-.4-.2-1.7-.6-3.2-2-1.2-1.1-2-2.4-2.2-2.8-.2-.4 0-.6.2-.8.2-.2.4-.4.5-.7.2-.2.2-.4.3-.6.1-.3 0-.5 0-.7-.1-.2-.9-2.1-1.2-2.9-.3-.8-.6-.7-.9-.7h-.7c-.2 0-.6.1-.9.5-.3.4-1.2 1.2-1.2 2.9s1.2 3.4 1.4 3.6c.2.2 2.4 3.7 5.9 5.2.8.4 1.5.6 2 .8.8.3 1.6.2 2.2.1.7-.1 2.3-.9 2.6-1.8.3-.9.3-1.6.2-1.8-.1-.1-.3-.2-.7-.4z"/></svg>`;
  const waBtnHtml = p.showWhatsapp
    ? `<a class="btn btn--wa" id="waBtn" target="_blank" rel="noopener"><span class="wa-txt">WhatsApp ile Teklifimi gönder${waIcon}</span></a>`
    : "";

  const card = document.createElement("div");
  card.className = "proposal";
  card.innerHTML = `
    <div class="proposal__head">
      <div>
        <h2>Talebiniz Alındı</h2>
        <p class="muted">Talep No: ${p.refNo}</p>
      </div>
    </div>

    <div class="proposal__grid">
      <div><span>Ürün grubu</span><b>${esc(p.group)}</b></div>
      <div><span>Seçilen ürünler</span><b>${p.products.map(esc).join(", ") || "-"}</b></div>
      <div><span>Tahmini tonaj</span><b>${esc(p.tonnage)}</b></div>
      <div><span>Bütçe</span><b>${esc(p.budget)}</b></div>
      <div><span>İthalat zamanı</span><b>${esc(p.timing)}</b></div>
      <div><span>Şehir</span><b>${esc(p.location) || "-"}</b></div>
    </div>

    <div class="info-box">✅ ${esc(p.message)}</div>

    <div id="meetingArea"></div>

    ${waBtnHtml ? `<div class="actions actions--single" style="margin-top:16px">${waBtnHtml}</div>` : ""}
  `;
  c.appendChild(card);

  if (p.showWhatsapp) {
    const refreshLinks = () => { document.getElementById("waBtn").href = whatsappLink(p); };
    refreshLinks();
    const area = document.getElementById("meetingArea");
    if (p.showMeeting) renderMeeting(area, p, refreshLinks);
  }
}

function renderMeeting(area, p, refreshLinks) {
  const pad = n => String(n).padStart(2, "0");
  const days = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
                  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  // en erken yarın seçilebilsin
  const minD = new Date(); minD.setHours(0, 0, 0, 0); minD.setDate(minD.getDate() + 1);

  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const ALL_TIMES = []; for (let h = 10; h <= 18; h++) ALL_TIMES.push(pad(h) + ":00");
  // Dolu (rezerve) saatler: "YYYY-MM-DD" -> ["14:00", ...] (Supabase'den; yoksa boş = hepsi uygun)
  let booked = {};

  area.innerHTML = `
    <div class="meeting">
      <h3>📅 Görüşme planlayın</h3>
      <p class="muted">Takvimden uygun günü, aşağıdan saati seçin (10:00–18:00). Yalnızca hafta içi ve boş saatler seçilebilir; <b>dolu saatler listede görünmez.</b> Onay için WhatsApp mesajınıza eklenir.</p>
      <div class="cal">
        <div class="cal__head">
          <button type="button" class="cal__nav" id="calPrev" aria-label="Önceki ay">‹</button>
          <span class="cal__title" id="calTitle"></span>
          <button type="button" class="cal__nav" id="calNext" aria-label="Sonraki ay">›</button>
        </div>
        <div class="cal__grid cal__dow">
          <span>Pzt</span><span>Sal</span><span>Çar</span><span>Per</span><span>Cum</span><span>Cmt</span><span>Paz</span>
        </div>
        <div class="cal__grid cal__days" id="calDays"></div>
      </div>
      <label class="bold" style="display:block;margin-top:16px">Saat (10:00–18:00)
        <select id="mTime" class="text-input" disabled>
          <option value="" disabled selected>Önce gün seçin</option>
        </select>
      </label>
      <p id="mChosen" style="margin-top:14px;font-weight:700;color:var(--ink)" hidden></p>
    </div>`;

  const titleEl = area.querySelector("#calTitle");
  const daysEl  = area.querySelector("#calDays");
  const prevBtn = area.querySelector("#calPrev");
  const nextBtn = area.querySelector("#calNext");
  const timeEl  = area.querySelector("#mTime");
  const chosen  = area.querySelector("#mChosen");

  let view = new Date(minD.getFullYear(), minD.getMonth(), 1); // görüntülenen ay
  let sel = null;                                              // seçilen gün

  const sameDay = (a, b) => a && b &&
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const availFor = key => ALL_TIMES.filter(t => (booked[key] || []).indexOf(t) < 0);
  const isFull = date => { const dw = date.getDay(); if (dw === 0 || dw === 6) return false; return availFor(ymd(date)).length === 0; };

  // Seçilen güne göre saat menüsünü kur (dolu saatler gösterilmez)
  const renderTimes = () => {
    if (!sel) { timeEl.innerHTML = `<option value="" disabled selected>Önce gün seçin</option>`; timeEl.disabled = true; return; }
    const avail = availFor(ymd(sel));
    if (!avail.length) {
      timeEl.innerHTML = `<option value="" disabled selected>Bu gün dolu — başka gün seçin</option>`; timeEl.disabled = true;
    } else {
      timeEl.disabled = false;
      timeEl.innerHTML = `<option value="" disabled selected>Saat seçin</option>` + avail.map(t => `<option value="${t}">${t}</option>`).join("");
    }
  };

  const update = async () => {
    if (sel && timeEl.value) {
      const t = timeEl.value, key = ymd(sel);
      p.selectedSlot = `${sel.getDate()} ${months[sel.getMonth()]} ${sel.getFullYear()} ${days[sel.getDay()]}, ${t}`;
      p.slotKey = `${key} ${t}`;
      chosen.style.color = "var(--ink)";
      chosen.textContent = "Seçilen görüşme: " + p.selectedSlot;
      chosen.hidden = false;
      refreshLinks(); // WhatsApp özetine seçilen tarih/saat eklensin
      const res = await updateLead(p); // panele + rezervasyona yansıt
      if (res && res.conflict) {
        // Bu saat az önce başkası tarafından alındı -> gizle ve uyar
        (booked[key] = booked[key] || []).push(t);
        p.selectedSlot = ""; p.slotKey = "";
        chosen.style.color = "#c0392b";
        chosen.textContent = "⚠️ Bu saat az önce doldu. Lütfen başka bir saat seçin.";
        chosen.hidden = false;
        refreshLinks();
        renderTimes(); renderCal();
      }
    } else {
      p.selectedSlot = ""; p.slotKey = "";
      chosen.hidden = true;
      refreshLinks();
    }
  };

  const renderCal = () => {
    titleEl.textContent = `${months[view.getMonth()]} ${view.getFullYear()}`;
    daysEl.innerHTML = "";
    const lead = (new Date(view.getFullYear(), view.getMonth(), 1).getDay() + 6) % 7; // Pzt=0
    const total = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    for (let i = 0; i < lead; i++) daysEl.appendChild(document.createElement("span"));
    for (let d = 1; d <= total; d++) {
      const date = new Date(view.getFullYear(), view.getMonth(), d);
      const dow = date.getDay();
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cal__day";
      b.textContent = d;
      const off = date < minD || dow === 0 || dow === 6;
      const full = !off && isFull(date);
      if (off) { b.disabled = true; b.classList.add("is-off"); }
      else if (full) { b.disabled = true; b.classList.add("is-full"); b.title = "Bu gün dolu"; }
      if (sameDay(date, sel)) b.classList.add("is-sel");
      if (!off && !full) b.addEventListener("click", () => { sel = date; renderCal(); renderTimes(); update(); });
      daysEl.appendChild(b);
    }
    const atMin = view.getFullYear() === minD.getFullYear() && view.getMonth() === minD.getMonth();
    prevBtn.disabled = atMin;
    prevBtn.classList.toggle("is-off", atMin);
  };

  prevBtn.addEventListener("click", () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); renderCal(); });
  nextBtn.addEventListener("click", () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderCal(); });
  timeEl.addEventListener("change", update);

  renderCal();
  renderTimes();

  // Dolu saatleri Supabase'den çek (varsa) ve takvimi/saatleri tazele
  if (typeof sbBookedSlots === "function") {
    sbBookedSlots().then(keys => {
      booked = {};
      (keys || []).forEach(k => { const s = String(k).split(" "); if (s.length >= 2) (booked[s[0]] = booked[s[0]] || []).push(s[1]); });
      renderCal(); renderTimes();
    }).catch(() => {});
  }
}

// --- küçük yardımcılar ---
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function cssClass(klass) {
  return {
    "VIP Lead":"vip", "Sıcak Lead":"hot", "Takip Edilecek Lead":"follow",
    "Düşük Öncelikli Lead":"low", "Düşük Lead":"low",
  }[klass] || "low";
}
function shake() {
  els.content.classList.remove("shake");
  void els.content.offsetWidth;
  els.content.classList.add("shake");
}
