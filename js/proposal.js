/* =============================================================
   ÖN TEKLİF OLUŞTURMA + WhatsApp / Takvim linkleri
   + lead'in localStorage'a ve Supabase'e kaydedilmesi.
   (Fiyat / PDF / e-posta kaldırıldı — Aa.txt madde 3,6)
   ============================================================= */

/* state -> teklif/lead nesnesi */
function buildProposal(state) {
  const c = classifyLead(state);

  return {
    createdAt: new Date().toISOString(),
    refNo: "TKF-" + Date.now().toString().slice(-8),
    group: state.group,                      // meyve / sebze / her ikisi
    products: state.products || [],          // seçilen ürün dizisi
    tonnage: state.tonnage,
    budget: state.budget,
    timing: state.timing,
    experience: state.experience,
    company: state.company,
    contact: state.contact,
    phone: state.phone,
    whatsapp: state.whatsapp,
    location: state.location,                // şehir
    port: state.port,
    score: c.score,
    klass: c.klass,                          // Düşük Öncelikli / Takip / Sıcak / VIP
    leadGroup: c.group,                      // A / B / C / D
    label: c.label,                          // "VIP Lead / 25 Ton Üstü"
    showWhatsapp: c.showWhatsapp,
    showMeeting: c.showMeeting,
    message: c.message,                      // gruba göre ekran mesajı
    notes: {
      delivery: "Teslimat, anlaşılan limana/lokasyona soğuk zincir korunarak planlanır.",
      quality:  "Tüm ürünler uluslararası kalite standartlarında, kalite kontrolden geçirilir.",
      coldChain:"-18°C depolama ve kesintisiz soğuk zincir lojistiği uygulanır.",
    },
  };
}

/* Teklifi okunabilir düz metne çevirir (WhatsApp için). */
function proposalToText(p) {
  const L = [];
  L.push(`*${CONFIG.BRAND.name} — Dondurulmuş Meyve & Sebze İthalatı*`);
  L.push(`Talep No: ${p.refNo}`);
  L.push("");
  L.push(`Ürün grubu: ${p.group}`);
  L.push(`Seçilen ürünler: ${p.products.length ? p.products.join(", ") : "-"}`);
  L.push(`Tahmini tonaj: ${p.tonnage}`);
  L.push(`Bütçe: ${p.budget}`);
  L.push(`İthalat zamanı: ${p.timing}`);
  L.push("");
  L.push("— Firma bilgileri —");
  L.push(`Firma: ${p.company || "-"}`);
  L.push(`Yetkili: ${p.contact || "-"}`);
  L.push(`Telefon: ${p.phone || "-"}`);
  if (p.whatsapp) L.push(`WhatsApp: ${p.whatsapp}`);
  L.push(`Şehir: ${p.location || "-"}`);
  L.push(`Teslim limanı: ${p.port || "-"}`);
  if (p.selectedSlot) { L.push(""); L.push(`Seçilen görüşme: ${p.selectedSlot}`); }
  return L.join("\n");
}

/* WhatsApp linki (müşteri -> firma). Önceden doldurulmuş özet açılır. */
function whatsappLink(p) {
  const msg = proposalToText(p);
  return `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(msg)}`;
}

/* "Google Takvime Ekle" linki — seçilen slota göre etkinlik oluşturur. */
function calendarLink(p, slot) {
  // slot: { label, day, time } -> en yakın o gün/saati bul
  const start = nextDateForSlot(slot);
  const end = new Date(start.getTime() + CONFIG.MEETING_DURATION_MIN * 60000);
  const fmt = d => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const text = encodeURIComponent(`Görüşme — ${CONFIG.BRAND.name} (İthalat ön teklif)`);
  const details = encodeURIComponent(
    `Dondurulmuş meyve/sebze ithalat ön teklif görüşmesi.\nTeklif No: ${p.refNo}\nFirma: ${p.company || "-"}`
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}` +
         `&dates=${fmt(start)}/${fmt(end)}&details=${details}`;
}

/* Verilen slot için bugünden sonraki en yakın tarihi hesaplar. */
function nextDateForSlot(slot) {
  const [hh, mm] = slot.time.split(":").map(Number);
  const now = new Date();
  const d = new Date(now);
  let add = (slot.day - now.getDay() + 7) % 7;
  // Bugünse ve saat geçtiyse haftaya at
  if (add === 0) {
    if (now.getHours() > hh || (now.getHours() === hh && now.getMinutes() >= mm)) add = 7;
  }
  d.setDate(now.getDate() + add);
  d.setHours(hh, mm, 0, 0);
  return d;
}

/* Lead'i localStorage'a kaydeder (admin paneli okur). */
const STORAGE_KEY = "klup_leads";
function saveLead(p) {
  let leads = [];
  try { leads = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) {}
  leads.push(p);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(leads)); } catch (e) {}
  // Merkezi veritabanına da yaz (varsa)
  if (typeof sbInsertLead === "function") sbInsertLead(p);
}

/* Kayıtlı lead'i refNo'ya göre günceller (ör. toplantı saati seçilince). */
function updateLead(p) {
  let leads = [];
  try { leads = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) {}
  const i = leads.findIndex(l => l.refNo === p.refNo);
  if (i >= 0) { leads[i] = p; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(leads)); } catch (e) {} }
  if (typeof sbUpdateSlot === "function") return sbUpdateSlot(p);
  return Promise.resolve({ conflict: false });
}
