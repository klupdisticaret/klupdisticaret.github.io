/* =============================================================
   YÖNETİM PANELİ (CRM)
   Supabase hesabıyla giriş → merkezi leadler.
   Müşteri kartı: tüm bilgiler + süreç durumu (takip/sipariş) + not.
   Supabase yoksa/okunamazsa yerel (localStorage) veriye düşer.
   ============================================================= */

const STORAGE_KEY = "klup_leads";
const gate = document.getElementById("gate");
const admin = document.getElementById("admin");
const pwErr = document.getElementById("pwErr");
let CACHE = [];

// Süreç aşamaları (Takip & Bildirimler + Anlaşma & Sipariş Süreci)
const STATUS_STAGES = [
  "Yeni",
  "Teklif Gönderildi",
  "Toplantı Planlandı",
  "Görüşme Yapıldı",
  "Teklif Takipte",
  "Teklif Kabul Edildi",
  "Sözleşme İmzalandı",
  "Sipariş Oluşturuldu",
  "Kalite Kontrol",
  "Sevkiyat Planlandı",
  "Teslimat Tamamlandı",
];
const STATUS_LOST = "Kaybedildi";

function statusClass(s) {
  return {
    "Yeni": "st-yeni", "Teklif Gönderildi": "st-teklif", "Toplantı Planlandı": "st-toplanti",
    "Görüşme Yapıldı": "st-gorusme", "Teklif Takipte": "st-takip", "Teklif Kabul Edildi": "st-kabul",
    "Sözleşme İmzalandı": "st-sozlesme", "Sipariş Oluşturuldu": "st-siparis", "Kalite Kontrol": "st-kalite",
    "Sevkiyat Planlandı": "st-sevkiyat", "Teslimat Tamamlandı": "st-teslimat", [STATUS_LOST]: "st-kayip",
  }[s] || "st-yeni";
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
function showPanel() { gate.hidden = true; admin.hidden = false; renderAll(); }

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
    score: r.score, klass: r.klass, selectedSlot: r.selected_slot,
    status: r.status || "Yeni", notes: r.notes || "",
  };
}
function localLeads() {
  try {
    return (JSON.parse(localStorage.getItem(STORAGE_KEY)) || [])
      .map(l => Object.assign({ status: "Yeni", notes: "" }, l));
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
    note.innerHTML = "✅ Merkezi veritabanı (Supabase) — tüm cihazlardan gelen <b>" +
      data.length + "</b> lead. Yedek için CSV/JSON indirin.";
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
  renderTable(CACHE);
}

/* --- İstatistikler --- */
function renderStats(leads) {
  const total = leads.length;
  const hotVip = leads.filter(l => l.klass === "Sıcak Lead" || l.klass === "VIP Lead").length;
  const meetings = leads.filter(l => l.selectedSlot).length;
  const orders = leads.filter(l => ["Sipariş Oluşturuldu","Kalite Kontrol","Sevkiyat Planlandı","Teslimat Tamamlandı"].includes(l.status)).length;
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
  const stages = [...STATUS_STAGES, STATUS_LOST];
  const pairs = stages.map(s => [s, leads.filter(l => l.status === s).length]).filter(p => p[1] > 0);
  distBars("distStatus", pairs);
}
function renderClassDist(leads) {
  const order = ["VIP Lead", "Sıcak Lead", "Takip Edilecek Lead", "Düşük Lead"];
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
    table.innerHTML = `<tr><td class="empty">Henüz lead yok.</td></tr>`;
    return;
  }
  const head = `<tr>
    <th>Tarih</th><th>Firma</th><th>Yetkili</th><th>Grup</th><th>Ürünler</th>
    <th>Tonaj</th><th>Sınıf</th><th>Süreç</th><th>Telefon</th></tr>`;
  const rows = leads.map((l, idx) => `<tr class="clickable" data-idx="${idx}">
    <td>${l.createdAt ? new Date(l.createdAt).toLocaleDateString("tr-TR") : "-"}</td>
    <td>${escapeHtml(l.company)}</td>
    <td>${escapeHtml(l.contact)}</td>
    <td>${escapeHtml(l.group)}</td>
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

/* --- Müşteri Kartı (CRM) modalı --- */
const overlay = document.getElementById("overlay");
document.getElementById("cardClose").addEventListener("click", closeCard);
overlay.addEventListener("click", e => { if (e.target === overlay) closeCard(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeCard(); });
function closeCard() { overlay.hidden = true; }

function openCard(lead) {
  document.getElementById("cardTitle").textContent = lead.company || lead.contact || "Müşteri Kartı";
  document.getElementById("cardRef").textContent =
    (lead.refNo ? "Teklif No: " + lead.refNo + "  •  " : "") +
    (lead.createdAt ? new Date(lead.createdAt).toLocaleString("tr-TR") : "");

  const kv = (s, v) => `<div><span>${s}</span><b>${escapeHtml(v || "-")}</b></div>`;
  const currentIdx = STATUS_STAGES.indexOf(lead.status);

  const pipeline = STATUS_STAGES.map((s, i) => {
    const cls = i < currentIdx ? "done" : (i === currentIdx ? "current" : "");
    const mark = i < currentIdx ? "✓" : (i === currentIdx ? "●" : (i + 1));
    return `<li class="${cls}"><span class="dot">${mark}</span>${escapeHtml(s)}</li>`;
  }).join("");

  const options = [...STATUS_STAGES, STATUS_LOST]
    .map(s => `<option value="${escapeHtml(s)}"${s === lead.status ? " selected" : ""}>${escapeHtml(s)}</option>`).join("");

  document.getElementById("cardBody").innerHTML = `
    <div class="kv">
      ${kv("Ürün grubu", lead.group)}
      ${kv("Seçilen ürünler", (lead.products || []).join(", "))}
      ${kv("Tahmini tonaj", lead.tonnage)}
      ${kv("Bütçe", lead.budget)}
      ${kv("İthalat zamanı", lead.timing)}
      ${kv("Tecrübe", lead.experience)}
      ${kv("Lead sınıfı", lead.klass)}
      ${kv("Lead puanı", lead.score == null ? "-" : String(lead.score))}
      ${kv("Yetkili", lead.contact)}
      ${kv("Telefon", lead.phone)}
      ${kv("E-posta", lead.email)}
      ${kv("Ülke / şehir", lead.location)}
      ${kv("Teslim limanı", lead.port)}
      ${kv("Seçilen görüşme", lead.selectedSlot)}
    </div>

    <span class="field-label">Süreç aşamaları</span>
    <ul class="pipeline">${pipeline}</ul>

    <span class="field-label" for="stSelect">Durumu güncelle</span>
    <select id="stSelect" class="text-input">${options}</select>

    <span class="field-label">Takip notları</span>
    <textarea id="stNotes" class="text-input" placeholder="Görüşme notu, teklif detayı, hatırlatma...">${escapeHtml(lead.notes || "")}</textarea>

    <div class="card-actions">
      <button class="btn btn--cta" id="stSave" style="flex:1">💾 Kaydet</button>
      <a class="btn btn--wa" id="stWa" target="_blank" rel="noopener">📲 WhatsApp</a>
    </div>
    <p id="stMsg" style="margin:10px 0 0"></p>
  `;

  // WhatsApp hızlı erişim (müşterinin telefonuna)
  const waNum = (lead.phone || "").replace(/[^0-9]/g, "").replace(/^0/, "90");
  const waBtn = document.getElementById("stWa");
  if (waNum.length >= 10) waBtn.href = "https://wa.me/" + waNum;
  else { waBtn.style.display = "none"; }

  document.getElementById("stSave").addEventListener("click", () => saveCard(lead));
  overlay.hidden = false;
}

async function saveCard(lead) {
  const status = document.getElementById("stSelect").value;
  const notes = document.getElementById("stNotes").value;
  const msg = document.getElementById("stMsg");
  lead.status = status; lead.notes = notes;

  if (sb && lead.id != null) {
    msg.textContent = "Kaydediliyor…"; msg.className = "muted";
    const { error } = await sbAdminUpdate(lead.id, { status, notes });
    if (error) { msg.textContent = "Hata: " + error; msg.className = "form-err"; return; }
    msg.textContent = "✓ Kaydedildi"; msg.className = "save-ok";
  } else {
    // yerel yedek (localStorage)
    try {
      const arr = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      const i = arr.findIndex(x => x.refNo === lead.refNo);
      if (i >= 0) { arr[i].status = status; arr[i].notes = notes; localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
    } catch (e) {}
    msg.textContent = "✓ Kaydedildi (yerel)"; msg.className = "save-ok";
  }
  renderAll(); // tablo & dağılımları tazele
}

/* --- Dışa aktarma --- */
function exportJSON() { download("leadler.json", JSON.stringify(CACHE, null, 2), "application/json"); }
function exportCSV() {
  const cols = ["createdAt","refNo","company","contact","phone","email","location","port",
                "group","products","tonnage","budget","timing","experience","klass","score","selectedSlot","status","notes"];
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
  return { "VIP Lead":"vip","Sıcak Lead":"hot","Takip Edilecek Lead":"follow","Düşük Lead":"low" }[klass] || "low";
}
