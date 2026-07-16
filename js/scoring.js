/* =============================================================
   LEAD GRUPLAMA (A/B/C/D), PUANLAMA ve GÖRÜNÜRLÜK KURALLARI
   Tonaj bazlı grup + puan. WhatsApp/toplantı görünürlüğü tonaja
   ve ek kurallara göre belirlenir. (Aa.txt madde 4,5,7,21)
   ============================================================= */

// Tonaj -> temel grup
const TONNAGE_GROUP = {
  "1–5 ton":      { letter: "A", klass: "Düşük Öncelikli Lead", tonLabel: "1–5 Ton" },
  "10–15 ton":    { letter: "B", klass: "Takip Edilecek Lead",  tonLabel: "10–15 Ton" },
  "20–25 ton":    { letter: "C", klass: "Sıcak Lead",           tonLabel: "20–25 Ton" },
  "25 ton üzeri": { letter: "D", klass: "VIP Lead",             tonLabel: "25 Ton Üstü" },
};

// Grup bazlı ekran mesajları
const GROUP_MESSAGES = {
  A: "Talebiniz alınmıştır. Ekibimiz başvurunuzu değerlendirdikten sonra uygun görülmesi halinde sizinle iletişime geçecektir.",
  B: "Talebiniz alınmıştır. Ürün, miktar ve bütçe bilgileriniz ekibimiz tarafından incelenecektir. Ön teklif bilgilerinizi WhatsApp üzerinden bize gönderebilirsiniz. Uygun görülmesi halinde ekibimiz sizinle iletişime geçecektir.",
  C: "Talebiniz uygun görünüyor. Ön teklif bilgilerinizi WhatsApp ile gönderebilir ve uygun görüşme saatlerinden birini seçebilirsiniz.",
  D: "Talebiniz öncelikli değerlendirme grubuna alınmıştır. Ön teklifinizi gönderebilir ve uygun görüşme saatlerinden birini seçebilirsiniz.",
};

// Puanlama tabloları (madde 7)
const SCORE_MAP = {
  tonnage: { "1–5 ton": 10, "10–15 ton": 35, "20–25 ton": 65, "25 ton üzeri": 90 },
  timing: {
    "Hemen": 30, "1 ay içinde": 25, "1–3 ay içinde": 15, "3–6 ay içinde": 10, "Sadece araştırıyorum": 0,
  },
  experience: {
    "Evet, düzenli ithalat yapıyoruz": 20, "Evet, birkaç kez yaptık": 10,
    "Hayır, ilk kez yapacağız": 5, "Sadece araştırıyoruz": 0,
  },
};

const has = (v) => !!(v && String(v).trim().length);
function hasFirma(s)   { return has(s.company); }
function hasContact(s) { return has(s.phone) || has(s.whatsapp); } // WhatsApp butonu için

// Toplam puan
function scoreLead(state) {
  let s = 0;
  s += SCORE_MAP.tonnage[state.tonnage]      || 0;
  s += SCORE_MAP.timing[state.timing]         || 0;
  s += SCORE_MAP.experience[state.experience] || 0;
  if (hasFirma(state))    s += 15; // firma bilgisi doluysa
  if (has(state.phone))   s += 15; // telefon doluysa (iletişim bilgisi)
  return s;
}

// Görünürlük matrisi: [tonaj][bütçe] -> seviye (0: sadece kayıt | 1: WhatsApp | 2: WhatsApp + toplantı)
const VISIBILITY = {
  "1–5 ton":      { "10.000 USD altı": 0, "10.000 – 25.000 USD": 0, "25.000 – 50.000 USD": 0, "50.000 USD üzeri": 0 },
  "10–15 ton":    { "10.000 USD altı": 0, "10.000 – 25.000 USD": 1, "25.000 – 50.000 USD": 1, "50.000 USD üzeri": 1 },
  "20–25 ton":    { "10.000 USD altı": 0, "10.000 – 25.000 USD": 1, "25.000 – 50.000 USD": 1, "50.000 USD üzeri": 2 },
  "25 ton üzeri": { "10.000 USD altı": 0, "10.000 – 25.000 USD": 1, "25.000 – 50.000 USD": 2, "50.000 USD üzeri": 2 },
};

/* Lead'i sınıflandırır + görünürlük kurallarını döndürür.
   Görünürlük, tonaj x bütçe matrisine (VISIBILITY) göre hücre-hücre belirlenir;
   "ne zaman" ve "daha önce" sorularının TÜM seçenekleri geçerlidir (engellemez).
   Seviye 0 -> sadece kayıt | 1 -> WhatsApp | 2 -> WhatsApp + toplantı
   { klass, group, label, score, level, showWhatsapp, showMeeting, message } */
function classifyLead(state) {
  const g = TONNAGE_GROUP[state.tonnage] || TONNAGE_GROUP["1–5 ton"];
  const score = scoreLead(state);

  const row = VISIBILITY[state.tonnage] || {};
  const level = row[state.budget] ?? 0;

  let showWhatsapp = level >= 1;
  let showMeeting  = level >= 2;

  // İletişim bilgisi yoksa WhatsApp gönderilemez (form zorunlu tuttuğu için normalde dolu)
  if (!hasContact(state)) showWhatsapp = false;
  if (!showWhatsapp)      showMeeting  = false;

  const msgKey = level >= 2 ? "C" : (level === 1 ? "B" : "A");

  return {
    klass: g.klass,
    group: g.letter,
    label: g.klass + " / " + g.tonLabel,
    score,
    level,
    showWhatsapp,
    showMeeting,
    message: GROUP_MESSAGES[msgKey],
  };
}
