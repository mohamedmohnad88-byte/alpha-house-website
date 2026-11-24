(function () {
  'use strict';
  const V = window.VOID;

  let all = [];
  let filtered = [];

  function renderCard(a) {
    const fav = V.favs.has(a.id);
    const stage = V.STAGES.find(s => s.id === a.stage);
    return `
      <div class="v-card" data-id="${V.esc(a.id)}">
        <div style="display:flex;justify-content:space-between;align-items:start;gap:8px;">
          <div class="v-card-meta">${V.esc(V.categoryName(a.category))} &middot; ${stage ? stage.roman + ' ' + stage.name : ''}</div>
          <span class="v-fav ${fav?'active':''}" data-fav="${V.esc(a.id)}">${fav?'&#9829;':'&#9825;'}</span>
        </div>
        <div class="v-card-title">${V.esc(a.title)}</div>
        <p style="color:var(--v-text-muted);font-size:0.95rem;">${V.esc(a.summary)}</p>
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
          <a href="article.html?id=${encodeURIComponent(a.id)}" class="v-btn" style="padding:8px 16px;font-size:0.7rem;">Read</a>
        </div>
      </div>`;
  }

  function applyFilters() {
    const q = (document.getElementById('searchInput').value || '').toLowerCase().trim();
    const cat = document.getElementById('catFilter').value;
    const stage = document.getElementById('stageFilter').value;
    const favOnly = document.getElementById('favOnly').checked;
    filtered = all.filter(a => {
      if ((a.status || 'published') !== 'published') return false;
      if (cat && a.category !== cat) return false;
      if (stage && a.stage !== stage) return false;
      if (favOnly && !V.favs.has(a.id)) return false;
      if (q) {
        const hay = (a.title + ' ' + a.summary + ' ' + (a.tags||[]).join(' ') + ' ' + V.categoryName(a.category)).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const grid = document.getElementById('articleGrid');
    grid.innerHTML = filtered.map(renderCard).join('');
    document.getElementById('emptyState').style.display = filtered.length ? 'none' : 'block';
    // fav toggle
    grid.querySelectorAll('.v-fav').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const id = el.getAttribute('data-fav');
        const now = V.favs.toggle(id);
        el.classList.toggle('active', now);
        el.innerHTML = now ? '&#9829;' : '&#9825;';
        V.toast(now ? 'Added to favorites' : 'Removed from favorites');
      });
    });
  }

  async function init() {
    V.initCommon();
    await V.loadCategories();
    // populate categories
    const catSel = document.getElementById('catFilter');
    V.CATEGORIES.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = c.name;
      catSel.appendChild(o);
    });
    const stageSel = document.getElementById('stageFilter');
    V.STAGES.forEach(s => {
      const o = document.createElement('option');
      o.value = s.id; o.textContent = s.roman + ' ' + s.name;
      stageSel.appendChild(o);
    });
    // chips
    const chips = document.getElementById('catChips');
    const allChip = document.createElement('span');
    allChip.className = 'v-chip active'; allChip.textContent = 'All'; allChip.dataset.cat = '';
    chips.appendChild(allChip);
    V.CATEGORIES.forEach(c => {
      const ch = document.createElement('span');
      ch.className = 'v-chip'; ch.textContent = c.name; ch.dataset.cat = c.id;
      chips.appendChild(ch);
    });
    chips.addEventListener('click', (e) => {
      const ch = e.target.closest('.v-chip');
      if (!ch) return;
      chips.querySelectorAll('.v-chip').forEach(x => x.classList.remove('active'));
      ch.classList.add('active');
      catSel.value = ch.dataset.cat;
      applyFilters();
    });

    document.getElementById('searchInput').addEventListener('input', applyFilters);
    catSel.addEventListener('change', applyFilters);
    stageSel.addEventListener('change', applyFilters);
    document.getElementById('favOnly').addEventListener('change', applyFilters);

    all = await V.publishedArticles();
    applyFilters();
  }

  init();
})();
