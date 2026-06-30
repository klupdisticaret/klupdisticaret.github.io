/* =============================================================
   LEAD PUANLAMA ve GRUP / FİYAT MANTIĞI
   Belgedeki kurallar: 25 ton+, 50.000$+, "Hemen", daha önce ithalat
   yapmış firma -> yüksek puan. Diğer kademeler azalan puan.
   ============================================================= */

// Her seçeneğe verilen puanlar (toplam ~100 üzerinden tasarlandı).
const SCORE_MAP = {
  tonnage: {
    "1 ton altı":      2,
    "1–5 ton":         8,
    "5–10 ton":        15,
    "10–20 ton":       25,
    "25 ton ve üzeri": 35,
  },
  budget: {
    "10.000 $ altı":     3,
    "10.000–25.000 $":   12,
    "25.000–50.000 $":   20,
    "50.000 $ üzeri":    30,
    "Henüz bilmiyorum":  4,
  },
  timing: {
    "Hemen":               20,
    "1 ay içinde":         15,
    "1–3 ay içinde":       9,
    "3–6 ay içinde":       4,
    "Sadece araştırıyorum":1,
  },
  experience: {
    "Evet, düzenli ithalat yapıyoruz": 15,
    "Evet, birkaç kez yaptık":          10,
    "Hayır, ilk kez yapacağız":         5,
    "Sadece araştırıyoruz":             2,
  },
};

/* state: { tonnage, budget, timing, experience, ... }
   Dönüş: { score, klass } */
function scoreLead(state) {
  let score = 0;
  score += SCORE_MAP.tonnage[state.tonnage]      || 0;
  score += SCORE_MAP.budget[state.budget]         || 0;
  score += SCORE_MAP.timing[state.timing]         || 0;
  score += SCORE_MAP.experience[state.experience] || 0;

  const t = CONFIG.SCORE_THRESHOLDS;
  let klass;
  if (score >= t.vip)         klass = "VIP Lead";
  else if (score >= t.hot)    klass = "Sıcak Lead";
  else if (score >= t.follow) klass = "Takip Edilecek Lead";
  else                        klass = "Düşük Lead";

  return { score, klass };
}

// Bu lead sınıfına toplantı ekranı açılmalı mı?
function isMeetingEligible(klass) {
  return CONFIG.MEETING_FOR_CLASSES.includes(klass);
}

// Seçilen tonaj kademesine göre ön fiyat aralığı metni üretir.
function priceRangeText(tonnage) {
  const tier = CONFIG.PRICE_TIERS[tonnage];
  if (!tier) return { range: "Görüşmede netleştirilecek", note: "" };

  const { min, max, note } = tier;
  if (min === "" || max === "") {
    return { range: "Bu miktar için fiyat görüşmede netleşir", note: note || "" };
  }
  const cur = CONFIG.PRICE_CURRENCY;
  const unit = CONFIG.PRICE_UNIT;
  return {
    range: `${Number(min).toLocaleString("tr-TR")} – ${Number(max).toLocaleString("tr-TR")} ${cur} / ${unit} (ön değerlendirme)`,
    note: note || "",
  };
}
