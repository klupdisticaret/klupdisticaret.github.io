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
  company: "", contact: "", phone: "", whatsapp: "", email: "", location: "", port: "",
};

// --- Adım tanımları ---
const STEPS = [
  { key: "group",      render: renderGroup,      valid: () => !!state.group },
  { key: "products",   render: renderProducts,   valid: () => state.products.length > 0 },
  { key: "tonnage",    render: () => renderChoice("tonnage", "Yaklaşık kaç ton alım yapmayı düşünüyorsunuz?",
      ["1 ton altı","1–5 ton","5–10 ton","10–20 ton","25 ton ve üzeri"]), valid: () => !!state.tonnage },
  { key: "budget",     render: () => renderChoice("budget", "Bu ithalat için yaklaşık bütçeniz nedir?",
      ["10.000 $ altı","10.000–25.000 $","25.000–50.000 $","50.000 $ üzeri","Henüz bilmiyorum"]), valid: () => !!state.budget },
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
  [["meyve","🍓 Meyve"],["sebze","🥦 Sebze"],["her ikisi","🍱 Her ikisi"]].forEach(([val,label]) => {
    const b = document.createElement("button");
    b.className = "choice choice--big" + (state.group === val ? " is-active" : "");
    b.innerHTML = label;
    b.addEventListener("click", () => {
      // grup değişince listede uyumsuz ürünleri temizle değil, sadece kaydet
      state.group = val;
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
    <p class="step__hint">Ürünlere tıklayarak seçin (birden fazla seçebilirsiniz).</p>
    <div class="choice-grid choice-grid--3" id="prodOptions"></div>
    <div class="add-other">
      <input id="prodInput" class="text-input" type="text" placeholder="Listede yoksa yazıp ekleyin (özellikle sebzeler)" autocomplete="off" />
      <button type="button" class="btn btn--add" id="addBtn">+ Ekle</button>
    </div>
    <div id="chips" class="chips"></div>
  `;
  els.content.appendChild(wrap);

  const optWrap = wrap.querySelector("#prodOptions");
  const input = wrap.querySelector("#prodInput");
  const addBtn = wrap.querySelector("#addBtn");
  const chips = wrap.querySelector("#chips");

  // Seçilen gruba göre bilinen ürünler
  let pool = PRODUCTS;
  if (state.group === "meyve") pool = PRODUCTS.filter(p => p.type === "meyve");
  else if (state.group === "sebze") pool = PRODUCTS.filter(p => p.type === "sebze");
  const known = pool.map(p => p.name);

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
        renderOptions(); renderChips();
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
        renderOptions(); renderChips();
      });
      chips.appendChild(c);
    });
    ensureNextButton(wrap, state.products.length > 0);
  };

  const addCustom = () => {
    const name = input.value.trim();
    if (!name) return;
    if (!isSelected(name)) state.products.push(name);
    input.value = ""; renderOptions(); renderChips(); input.focus();
  };
  addBtn.addEventListener("click", addCustom);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } });

  renderOptions();
  renderChips();
}

// --- Adım: Firma & iletişim ---
function renderContact() {
  const wrap = document.createElement("div");
  wrap.className = "step";
  wrap.innerHTML = `
    <h2 class="step__q">Firma ve iletişim bilgileriniz</h2>
    <p class="step__hint">Ön teklifinizi oluşturup size iletebilmemiz için.</p>
    <div class="form-grid">
      <label>Firma adı*<input id="f_company" class="text-input" value="${esc(state.company)}" required></label>
      <label>Yetkili kişi*<input id="f_contact" class="text-input" value="${esc(state.contact)}" required></label>
      <label>Telefon*<input id="f_phone" class="text-input" type="tel" value="${esc(state.phone)}" required></label>
      <label>E-posta*<input id="f_email" class="text-input" type="email" value="${esc(state.email)}" required></label>
      <label>Ülke / şehir<input id="f_location" class="text-input" value="${esc(state.location)}"></label>
      <label class="full">Teslimat limanı veya lokasyon<input id="f_port" class="text-input" value="${esc(state.port)}"></label>
    </div>
    <p id="formErr" class="form-err" hidden></p>
  `;
  els.content.appendChild(wrap);
  ensureNextButton(wrap, true, "Ön Teklifimi Oluştur");

  // canlı kayıt
  const map = { f_company:"company", f_contact:"contact", f_phone:"phone",
                f_email:"email", f_location:"location", f_port:"port" };
  Object.entries(map).forEach(([id, key]) => {
    wrap.querySelector("#" + id).addEventListener("input", e => state[key] = e.target.value);
  });
}

function validateContact() {
  const need = ["company","contact","phone","email"];
  const ok = need.every(k => (state[k] || "").trim().length > 0)
             && /\S+@\S+\.\S+/.test(state.email || "");
  const err = document.getElementById("formErr");
  if (err) {
    err.hidden = ok;
    err.textContent = ok ? "" : "Lütfen zorunlu (*) alanları ve geçerli bir e-posta girin.";
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
  els.counter.textContent = "Ön teklifiniz hazır 🎉";
  els.back.hidden = true;
  const p = buildProposal(state);
  window._lastProposal = p;
  renderProposal(p);
}

function renderProposal(p) {
  saveLead(p); // admin paneli için kaydet

  const eligible = isMeetingEligible(p.klass);
  const c = els.content;
  c.innerHTML = "";

  const card = document.createElement("div");
  card.className = "proposal";
  card.innerHTML = `
    <div class="proposal__head">
      <div>
        <h2>Ön Teklifiniz Hazır</h2>
        <p class="muted">Teklif No: ${p.refNo}</p>
      </div>
      <span class="lead-badge lead-${cssClass(p.klass)}">${p.klass}</span>
    </div>

    <div class="proposal__grid">
      <div><span>Ürün grubu</span><b>${esc(p.group)}</b></div>
      <div><span>Seçilen ürünler</span><b>${p.products.map(esc).join(", ") || "-"}</b></div>
      <div><span>Tahmini tonaj</span><b>${esc(p.tonnage)}</b></div>
      <div><span>Bütçe aralığı</span><b>${esc(p.budget)}</b></div>
      <div><span>İthalat zamanı</span><b>${esc(p.timing)}</b></div>
      <div class="price"><span>Ön fiyat aralığı</span><b>${esc(p.priceRange)}</b></div>
    </div>

    <ul class="proposal__notes">
      <li>🚚 ${esc(p.notes.delivery)}</li>
      <li>🏅 ${esc(p.notes.quality)}</li>
      <li>❄️ ${esc(p.notes.coldChain)}</li>
    </ul>

    <p class="disclaimer">⚠️ ${esc(p.disclaimer)}</p>

    <div class="actions">
      <a class="btn btn--wa" id="waBtn" target="_blank" rel="noopener">📲 WhatsApp'a Gönder</a>
      <a class="btn btn--mail" id="mailBtn">✉️ E-posta Gönder</a>
      <button class="btn btn--pdf" id="pdfBtn">📄 PDF İndir</button>
    </div>

    <div id="meetingArea"></div>
  `;
  c.appendChild(card);

  const refreshLinks = () => {
    document.getElementById("waBtn").href = whatsappLink(p);
    document.getElementById("mailBtn").href = mailtoLink(p);
  };
  refreshLinks();
  document.getElementById("pdfBtn").addEventListener("click", () => downloadProposalPDF(p));
  document.getElementById("mailBtn").addEventListener("click", () => { window.location.href = mailtoLink(p); });

  const area = document.getElementById("meetingArea");
  if (eligible) {
    renderMeeting(area, p, refreshLinks);
  } else {
    area.innerHTML = `<div class="meeting-note">✅ ${esc(p.notes.nextStep)}</div>`;
  }
}

function renderMeeting(area, p, refreshLinks) {
  area.innerHTML = `
    <div class="meeting">
      <h3>📅 Görüşme planlayın</h3>
      <p class="muted">Size özel bir görüşme saati seçin. Onay için WhatsApp özetinize eklenir.</p>
      <div class="slots" id="slots"></div>
      <a class="btn btn--cal" id="calBtn" target="_blank" rel="noopener" hidden>Google Takvime Ekle</a>
    </div>`;
  const slots = area.querySelector("#slots");
  const calBtn = area.querySelector("#calBtn");
  CONFIG.MEETING_SLOTS.forEach(slot => {
    const b = document.createElement("button");
    b.className = "slot";
    b.textContent = slot.label;
    b.addEventListener("click", () => {
      slots.querySelectorAll(".slot").forEach(s => s.classList.remove("is-active"));
      b.classList.add("is-active");
      p.selectedSlot = slot.label;
      calBtn.href = calendarLink(p, slot);
      calBtn.hidden = false;
      refreshLinks(); // WhatsApp/mail özetine seçilen saat eklensin
      updateLead(p);  // panele seçilen toplantı saatini yansıt
    });
    slots.appendChild(b);
  });
}

// --- küçük yardımcılar ---
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function cssClass(klass) {
  return { "VIP Lead":"vip","Sıcak Lead":"hot","Takip Edilecek Lead":"follow","Düşük Lead":"low" }[klass] || "low";
}
function shake() {
  els.content.classList.remove("shake");
  void els.content.offsetWidth;
  els.content.classList.add("shake");
}
