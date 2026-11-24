(function () {
  'use strict';
  const V = window.VOID;

  function qs(name) { return new URLSearchParams(location.search).get(name); }

  async function init() {
    V.initCommon();
    await V.loadCategories();
    const id = qs('id');
    const loading = document.getElementById('loading');
    const article = document.getElementById('article');
    const notfound = document.getElementById('notfound');
    if (!id) { loading.style.display='none'; notfound.style.display='block'; return; }
    const a = await V.getArticle(id);
    loading.style.display = 'none';
    if (!a || (a.status && a.status !== 'published')) { notfound.style.display='block'; return; }
    article.style.display = 'block';

    const stage = V.STAGES.find(s => s.id === a.stage);
    const fav = V.favs.has(a.id);
    const related = (await V.publishedArticles()).filter(x => x.id !== a.id && (x.category === a.category || x.stage === a.stage)).slice(0,4);

    article.innerHTML = `
      <div class="v-article-meta">
        ${V.esc(V.categoryName(a.category))} &middot; ${stage ? stage.roman+' '+stage.name : ''} &middot; Updated ${V.formatDate(a.updated)}
        <span style="float:right;" class="v-fav ${fav?'active':''}" id="favBtn">${fav?'&#9829;':'&#9825;'}</span>
      </div>
      <h1>${V.esc(a.title)}</h1>
      <p style="font-size:1.2rem;color:var(--v-text-muted);font-style:italic;margin-bottom:32px;">${V.esc(a.summary)}</p>

      <div class="v-article-section">
        <h3>Facts vs. Interpretation</h3>
        <p class="v-mono" style="font-size:0.72rem;">This article separates research-backed facts, psychological theories, philosophical interpretations, and personal development exercises.</p>
      </div>

      <div class="v-article-body">${V.renderBody(a.body)}</div>

      ${a.exercises && a.exercises.length ? `
      <div class="v-article-section">
        <h3>Practical Exercises</h3>
        <ul>${a.exercises.map(e => '<li>'+V.esc(e)+'</li>').join('')}</ul>
      </div>` : ''}

      ${a.references && a.references.length ? `
      <div class="v-article-section">
        <h3>References</h3>
        ${a.references.map(r => `
          <div class="v-ref">
            <span class="v-ref-type">${V.esc(r.type)}</span>
            <span>
              ${r.url ? '<a href="'+V.esc(r.url)+'" target="_blank" rel="noopener">'+V.esc(r.title)+'</a>' : V.esc(r.title)}
              ${r.author ? ' — '+V.esc(r.author) : ''}${r.year ? ' ('+r.year+')' : ''}
            </span>
          </div>`).join('')}
      </div>` : ''}

      ${related.length ? `
      <div class="v-article-section">
        <h3>Related Articles</h3>
        <div class="v-grid v-grid-2">
          ${related.map(r => `<div class="v-card"><div class="v-card-meta">${V.esc(V.categoryName(r.category))}</div><div class="v-card-title" style="font-size:1.1rem;"><a href="article.html?id=${encodeURIComponent(r.id)}">${V.esc(r.title)}</a></div></div>`).join('')}
        </div>
      </div>` : ''}

      <div style="margin-top:48px;display:flex;gap:12px;flex-wrap:wrap;">
        <button class="v-btn" id="markProgress">Mark Stage Progress</button>
        <a href="library.html" class="v-btn">Back to Library</a>
      </div>
    `;

    document.getElementById('favBtn').addEventListener('click', () => {
      const now = V.favs.toggle(a.id);
      const btn = document.getElementById('favBtn');
      btn.classList.toggle('active', now);
      btn.innerHTML = now ? '&#9829;' : '&#9825;';
      V.toast(now ? 'Added to favorites' : 'Removed');
    });

    document.getElementById('markProgress').addEventListener('click', () => {
      if (a.stage) { V.progress.mark(a.stage, a.id); V.toast('Progress recorded'); }
    });

    // mark progress automatically on read
    if (a.stage) V.progress.mark(a.stage, a.id);
  }

  init();
})();
