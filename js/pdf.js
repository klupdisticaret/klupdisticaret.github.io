/* =============================================================
   PDF TEKLİF OLUŞTURMA  (jsPDF — CDN'den yüklenir)
   Not: jsPDF'in standart fontu bazı Türkçe karakterleri (ş, ğ, ı, İ)
   düzgün göstermez. Bu yüzden PDF metninde bu karakterler en yakın
   Latin karşılığına çevrilir (ekrandaki yazılar tam Türkçedir).
   ============================================================= */

// Türkçe -> PDF için güvenli karşılık
function pdfSafe(str) {
  return (str || "")
    .replace(/ş/g, "s").replace(/Ş/g, "S")
    .replace(/ğ/g, "g").replace(/Ğ/g, "G")
    .replace(/ı/g, "i").replace(/İ/g, "I");
  // ç, ö, ü Latin-1'de mevcut olduğundan korunur.
}

function downloadProposalPDF(p) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("PDF kütüphanesi yüklenemedi. İnternet bağlantınızı kontrol edin.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const M = 48;             // kenar boşluğu
  let y = M;
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - M * 2;
  const ORANGE = [242, 106, 27];
  const DARK = [33, 37, 41];
  const GRAY = [110, 115, 120];

  const line = (txt, opts = {}) => {
    const size = opts.size || 11;
    const color = opts.color || DARK;
    const gap = opts.gap == null ? 16 : opts.gap;
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    const wrapped = doc.splitTextToSize(pdfSafe(txt), contentW);
    wrapped.forEach(w => {
      if (y > 780) { doc.addPage(); y = M; }
      doc.text(w, M, y);
      y += gap;
    });
  };

  // Üst başlık bandı
  doc.setFillColor(ORANGE[0], ORANGE[1], ORANGE[2]);
  doc.rect(0, 0, pageW, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(pdfSafe(CONFIG.BRAND.name), M, 34);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(pdfSafe("Dondurulmus Meyve & Sebze Ithalati — On Teklif"), M, 54);
  y = 100;

  line(`Teklif No: ${p.refNo}`, { color: GRAY, gap: 14 });
  line(`Tarih: ${new Date(p.createdAt).toLocaleString("tr-TR")}`, { color: GRAY, gap: 22 });

  line("TEKLIF OZETI", { bold: true, size: 13, color: ORANGE, gap: 20 });
  line(`Urun grubu: ${p.group}`);
  line(`Secilen urunler: ${p.products.length ? p.products.join(", ") : "-"}`);
  line(`Tahmini tonaj: ${p.tonnage}`);
  line(`Butce araligi: ${p.budget}`);
  line(`Ithalat zamani: ${p.timing}`);
  line(`On fiyat: ${p.priceRange}`, { bold: true });
  if (p.priceNote) line(`Not: ${p.priceNote}`, { color: GRAY });
  y += 6;

  line("NOTLAR", { bold: true, size: 13, color: ORANGE, gap: 20 });
  line(`Teslimat: ${p.notes.delivery}`);
  line(`Kalite kontrol: ${p.notes.quality}`);
  line(`Soguk zincir: ${p.notes.coldChain}`);
  line(`Sonraki adim: ${p.notes.nextStep}`);
  y += 6;

  line("FIRMA BILGILERI", { bold: true, size: 13, color: ORANGE, gap: 20 });
  line(`Firma: ${p.company || "-"}`);
  line(`Yetkili: ${p.contact || "-"}`);
  line(`Telefon: ${p.phone || "-"}    E-posta: ${p.email || "-"}`);
  line(`Lokasyon: ${p.location || "-"}    Teslim limani: ${p.port || "-"}`);
  if (p.selectedSlot) line(`Secilen gorusme: ${p.selectedSlot}`, { bold: true });
  y += 10;

  // Uyarı kutusu
  if (y > 700) { doc.addPage(); y = M; }
  doc.setDrawColor(ORANGE[0], ORANGE[1], ORANGE[2]);
  doc.setFillColor(255, 244, 235);
  const boxY = y;
  doc.roundedRect(M, boxY, contentW, 56, 6, 6, "FD");
  y = boxY + 20;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.splitTextToSize(pdfSafe(p.disclaimer), contentW - 24).forEach(w => {
    doc.text(w, M + 12, y); y += 13;
  });

  // Alt iletişim
  y = 812;
  doc.setFontSize(9);
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.text(pdfSafe(`WhatsApp: +${CONFIG.WHATSAPP}   |   E-posta: ${CONFIG.EMAIL}`), M, y);

  doc.save(`${p.refNo}.pdf`);
}
