/* =============================================================
   YÖNETİM PANELİ
   localStorage'daki lead'leri okur, istatistik gösterir,
   CSV/JSON dışa aktarır. Şifre kapısı GERÇEK güvenlik değildir.
   ============================================================= */

const STORAGE_KEY = "klup_leads";

// --- şifre kapısı ---
const gate = document.getElementById("gate");
const admin = document.getElementById("admin");

function tryLogin() {
  const pw = document.getElementById("pw").value;
  if (pw === CONFIG.ADMIN_PASSWORD) {
    sessionStorage.setItem("klup_admin_ok", "1");
    gate.hidden = true;
    admin.hidden = false;
    renderAll();
  } else {
    document.getElementById("pwErr").hidden = false;
  }
}
document.getElementById("loginBtn").addEventListener("click", tryLogin);
document.getElementById("pw").addEventListener("keydown", e => { if (e.key === "Enter") tryLogin(); });
if (sessionStorage.getItem("klup_admin_ok") === "1") {
  gate.hidden = true; admin.hidden = false;
}

// --- veri ---
function getLeads() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch (e) { return []; }
}

function renderAll() {
  const leads = getLeads();
  renderStats(leads);
  renderClassDist(leads);
  renderProductDist(leads);
  renderFieldDist("distTonnage", leads, "tonnage", "Tonaj");
  renderFieldDist("distBudget", leads, "budget", "Bütçe");
  renderTable(leads);
}

function renderStats(leads) {
  const total = leads.length;
  const hotVip = leads.filter(l => l.klass === "Sıcak Lead" || l.klass === "VIP Lead").length;
  const meetings = leads.filter(l => l.selectedSlot).length;
  const conv = total ? Math.round((hotVip / total) * 100) : 0;
  const stats = [
    ["Toplam Lead", total],
    ["Sıcak + VIP", hotVip],
    ["Toplantı seçen", meetings],
    ["Dönüşüm oranı", conv + "%"],
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

function renderClassDist(leads) {
  const order = ["VIP Lead", "Sıcak Lead", "Takip Edilecek Lead", "Düşük Lead"];
  const counts = order.map(k => [k, leads.filter(l => l.klass === k).length]);
  distBars("distClass", counts);
}

function renderProductDist(leads) {
  const map = {};
  leads.forEach(l => (l.products || []).forEach(p => { map[p] = (map[p] || 0) + 1; }));
  const pairs = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 15);
  distBars("distProduct", pairs);
}

function renderFieldDist(containerId, leads, field) {
  const map = {};
  leads.forEach(l => { const v = l[field] || "—"; map[v] = (map[v] || 0) + 1; });
  const pairs = Object.entries(map).sort((a, b) => b[1] - a[1]);
  distBars(containerId, pairs);
}

function renderTable(leads) {
  const table = document.getElementById("leadTable");
  if (!leads.length) {
    table.innerHTML = `<tr><td class="empty">Henüz lead yok. Ana sayfada bir form doldurun.</td></tr>`;
    return;
  }
  const head = `<tr>
    <th>Tarih</th><th>Firma</th><th>Yetkili</th><th>Grup</th><th>Ürünler</th>
    <th>Tonaj</th><th>Bütçe</th><th>Zaman</th><th>Sınıf</th><th>Puan</th>
    <th>Telefon</th><th>E-posta</th><th>Toplantı</th></tr>`;
  const rows = leads.slice().reverse().map(l => `<tr>
    <td>${new Date(l.createdAt).toLocaleDateString("tr-TR")}</td>
    <td>${escapeHtml(l.company)}</td>
    <td>${escapeHtml(l.contact)}</td>
    <td>${escapeHtml(l.group)}</td>
    <td>${escapeHtml((l.products || []).join(", "))}</td>
    <td>${escapeHtml(l.tonnage)}</td>
    <td>${escapeHtml(l.budget)}</td>
    <td>${escapeHtml(l.timing)}</td>
    <td><span class="lead-badge lead-${cssClass(l.klass)}">${escapeHtml(l.klass)}</span></td>
    <td>${l.score}</td>
    <td>${escapeHtml(l.phone)}</td>
    <td>${escapeHtml(l.email)}</td>
    <td>${escapeHtml(l.selectedSlot || "-")}</td>
  </tr>`).join("");
  table.innerHTML = head + rows;
}

// --- dışa aktarma ---
function exportJSON() {
  download("leadler.json", JSON.stringify(getLeads(), null, 2), "application/json");
}
function exportCSV() {
  const leads = getLeads();
  const cols = ["createdAt","refNo","company","contact","phone","whatsapp","email","location","port",
                "group","products","tonnage","budget","timing","experience","klass","score","selectedSlot"];
  const head = cols.join(",");
  const rows = leads.map(l => cols.map(c => {
    let v = l[c];
    if (Array.isArray(v)) v = v.join(" | ");
    return `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  }).join(","));
  download("leadler.csv", "﻿" + [head, ...rows].join("\r\n"), "text/csv");
}
function download(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

document.getElementById("exportCsv").addEventListener("click", exportCSV);
document.getElementById("exportJson").addEventListener("click", exportJSON);
document.getElementById("refresh").addEventListener("click", renderAll);
document.getElementById("clear").addEventListener("click", () => {
  if (confirm("Tüm lead verileri bu tarayıcıdan silinecek. Emin misiniz? (Önce dışa aktarmanız önerilir.)")) {
    localStorage.removeItem(STORAGE_KEY);
    renderAll();
  }
});

// --- yardımcılar ---
function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function cssClass(klass) {
  return { "VIP Lead":"vip","Sıcak Lead":"hot","Takip Edilecek Lead":"follow","Düşük Lead":"low" }[klass] || "low";
}

// İlk açılışta panel görünürse doldur
if (!admin.hidden) renderAll();
