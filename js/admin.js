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
let activeFilter = "all";

// Lead durumları (madde 18)
const STATUSES = [
  "Yeni lead", "İncelenecek", "WhatsApp'a yönlendirildi", "Manuel aranacak",
  "Toplantı açılabilir", "Toplantı planlandı", "Görüşme yapıldı", "Beklemede",
  "Siparişe döndü", "Uygun değil",
];
function normStatus(s) {
  if (!s || s === "Yeni") return "Yeni lead";
  if (s === "Toplantı Planlandı") return "Toplantı planlandı"; // eski kayıt uyumu
  return s;
}
function statusClass(s) {
  return {
    "Yeni lead": "st-yeni", "İncelenecek": "st-teklif", "WhatsApp'a yönlendirildi": "st-toplanti",
    "Manuel aranacak": "st-takip", "Toplantı açılabilir": "st-gorusme", "Toplantı planlandı": "st-sozlesme",
    "Görüşme yapıldı": "st-siparis", "Beklemede": "st-kalite", "Siparişe döndü": "st-teslimat",
    "Uygun değil": "st-kayip",
  }[s] || "st-yeni";
}

// Filtre tanımları (madde 19)
const FILTERS = [
  { key: "all",   label: "Tümü",              test: () => true },
  { key: "t1",    label: "1–5 ton",           test: l => l.tonnage === "1–5 ton" },
  { key: "t2",    label: "10–15 ton",         test: l => l.tonnage === "10–15 ton" },
  { key: "t3",    label: "20–25 ton (Sıcak)", test: l => l.tonnage === "20–25 ton" },
  { key: "t4",    label: "25+ ton (VIP)",     test: l => l.tonnage === "25 ton üzeri" },
  { key: "wa",    label: "WhatsApp'a yönlenen", test: l => l.waShown || l.status === "WhatsApp'a yönlendirildi" },
  { key: "meet",  label: "Toplantı planlayan", test: l => !!l.selectedSlot || l.status === "Toplantı planlandı" },
  { key: "call",  label: "Manuel aranacak",   test: l => l.status === "Manuel aranacak" },
  { key: "wait",  label: "Bekleyenler",       test: l => l.status === "Beklemede" },
  { key: "order", label: "Siparişe dönenler", test: l => l.status === "Siparişe döndü" },
];

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
function showPanel() { gate.hidden = true; admin.hidden = false; renderFilters(); renderAll(); }

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
    notes: r.notes || "", nextFollowup: r.next_followup || "",
  };
}
function localLeads() {
  try {
    return (JSON.parse(localStorage.getItem(STORAGE_KEY)) || []).map(l =>
      Object.assign({ status: "Yeni lead", notes: "", nextFollowup: "",
        leadGroup: l.leadGroup, waShown: l.showWhatsapp, meetingShown: l.showMeeting },
        l, { status: normStatus(l.status) }));
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
  renderStats(CACHE);
  renderStatusDist(CACHE);
  renderClassDist(CACHE);
  renderProductDist(CACHE);
  renderFieldDist("distTonnage", CACHE, "tonnage");
  renderFieldDist("distBudget", CACHE, "budget");
  renderTable(getFiltered());
}

function getFiltered() {
  const f = FILTERS.find(x => x.key === activeFilter) || FILTERS[0];
  return CACHE.filter(f.test);
}

/* --- Filtre butonları (madde 19) --- */
function renderFilters() {
  const bar = document.getElementById("filters");
  if (!bar) return;
  bar.innerHTML = "";
  FILTERS.forEach(f => {
    const b = document.createElement("button");
    b.className = "filter-btn" + (f.key === activeFilter ? " is-active" : "");
    b.textContent = f.label;
    b.addEventListener("click", () => {
      activeFilter = f.key;
      bar.querySelectorAll(".filter-btn").forEach(x => x.classList.remove("is-active"));
      b.classList.add("is-active");
      renderTable(getFiltered());
    });
    bar.appendChild(b);
  });
}

/* --- İstatistikler --- */
function renderStats(leads) {
  const total = leads.length;
  const hotVip = leads.filter(l => l.klass === "Sıcak Lead" || l.klass === "VIP Lead").length;
  const meetings = leads.filter(l => l.selectedSlot).length;
  const orders = leads.filter(l => l.status === "Siparişe döndü").length;
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
  const pairs = STATUSES.map(s => [s, leads.filter(l => l.status === s).length]).filter(p => p[1] > 0);
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

/* --- Tablo (tıklanabilir satırlar) --- */
function renderTable(leads) {
  const table = document.getElementById("leadTable");
  if (!leads.length) {
    table.innerHTML = `<tr><td class="empty">Bu filtrede lead yok.</td></tr>`;
    return;
  }
  const head = `<tr>
    <th>Tarih</th><th>Firma</th><th>Grup</th><th>Ürünler</th>
    <th>Tonaj</th><th>Sınıf</th><th>Durum</th><th>Telefon</th></tr>`;
  const rows = leads.map((l, idx) => `<tr class="clickable" data-idx="${idx}">
    <td>${l.createdAt ? new Date(l.createdAt).toLocaleDateString("tr-TR") : "-"}</td>
    <td>${escapeHtml(l.company)}</td>
    <td>${escapeHtml(l.leadGroup || "-")}</td>
    <td>${escapeHtml((l.products || []).join(", "))}</td>
    <td>${escapeHtml(l.tonnage)}</td>
    <td><span class="lead-badge lead-${cssClass(l.klass)}">${escapeHtml(l.klass)}</span></td>
    <td><span class="status-badge ${statusClass(l.status)}">${escapeHtml(l.status)}</span></td>
    <td>${escapeHtml(l.phone)}</td>
  </tr>`).join("");
  table.innerHTML = head + rows;
  table.querySelectorAll("tr.clickable").forEach(tr => {
    tr.addEventListener("click", () => openCard(leads[+tr.dataset.idx]));
  });
}

/* --- Müşteri Kartı (CRM) --- */
const overlay = document.getElementById("overlay");
document.getElementById("cardClose").addEventListener("click", closeCard);
overlay.addEventListener("click", e => { if (e.target === overlay) closeCard(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeCard(); });
function closeCard() { overlay.hidden = true; }

function openCard(lead) {
  document.getElementById("cardTitle").textContent = lead.company || lead.contact || "Müşteri Kartı";
  document.getElementById("cardRef").textContent =
    (lead.refNo ? "Talep No: " + lead.refNo + "  •  " : "") +
    (lead.createdAt ? new Date(lead.createdAt).toLocaleString("tr-TR") : "");

  const kv = (s, v) => `<div><span>${s}</span><b>${escapeHtml(v || "-")}</b></div>`;
  const yn = (v) => v ? "Evet" : "Hayır";
  const options = STATUSES
    .map(s => `<option value="${escapeHtml(s)}"${s === lead.status ? " selected" : ""}>${escapeHtml(s)}</option>`).join("");

  document.getElementById("cardBody").innerHTML = `
    <div class="kv">
      ${kv("Ad soyad (yetkili)", lead.contact)}
      ${kv("Firma adı", lead.company)}
      ${kv("Telefon", lead.phone)}
      ${kv("WhatsApp", lead.whatsapp)}
      ${kv("Şehir", lead.location)}
      ${kv("Liman", lead.port)}
      ${kv("Ürün tipi", lead.group)}
      ${kv("Girilen ürünler", (lead.products || []).join(", "))}
      ${kv("Tonaj", lead.tonnage)}
      ${kv("Bütçe", lead.budget)}
      ${kv("İthalat zamanı", lead.timing)}
      ${kv("Daha önce ithalat?", lead.experience)}
      ${kv("Lead grubu", lead.leadGroup)}
      ${kv("Lead etiketi", lead.klass)}
      ${kv("Lead puanı", lead.score == null ? "-" : String(lead.score))}
      ${kv("WhatsApp gösterildi mi?", yn(lead.waShown))}
      ${kv("Toplantı gösterildi mi?", yn(lead.meetingShown))}
      ${kv("Seçilen görüşme", lead.selectedSlot)}
    </div>

    ${lead.tonnage === "20–25 ton" ? `<div class="manual-note">ℹ️ 20–25 ton (Sıcak) lead — toplantı otomatik açılmaz. Uygunsa durumu <b>"Toplantı açılabilir"</b> yapıp müşteriye WhatsApp'tan görüşme linki gönderebilirsiniz.</div>` : ""}

    <span class="field-label">Lead durumu</span>
    <select id="stSelect" class="text-input">${options}</select>

    <span class="field-label">Sonraki takip tarihi</span>
    <input id="stFollow" class="text-input" type="date" value="${escapeHtml(lead.nextFollowup || "")}">

    <span class="field-label">Admin notu</span>
    <textarea id="stNotes" class="text-input" placeholder="Görüşme notu, hatırlatma, teklif detayı...">${escapeHtml(lead.notes || "")}</textarea>

    <div class="card-actions">
      <button class="btn btn--cta" id="stSave" style="flex:1">💾 Kaydet</button>
      <a class="btn btn--wa" id="stWa" target="_blank" rel="noopener">📲 WhatsApp</a>
    </div>
    <p id="stMsg" style="margin:10px 0 0"></p>
  `;

  const waNum = ((lead.whatsapp || lead.phone) || "").replace(/[^0-9]/g, "").replace(/^0/, "90");
  const waBtn = document.getElementById("stWa");
  if (waNum.length >= 10) waBtn.href = "https://wa.me/" + waNum;
  else waBtn.style.display = "none";

  document.getElementById("stSave").addEventListener("click", () => saveCard(lead));
  overlay.hidden = false;
}

async function saveCard(lead) {
  const status = document.getElementById("stSelect").value;
  const notes = document.getElementById("stNotes").value;
  const nextFollowup = document.getElementById("stFollow").value;
  const msg = document.getElementById("stMsg");
  lead.status = status; lead.notes = notes; lead.nextFollowup = nextFollowup;

  if (sb && lead.id != null) {
    msg.textContent = "Kaydediliyor…"; msg.className = "muted";
    const { error } = await sbAdminUpdate(lead.id, { status, notes, next_followup: nextFollowup || null });
    if (error) { msg.textContent = "Hata: " + error; msg.className = "form-err"; return; }
    msg.textContent = "✓ Kaydedildi"; msg.className = "save-ok";
  } else {
    try {
      const arr = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      const i = arr.findIndex(x => x.refNo === lead.refNo);
      if (i >= 0) { arr[i].status = status; arr[i].notes = notes; arr[i].nextFollowup = nextFollowup;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
    } catch (e) {}
    msg.textContent = "✓ Kaydedildi (yerel)"; msg.className = "save-ok";
  }
  renderStatusDist(CACHE); renderStats(CACHE); renderTable(getFiltered());
}

/* --- Dışa aktarma --- */
function exportJSON() { download("leadler.json", JSON.stringify(CACHE, null, 2), "application/json"); }
function exportCSV() {
  const cols = ["createdAt","refNo","company","contact","phone","whatsapp","location","port",
                "group","products","tonnage","budget","timing","experience","leadGroup","klass","score",
                "selectedSlot","status","nextFollowup","notes"];
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
document.getElementById("exportCsv").addEventListener("click", exportCSV);
document.getElementById("exportJson").addEventListener("click", exportJSON);
document.getElementById("refresh").addEventListener("click", renderAll);

/* --- yardımcılar --- */
function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function cssClass(klass) {
  return {
    "VIP Lead":"vip", "Sıcak Lead":"hot", "Takip Edilecek Lead":"follow",
    "Düşük Öncelikli Lead":"low", "Düşük Lead":"low",
  }[klass] || "low";
}
