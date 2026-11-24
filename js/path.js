(function () {
  'use strict';
  const V = window.VOID;

  async function init() {
    V.initCommon();
    const articles = await V.publishedArticles();
    const container = document.getElementById('stages');
    V.STAGES.forEach((s, idx) => {
      const stageArticles = articles.filter(a => a.stage === s.id);
      const done = V.progress.count(s.id);
      const total = stageArticles.length;
      const pct = total ? Math.round((done / total) * 100) : 0;
      const div = document.createElement('div');
      div.className = 'v-stage' + (pct === 100 ? ' done' : (done > 0 ? ' active' : ''));
      div.setAttribute('data-roman', s.roman);
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap;">
          <h3 style="margin:0;">${s.roman} &mdash; ${V.esc(s.name)}</h3>
          <span class="v-mono">${done}/${total} complete</span>
        </div>
        <p style="color:var(--v-text-muted);margin:8px 0 16px;">${V.esc(s.desc)}</p>
        <div class="v-progress"><div class="v-progress-bar" style="width:${pct}%"></div></div>
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
          ${stageArticles.map(a => `<a href="article.html?id=${encodeURIComponent(a.id)}" class="v-chip">${V.esc(a.title)}</a>`).join('')}
        </div>
      `;
      container.appendChild(div);
    });
  }
  init();
})();
