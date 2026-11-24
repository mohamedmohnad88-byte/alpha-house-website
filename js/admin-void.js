(function () {
  'use strict';
  const V = window.VOID;

  const db = () => window.AH.fb;
  const auth = () => window.AH.firebase.auth;

  let articles = [];
  let editingId = null;

  // ---------- Guard ----------
  async function guard() {
    const msg = document.getElementById('guardMsg');
    if (!window.AH.isConfigured) { msg.textContent = 'Firebase not configured.'; return false; }
    const user = auth().currentUser;
    if (!user) { location.href = 'login.html'; return false; }
    const doc = await db().collection('users').doc(user.uid).get();
    if (!doc.exists || doc.data().role !== 'admin') { await auth().signOut(); location.href = 'login.html'; return false; }
    msg.style.display = 'none';
    return true;
  }

  // ---------- Nav sections ----------
  function wireNav() {
    document.querySelectorAll('.admin-side a[data-sec]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const sec = a.getAttribute('data-sec');
        document.querySelectorAll('.admin-side a[data-sec]').forEach(x => x.classList.remove('active'));
        a.classList.add('active');
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        document.getElementById('sec-' + sec).classList.add('active');
      });
    });
    document.getElementById('logoutBtn').addEventListener('click', async (e) => {
      e.preventDefault();
      await auth().signOut();
      location.href = 'login.html';
    });
  }

  // ---------- Articles ----------
  async function loadArticles() {
    try {
      const snap = await db().collection('void_articles').get();
      articles = [];
      snap.forEach(d => articles.push(Object.assign({ id: d.id }, d.data())));
    } catch (e) { console.warn(e); articles = []; }
    // if empty, load seed as reference (read-only display? we'll just show empty)
    renderArticles();
    updateStats();
  }

  function updateStats() {
    document.getElementById('statArticles').textContent = articles.length;
    document.getElementById('statPublished').textContent = articles.filter(a => a.status === 'published').length;
    document.getElementById('statDrafts').textContent = articles.filter(a => a.status !== 'published').length;
  }

  function renderArticles() {
    const tbody = document.getElementById('articlesTbody');
    tbody.innerHTML = articles.map(a => `
      <tr>
        <td>${V.esc(a.title)}</td>
        <td>${V.esc(V.categoryName(a.category))}</td>
        <td>${V.esc(a.stage || '—')}</td>
        <td><span class="v-badge ${a.status === 'published' ? 'published' : 'draft'}">${a.status || 'draft'}</span></td>
        <td>${V.formatDate(a.updated)}</td>
        <td>
          <button class="v-btn" style="padding:4px 10px;font-size:0.65rem;" data-edit="${V.esc(a.id)}">Edit</button>
          <button class="v-btn" style="padding:4px 10px;font-size:0.65rem;" data-toggle="${V.esc(a.id)}">${a.status === 'published' ? 'Unpublish' : 'Publish'}</button>
          <button class="v-btn" style="padding:4px 10px;font-size:0.65rem;" data-del="${V.esc(a.id)}">Delete</button>
        </td>
      </tr>`).join('');
    tbody.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => editArticle(b.getAttribute('data-edit'))));
    tbody.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => toggleStatus(b.getAttribute('data-toggle'))));
    tbody.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => deleteArticle(b.getAttribute('data-del'))));
  }

  function resetForm() {
    editingId = null;
    document.getElementById('a_id').value = '';
    document.getElementById('a_title').value = '';
    document.getElementById('a_summary').value = '';
    document.getElementById('a_body').value = '';
    document.getElementById('a_exercises').value = '';
    document.getElementById('a_tags').value = '';
    document.getElementById('a_refs').value = '[]';
    document.getElementById('a_updated').value = new Date().toISOString().slice(0,10);
    document.getElementById('a_status').value = 'draft';
    document.getElementById('a_category').value = V.CATEGORIES[0] ? V.CATEGORIES[0].id : '';
    document.getElementById('a_stage').value = '';
    document.getElementById('editorStatus').textContent = '';
  }

  function populateSelects() {
    const catSel = document.getElementById('a_category');
    catSel.innerHTML = V.CATEGORIES.map(c => `<option value="${V.esc(c.id)}">${V.esc(c.name)}</option>`).join('');
    const stageSel = document.getElementById('a_stage');
    stageSel.innerHTML = '<option value="">— none —</option>' + V.STAGES.map(s => `<option value="${V.esc(s.id)}">${V.esc(s.roman+' '+s.name)}</option>`).join('');
  }

  function editArticle(id) {
    const a = articles.find(x => x.id === id);
    if (!a) return;
    editingId = id;
    document.getElementById('a_id').value = a.id;
    document.getElementById('a_title').value = a.title || '';
    document.getElementById('a_summary').value = a.summary || '';
    document.getElementById('a_body').value = a.body || '';
    document.getElementById('a_exercises').value = (a.exercises || []).join('\n');
    document.getElementById('a_tags').value = (a.tags || []).join(', ');
    document.getElementById('a_refs').value = JSON.stringify(a.references || [], null, 2);
    document.getElementById('a_updated').value = a.updated || new Date().toISOString().slice(0,10);
    document.getElementById('a_status').value = a.status || 'draft';
    document.getElementById('a_category').value = a.category || (V.CATEGORIES[0] && V.CATEGORIES[0].id);
    document.getElementById('a_stage').value = a.stage || '';
    // switch to editor tab
    document.querySelector('.admin-side a[data-sec="editor"]').click();
    document.getElementById('editorStatus').textContent = 'Editing: ' + a.id;
  }

  async function saveArticle(e) {
    e.preventDefault();
    const idInput = document.getElementById('a_id').value.trim();
    const id = idInput || V.slug(document.getElementById('a_title').value) + '-' + Date.now().toString(36);
    let refs = [];
    try { refs = JSON.parse(document.getElementById('a_refs').value || '[]'); } catch (err) { document.getElementById('editorStatus').textContent = 'Invalid references JSON.'; return; }
    const data = {
      title: document.getElementById('a_title').value.trim(),
      category: document.getElementById('a_category').value,
      stage: document.getElementById('a_stage').value || null,
      status: document.getElementById('a_status').value,
      summary: document.getElementById('a_summary').value.trim(),
      body: document.getElementById('a_body').value,
      exercises: document.getElementById('a_exercises').value.split('\n').map(s => s.trim()).filter(Boolean),
      tags: document.getElementById('a_tags').value.split(',').map(s => s.trim()).filter(Boolean),
      references: refs,
      updated: document.getElementById('a_updated').value || new Date().toISOString().slice(0,10),
    };
    try {
      await db().collection('void_articles').doc(id).set(data, { merge: true });
      V.toast('Saved');
      document.getElementById('editorStatus').textContent = 'Saved: ' + id;
      resetForm();
      await loadArticles();
    } catch (err) {
      document.getElementById('editorStatus').textContent = 'Error: ' + (err.message || err);
    }
  }

  async function toggleStatus(id) {
    const a = articles.find(x => x.id === id);
    if (!a) return;
    const newStatus = a.status === 'published' ? 'draft' : 'published';
    try {
      await db().collection('void_articles').doc(id).update({ status: newStatus, updated: new Date().toISOString().slice(0,10) });
      V.toast(newStatus === 'published' ? 'Published' : 'Unpublished');
      await loadArticles();
    } catch (err) { V.toast('Error: ' + err.message); }
  }

  async function deleteArticle(id) {
    if (!confirm('Delete this article?')) return;
    try {
      await db().collection('void_articles').doc(id).delete();
      V.toast('Deleted');
      await loadArticles();
    } catch (err) { V.toast('Error: ' + err.message); }
  }

  // ---------- Categories ----------
  async function loadCategoriesAdmin() {
    await V.loadCategories();
    renderCategories();
    populateSelects();
  }

  function renderCategories() {
    const tbody = document.getElementById('catsTbody');
    tbody.innerHTML = V.CATEGORIES.map(c => `
      <tr>
        <td>${V.esc(c.id)}</td>
        <td>${V.esc(c.name)}</td>
        <td>${V.esc(c.desc || '')}</td>
        <td><button class="v-btn" style="padding:4px 10px;font-size:0.65rem;" data-delcat="${V.esc(c.id)}">Delete</button></td>
      </tr>`).join('');
    tbody.querySelectorAll('[data-delcat]').forEach(b => b.addEventListener('click', () => deleteCategory(b.getAttribute('data-delcat'))));
  }

  async function addCategory() {
    const name = document.getElementById('newCatName').value.trim();
    const id = document.getElementById('newCatId').value.trim() || V.slug(name);
    if (!name || !id) { V.toast('Name and id required'); return; }
    try {
      await db().collection('void_categories').doc(id).set({ name, desc: '' });
      document.getElementById('newCatName').value = '';
      document.getElementById('newCatId').value = '';
      await loadCategoriesAdmin();
      V.toast('Category added');
    } catch (err) { V.toast('Error: ' + err.message); }
  }

  async function deleteCategory(id) {
    // only allow deleting remote categories (not defaults) — attempt delete; defaults will reappear
    if (!confirm('Delete category ' + id + '?')) return;
    try {
      await db().collection('void_categories').doc(id).delete();
      await loadCategoriesAdmin();
      V.toast('Deleted');
    } catch (err) { V.toast('Error: ' + err.message); }
  }

  // ---------- Tips ----------
  async function loadTipsAdmin() {
    const tbody = document.getElementById('tipsTbody');
    let tips = [];
    try {
      const snap = await db().collection('void_tips').get();
      snap.forEach(d => tips.push(Object.assign({ id: d.id }, d.data())));
    } catch (e) { console.warn(e); }
    tbody.innerHTML = tips.map(t => `
      <tr>
        <td>${V.esc(t.text)}</td>
        <td>${V.esc(t.source || '')}</td>
        <td><button class="v-btn" style="padding:4px 10px;font-size:0.65rem;" data-deltip="${V.esc(t.id)}">Delete</button></td>
      </tr>`).join('');
    tbody.querySelectorAll('[data-deltip]').forEach(b => b.addEventListener('click', () => deleteTip(b.getAttribute('data-deltip'))));
  }

  async function addTip() {
    const text = document.getElementById('newTipText').value.trim();
    const source = document.getElementById('newTipSource').value.trim() || 'THE VOID';
    if (!text) { V.toast('Text required'); return; }
    try {
      await db().collection('void_tips').add({ text, source });
      document.getElementById('newTipText').value = '';
      document.getElementById('newTipSource').value = '';
      await loadTipsAdmin();
      V.toast('Tip added');
    } catch (err) { V.toast('Error: ' + err.message); }
  }

  async function seedFromJson() {
    const status = document.getElementById('seedStatus');
    status.textContent = 'Seeding...';
    try {
      const r = await fetch('../data/articles.json');
      const j = await r.json();
      const list = Array.isArray(j) ? j : (j.articles || []);
      let n = 0;
      for (const a of list) {
        const id = a.id;
        const data = Object.assign({}, a);
        delete data.id;
        await db().collection('void_articles').doc(id).set(data, { merge: true });
        n++;
      }
      status.textContent = 'Seeded ' + n + ' articles.';
      await loadArticles();
    } catch (err) {
      status.textContent = 'Error: ' + (err.message || err);
    }
  }

  async function deleteTip(id) {
    if (!confirm('Delete tip?')) return;
    try {
      await db().collection('void_tips').doc(id).delete();
      await loadTipsAdmin();
      V.toast('Deleted');
    } catch (err) { V.toast('Error: ' + err.message); }
  }

  // ---------- Init ----------
  async function init() {
    wireNav();
    const ok = await guard();
    if (!ok) return;
    await V.loadCategories();
    populateSelects();
    renderCategories();
    await loadArticles();
    await loadTipsAdmin();

    document.getElementById('newArticleBtn').addEventListener('click', () => {
      resetForm();
      document.querySelector('.admin-side a[data-sec="editor"]').click();
    });
    document.getElementById('refreshArticlesBtn').addEventListener('click', loadArticles);
    document.getElementById('articleForm').addEventListener('submit', saveArticle);
    document.getElementById('cancelEditBtn').addEventListener('click', () => {
      resetForm();
      document.querySelector('.admin-side a[data-sec="articles"]').click();
    });
    document.getElementById('addCatBtn').addEventListener('click', addCategory);
    document.getElementById('addTipBtn').addEventListener('click', addTip);
    document.getElementById('seedBtn').addEventListener('click', seedFromJson);

    resetForm();
  }

  // auth state
  auth().onAuthStateChanged(async (user) => {
    if (user) init();
    else location.href = 'login.html';
  });
})();
