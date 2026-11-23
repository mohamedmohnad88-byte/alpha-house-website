// Firebase client wrapper.
(function () {
  const cfg = window.AH_FIREBASE_CONFIG || {};
  let app = null, auth = null, db = null, storage = null;
  try {
    if (window.firebase && cfg.apiKey && !String(cfg.apiKey).includes("YOUR_API_KEY")) {
      app = firebase.initializeApp(cfg);
      auth = firebase.auth();
      db = firebase.firestore();
      storage = firebase.storage();
    }
  } catch (e) {
    console.warn("Firebase init failed:", e);
  }
  window.AH = window.AH || {};
  window.AH.firebase = { app, auth, db, storage };
  window.AH.fb = db;
  window.AH.isConfigured = !!db;
  // convenience
  window.AH.WA = (window.AH.COMPANY && window.AH.COMPANY.whatsapp) || "https://wa.me/201557222799";
  window.AH.PHONE = (window.AH.COMPANY && window.AH.COMPANY.phone) || "01557222799";
  window.AH.PHONE_INTL = (window.AH.COMPANY && window.AH.COMPANY.phoneIntl) || "+201557222799";
})();