/* =============================================================
   META (FACEBOOK) PİKSELİ — REKLAM DÖNÜŞÜM TAKİBİ
   Amaç: Meta'nın "kim tıkladı" değil, "kim gerçekten talep bıraktı"
   bilgisini görmesi. Böylece reklam, link tıklamasına değil
   POTANSİYEL MÜŞTERİYE göre optimize eder.

   Gönderilen olaylar:
     PageView         — sayfayı açan herkes (otomatik)
     InitiateCheckout — "Hemen Teklif Al"a basıp funnel'ı başlatan
     Lead             — formu bitirip talebi oluşturan   ← ASIL DÖNÜŞÜM
     Contact          — WhatsApp butonuna basan

   KİŞİSEL VERİ GÖNDERİLMEZ: isim, telefon, e-posta Meta'ya gitmez.
   Yalnızca olay adı + ürün grubu / tonaj / lead sınıfı gibi anonim
   sınıflandırma bilgisi gider.

   Piksel ID boşsa dosya hiçbir şey yapmaz; site normal çalışır.
   ============================================================= */

/* Base kod: Meta'nın standart snippet'i. fbq() çağrılarını kuyruğa alır,
   sonra fbevents.js async yüklenince gerçek gönderim yapılır. */
(function () {
  const ID = (typeof CONFIG !== "undefined" && CONFIG.META_PIXEL_ID) || "";
  if (!ID || /^BURAYA/i.test(ID)) return; // ID girilmemiş -> takip kapalı

  /* eslint-disable */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
  (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */

  fbq("init", ID);
  fbq("track", "PageView");
})();

/* Tek giriş noktası. Piksel yoksa/yüklenmediyse sessizce geçer,
   hata site akışını asla bozmaz. (track.js'teki mantığın aynısı.) */
function pixelEvent(ad, params) {
  try {
    if (typeof fbq !== "function") return;
    fbq("track", ad, params || {});
  } catch (e) { /* takip asla siteyi bozmaz */ }
}
