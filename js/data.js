// Company constants are defined in config.js (AH.COMPANY).
// Property/project/area data is now stored in Supabase and fetched at runtime.
// This file keeps only small shared helpers.

window.AH = window.AH || {};

window.AH.WA = (window.AH.COMPANY && window.AH.COMPANY.whatsapp) || "https://wa.me/201557222799";
window.AH.PHONE = (window.AH.COMPANY && window.AH.COMPANY.phone) || "01557222799";
window.AH.PHONE_INTL = (window.AH.COMPANY && window.AH.COMPANY.phoneIntl) || "+201557222799";

// Status labels helper used by multiple pages
window.AH.statusLabel = function (s, lang) {
  lang = lang || (window.AH.getLang ? window.AH.getLang() : 'ar');
  const dict = {
    ar: { draft: "مسودة", available: "متاح", reserved: "محجوز", sold: "مباع", new: "جديد", contacted: "تم التواصل", closed: "مغلق" },
    en: { draft: "Draft", available: "Available", reserved: "Reserved", sold: "Sold", new: "New", contacted: "Contacted", closed: "Closed" }
  };
  return (dict[lang] && dict[lang][s]) || s;
};