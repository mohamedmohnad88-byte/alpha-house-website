// Supabase client wrapper. Loaded after config.js and the Supabase CDN script.
(function () {
  const cfg = window.AH_CONFIG || {};
  let client = null;
  try {
    if (window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
        !cfg.SUPABASE_URL.includes("YOUR-PROJECT")) {
      client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    }
  } catch (e) {
    console.warn("Supabase init failed:", e);
  }
  window.AH = window.AH || {};
  window.AH.sb = client;
  window.AH.isConfigured = !!client;
})();