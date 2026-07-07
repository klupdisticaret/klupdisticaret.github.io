/* =============================================================
   SUPABASE BAĞLANTISI
   Site formu lead'i buraya yazar (insert). Admin paneli okur.
   Supabase hazır değilse site yine çalışır (localStorage'a düşer).
   ============================================================= */

let sb = null;      // oturum-farkında istemci (admin girişi + okuma)
let sbAnon = null;  // her zaman ZİYARETÇİ (anon) — form kaydı bunu kullanır
try {
  if (window.supabase && CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY
      && !CONFIG.SUPABASE_URL.includes("xxxxx")) {
    sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    // Ayrı istemci: admin girişli olsa bile form kaydı hep anon kimliğiyle gitsin
    // (RLS anon insert politikası her durumda çalışsın; kayıtlar reddedilmesin).
    sbAnon = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: "sb-anon-form" },
    });
  }
} catch (e) {
  console.warn("Supabase başlatılamadı:", e);
}

// Teklif nesnesini veritabanı satırına çevirir.
function leadToRow(p) {
  return {
    ref_no: p.refNo,
    group_type: p.group,
    products: p.products || [],
    tonnage: p.tonnage,
    budget: p.budget,
    timing: p.timing,
    experience: p.experience,
    company: p.company,
    contact: p.contact,
    phone: p.phone,
    whatsapp: p.whatsapp,
    email: p.email,
    location: p.location,
    port: p.port,
    score: p.score,
    klass: p.klass,
    lead_group: p.leadGroup || null,
    wa_shown: !!p.showWhatsapp,
    meeting_shown: !!p.showMeeting,
    selected_slot: p.selectedSlot || null,
  };
}

// Yeni lead ekler (fire-and-forget). Hata olursa site akışını bozmaz.
// Yeni kolonlar (lead_group vb.) henüz eklenmemişse temel alanlarla tekrar dener.
async function sbInsertLead(p) {
  const client = sbAnon || sb;
  if (!client) return;
  const row = leadToRow(p);
  try {
    let { error } = await client.from("leads").insert(row);
    if (error && /column|schema cache|PGRST204/i.test(error.message + (error.code || ""))) {
      // Yeni kolonları çıkarıp yeniden dene (kurulum güncellenmeden de çalışsın)
      const { lead_group, wa_shown, meeting_shown, ...base } = row;
      ({ error } = await client.from("leads").insert(base));
    }
    if (error) console.warn("Supabase insert hata:", error.message);
  } catch (e) { console.warn("Supabase insert exception:", e); }
}

// Seçilen toplantı saatini günceller + durumu "Toplantı Planlandı" yapar.
async function sbUpdateSlot(p) {
  const client = sbAnon || sb;
  if (!client) return;
  try {
    const { error } = await client.from("leads")
      .update({ selected_slot: p.selectedSlot, status: "Toplantı planlandı" })
      .eq("ref_no", p.refNo);
    if (error) console.warn("Supabase update hata:", error.message);
  } catch (e) { console.warn("Supabase update exception:", e); }
}

// ADMIN: lead durum/not günceller (giriş yapılmış olmalı). id ile.
async function sbAdminUpdate(id, fields) {
  if (!sb) return { error: "Supabase yok" };
  try {
    const { error } = await sb.from("leads").update(fields).eq("id", id);
    return { error: error ? error.message : null };
  } catch (e) { return { error: String(e) }; }
}
