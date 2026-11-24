/* ============================================================
   THE VOID — Core: Firebase, data layer, utils, settings
   ============================================================ */
(function () {
  'use strict';

  window.VOID = window.VOID || {};
  const V = window.VOID;

  // ---------- Settings (reduced motion, sound) ----------
  const settings = {
    reduceMotion: localStorage.getItem('v_reduce_motion') === '1',
    sound: localStorage.getItem('v_sound') !== '0',
  };
  function applySettings() {
    document.body.classList.toggle('v-reduce-motion', settings.reduceMotion);
    localStorage.setItem('v_reduce_motion', settings.reduceMotion ? '1' : '0');
    localStorage.setItem('v_sound', settings.sound ? '1' : '0');
  }
  V.settings = settings;
  V.applySettings = applySettings;
  applySettings();

  // ---------- Toast ----------
  V.toast = function (msg) {
    let t = document.querySelector('.v-toast');
    if (!t) { t = document.createElement('div'); t.className = 'v-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), 2800);
  };

  // ---------- Firebase handles ----------
  V.fb = function () { return (window.AH && window.AH.firebase) || {}; };
  V.db = function () { return (window.AH && window.AH.fb) || null; };
  V.auth = function () { return (window.AH && window.AH.firebase && window.AH.firebase.auth) || null; };
  V.isConfigured = function () { return !!(window.AH && window.AH.isConfigured); };

  // ---------- Utils ----------
  V.$ = (sel, root) => (root || document).querySelector(sel);
  V.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  V.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); };
  V.slug = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
  V.now = function () { return new Date().toISOString(); };
  V.formatDate = function (iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }); } catch(e){ return iso; }
  };

  // ---------- Favorites (localStorage) ----------
  V.favs = {
    get() { try { return JSON.parse(localStorage.getItem('v_favs') || '[]'); } catch(e){ return []; } },
    set(a) { localStorage.setItem('v_favs', JSON.stringify(a)); },
    has(id) { return this.get().includes(id); },
    toggle(id) {
      const a = this.get();
      const i = a.indexOf(id);
      if (i >= 0) a.splice(i,1); else a.push(id);
      this.set(a);
      return i < 0;
    }
  };

  // ---------- Progress (Ascension Path) ----------
  V.progress = {
    get() { try { return JSON.parse(localStorage.getItem('v_progress') || '{}'); } catch(e){ return {}; } },
    set(o) { localStorage.setItem('v_progress', JSON.stringify(o)); },
    mark(stage, articleId) {
      const o = this.get();
      o[stage] = o[stage] || [];
      if (!o[stage].includes(articleId)) o[stage].push(articleId);
      this.set(o);
    },
    count(stage) { const o = this.get(); return (o[stage] || []).length; }
  };

  // ---------- Articles data layer ----------
  // Seed loaded from data/articles.json; Firestore overrides/augments.
  V.seedArticles = null;
  V.articlesCache = null;

  V.loadSeed = async function () {
    if (V.seedArticles) return V.seedArticles;
    try {
      const r = await fetch('data/articles.json');
      const j = await r.json();
      V.seedArticles = Array.isArray(j) ? j : (j.articles || []);
    } catch (e) {
      console.warn('seed load failed', e);
      V.seedArticles = [];
    }
    return V.seedArticles;
  };

  V.loadArticles = async function () {
    if (V.articlesCache) return V.articlesCache;
    const seed = await V.loadSeed();
    let remote = [];
    const db = V.db();
    if (db) {
      try {
        const snap = await db.collection('void_articles').get();
        snap.forEach(d => remote.push(Object.assign({ id: d.id }, d.data())));
      } catch (e) { console.warn('firestore articles failed', e); }
    }
    // Merge: remote overrides seed by id; include seed not in remote
    const map = new Map();
    seed.forEach(a => map.set(a.id, Object.assign({}, a)));
    remote.forEach(a => map.set(a.id, Object.assign({}, a)));
    V.articlesCache = Array.from(map.values());
    return V.articlesCache;
  };

  V.invalidateArticles = function () { V.articlesCache = null; };

  V.getArticle = async function (id) {
    const list = await V.loadArticles();
    return list.find(a => a.id === id) || null;
  };

  V.publishedArticles = async function () {
    const list = await V.loadArticles();
    return list.filter(a => (a.status || 'published') === 'published');
  };

  // ---------- Categories ----------
  V.CATEGORIES_DEFAULT = [
    { id: 'cognitive', name: 'Cognitive Psychology', desc: 'How the mind processes information.' },
    { id: 'behavioral', name: 'Behavioral Psychology', desc: 'How behavior is learned and shaped.' },
    { id: 'ei', name: 'Emotional Intelligence', desc: 'Perceiving, using, and managing emotion.' },
    { id: 'assertiveness', name: 'Assertiveness', desc: 'Standing your ground with respect.' },
    { id: 'critical', name: 'Critical Thinking', desc: 'Evaluating claims and reasoning well.' },
    { id: 'resilience', name: 'Psychological Resilience', desc: 'Recovering and adapting.' },
    { id: 'human', name: 'Human Behavior', desc: 'Why people do what they do.' },
    { id: 'social', name: 'Social Psychology', desc: 'Influence, groups, and relationships.' },
    { id: 'decision', name: 'Decision Making', desc: 'Choosing under uncertainty.' },
    { id: 'biases', name: 'Cognitive Biases', desc: 'Systematic errors in thinking.' },
    { id: 'stoic', name: 'Stoic Philosophy', desc: 'Ancient discipline for modern minds.' },
  ];
  V.CATEGORIES = V.CATEGORIES_DEFAULT.slice();

  V.loadCategories = async function () {
    const db = V.db();
    if (db) {
      try {
        const snap = await db.collection('void_categories').get();
        const remote = [];
        snap.forEach(d => remote.push(Object.assign({ id: d.id }, d.data())));
        if (remote.length) {
          // merge: remote overrides defaults by id, plus new ones
          const map = new Map();
          V.CATEGORIES_DEFAULT.forEach(c => map.set(c.id, Object.assign({}, c)));
          remote.forEach(c => map.set(c.id, Object.assign({}, c)));
          V.CATEGORIES = Array.from(map.values());
        }
      } catch (e) { console.warn('categories failed', e); }
    }
    return V.CATEGORIES;
  };

  V.categoryName = function (id) {
    const c = V.CATEGORIES.find(x => x.id === id);
    return c ? c.name : id;
  };

  // ---------- Daily tips ----------
  V.loadTips = async function () {
    const db = V.db();
    if (db) {
      try {
        const snap = await db.collection('void_tips').get();
        const out = [];
        snap.forEach(d => out.push(Object.assign({ id: d.id }, d.data())));
        if (out.length) return out;
      } catch (e) { console.warn('tips failed', e); }
    }
    return [
      { text: 'THE WORLD DOES NOT DEFINE YOUR LIMITS.', source: 'THE VOID' },
      { text: 'MASTER YOUR REACTIONS.', source: 'THE VOID' },
      { text: 'KNOW YOUR MIND. KNOW YOUR POWER.', source: 'THE VOID' },
      { text: 'SILENCE IS A CHOICE. NOT A WEAKNESS.', source: 'THE VOID' },
      { text: 'YOUR GREATEST ADVANTAGE IS SELF-AWARENESS.', source: 'THE VOID' },
    ];
  };

  // ---------- Stages ----------
  V.STAGES = [
    { id: 'awareness', roman: 'I', name: 'AWARENESS', desc: 'Understanding the self and observing patterns of thought.' },
    { id: 'control', roman: 'II', name: 'CONTROL', desc: 'Regulating emotion and mastering reactions.' },
    { id: 'discipline', roman: 'III', name: 'DISCIPLINE', desc: 'Building discipline and consistency in decisions.' },
    { id: 'perception', roman: 'IV', name: 'PERCEPTION', desc: 'Critical thinking and understanding human behavior.' },
    { id: 'mastery', roman: 'V', name: 'MASTERY', desc: 'Psychological independence and conscious decision-making.' },
  ];

  // ---------- Nebula canvas ----------
  V.initNebula = function () {
    if (settings.reduceMotion) return;
    const c = document.getElementById('nebula');
    if (!c) return;
    const ctx = c.getContext('2d');
    let w, h, stars = [], t = 0;
    function resize() {
      w = c.width = window.innerWidth;
      h = c.height = window.innerHeight;
    }
    function init() {
      stars = [];
      const n = Math.min(180, Math.floor(w*h/9000));
      for (let i=0;i<n;i++) stars.push({
        x: Math.random()*w, y: Math.random()*h,
        r: Math.random()*1.2+0.2,
        vx: (Math.random()-0.5)*0.05,
        vy: (Math.random()-0.5)*0.05,
        a: Math.random()*0.6+0.2
      });
    }
    resize(); init();
    window.addEventListener('resize', () => { resize(); init(); });
    function draw() {
      t += 0.002;
      ctx.clearRect(0,0,w,h);
      // nebula clouds
      const g1 = ctx.createRadialGradient(w*0.2, h*0.1, 0, w*0.2, h*0.1, w*0.6);
      g1.addColorStop(0, 'rgba(74,26,107,0.18)');
      g1.addColorStop(1, 'transparent');
      ctx.fillStyle = g1; ctx.fillRect(0,0,w,h);
      const g2 = ctx.createRadialGradient(w*0.85, h*0.05, 0, w*0.85, h*0.05, w*0.5);
      g2.addColorStop(0, 'rgba(107,45,143,0.14)');
      g2.addColorStop(1, 'transparent');
      ctx.fillStyle = g2; ctx.fillRect(0,0,w,h);
      // stars
      stars.forEach(s => {
        s.x += s.vx; s.y += s.vy;
        if (s.x < 0) s.x = w; if (s.x > w) s.x = 0;
        if (s.y < 0) s.y = h; if (s.y > h) s.y = 0;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(201,201,212,${s.a*(0.6+0.4*Math.sin(t*2+s.x))})`;
        ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    draw();
  };

  // ---------- Nav wiring ----------
  V.wireNav = function () {
    const toggle = document.querySelector('.v-nav-toggle');
    const links = document.querySelector('.v-nav-links');
    if (toggle && links) toggle.addEventListener('click', () => links.classList.toggle('open'));
    // active link
    const path = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.v-nav-links a').forEach(a => {
      const href = (a.getAttribute('href') || '').split('/').pop();
      if (href === path) a.classList.add('active');
    });
  };

  // ---------- Settings panel wiring ----------
  V.wireSettings = function () {
    const btn = document.querySelector('.v-settings button');
    const panel = document.querySelector('.v-settings-panel');
    if (!btn || !panel) return;
    btn.addEventListener('click', () => panel.classList.toggle('open'));
    const rm = panel.querySelector('[data-setting="reduceMotion"]');
    const snd = panel.querySelector('[data-setting="sound"]');
    if (rm) { rm.checked = settings.reduceMotion; rm.addEventListener('change', () => { settings.reduceMotion = rm.checked; applySettings(); if (rm.checked) { const c = document.getElementById('nebula'); if (c) c.style.display='none'; } else { V.initNebula(); } }); }
    if (snd) { snd.checked = settings.sound; snd.addEventListener('change', () => { settings.sound = snd.checked; applySettings(); }); }
  };

  // ---------- Common init ----------
  V.initCommon = function () {
    V.wireNav();
    V.wireSettings();
    if (!settings.reduceMotion) V.initNebula();
  };

  // ---------- Markdown-ish renderer (simple) ----------
  V.renderBody = function (text) {
    if (!text) return '';
    const lines = String(text).split('\n');
    let html = '', inList = false, inQuote = false;
    lines.forEach(line => {
      const t = line.trim();
      if (t === '') { if (inList) { html += '</ul>'; inList = false; } if (inQuote) { html += '</blockquote>'; inQuote = false; } return; }
      if (t.startsWith('> ')) {
        if (inList) { html += '</ul>'; inList = false; }
        if (!inQuote) { html += '<blockquote>'; inQuote = true; }
        html += V.esc(t.slice(2)) + ' ';
        return;
      }
      if (t.startsWith('- ') || t.startsWith('* ')) {
        if (inQuote) { html += '</blockquote>'; inQuote = false; }
        if (!inList) { html += '<ul>'; inList = true; }
        html += '<li>' + V.esc(t.slice(2)) + '</li>';
        return;
      }
      if (inList) { html += '</ul>'; inList = false; }
      if (inQuote) { html += '</blockquote>'; inQuote = false; }
      // headings
      if (t.startsWith('### ')) { html += '<h4>' + V.esc(t.slice(4)) + '</h4>'; return; }
      if (t.startsWith('## ')) { html += '<h3>' + V.esc(t.slice(3)) + '</h3>'; return; }
      if (t.startsWith('# ')) { html += '<h2>' + V.esc(t.slice(2)) + '</h2>'; return; }
      html += '<p>' + V.esc(t) + '</p>';
    });
    if (inList) html += '</ul>';
    if (inQuote) html += '</blockquote>';
    return html;
  };

})();
