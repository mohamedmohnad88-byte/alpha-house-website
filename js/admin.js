(function () {
  const AH = window.AH || {};
  const auth = (AH.firebase && AH.firebase.auth) ? AH.firebase.auth : null;
  const db = AH.fb || null;
  const storage = (AH.firebase && AH.firebase.storage) ? AH.firebase.storage : null;
  if (!AH.statusLabel) {
    AH.statusLabel = function (s, lang) {
      const dict = { ar: { draft:'مسودة', available:'متاح', reserved:'محجوز', sold:'مباع', new:'جديد', contacted:'تم التواصل', closed:'مغلق' },
                     en: { draft:'Draft', available:'Available', reserved:'Reserved', sold:'Sold', new:'New', contacted:'Contacted', closed:'Closed' } };
      return (dict[lang] && dict[lang][s]) || s;
    };
  }

  function dbg(msg) {
    const el = document.getElementById('debugPanel');
    if (el) { el.textContent += msg + '\\n'; }
    console.log('[admin]', msg);
  }

  // ============ AUTH GUARD ============
  async function guard() {
    dbg('guard start; db=' + !!db + ' auth=' + !!auth);
    if (!db || !auth) {
      const el = document.getElementById('propertiesTableWrap');
      if (el) el.innerHTML = '<p class="form-status error">Firebase غير مُعد. تحقق من js/config.js.</p>';
      dbg('Firebase not configured');
      return false;
    }
    return new Promise((resolve) => {
      const unsub = auth.onAuthStateChanged(async (user) => {
        unsub();
        if (!user) {
          dbg('no user -> redirect login');
          window.location.href = 'login.html';
          resolve(false);
          return;
        }
        dbg('logged in as UID=' + user.uid + ' email=' + user.email);
        try {
          const snap = await db.collection('users').doc(user.uid).get();
          if (!snap.exists) {
            dbg('no users doc for ' + user.uid);
            await auth.signOut();
            alert('هذا الحساب غير مسجل كمدير (لا يوجد users/' + user.uid + ').');
            window.location.href = 'login.html';
            resolve(false);
            return;
          }
          const role = snap.data().role;
          dbg('role = ' + role);
          if (role !== 'admin') {
            await auth.signOut();
            alert('دور الحساب: ' + role + ' (ليس admin).');
            window.location.href = 'login.html';
            resolve(false);
            return;
          }
          const el = document.getElementById('adminEmail');
          if (el) el.textContent = user.email + ' (admin)';
          dbg('guard OK');
          resolve(true);
        } catch (e) {
          dbg('guard error: ' + e.message);
          const el = document.getElementById('propertiesTableWrap');
          if (el) el.innerHTML = '<p class="form-status error">خطأ: ' + e.message + '</p>';
          resolve(false);
        }
      });
    });
  }

  // ============ HELPERS ============
  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function toast(el, msg, ok) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'form-status ' + (ok ? 'success' : 'error');
  }
  function tsToDate(ts) {
    if (!ts) return '';
    try { const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleDateString(); } catch (e) { return ''; }
  }

  // ============ TABS ============
  const tabTitles = {
    properties: 'العقارات',
    projects: 'المشروعات',
    areas: 'المناطق',
    inquiries: 'طلبات العملاء',
    settings: 'الإعدادات'
  };
  document.querySelectorAll('.admin-nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.admin-nav-btn').forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.admin-tab').forEach((s) => s.classList.toggle('active', s.id === 'tab-' + tab));
      document.getElementById('tabTitle').textContent = tabTitles[tab];
      loadTab(tab);
    });
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await auth.signOut();
    window.location.href = 'login.html';
  });

  // ============ IMAGE UPLOAD ============
  // Free-tier friendly: uses Firebase Storage if available, otherwise compresses
  // the image to a base64 data URL stored directly in Firestore (no billing).
  async function compressToBase64(file, maxWidth, quality) {
    maxWidth = maxWidth || 1000;
    quality = quality || 0.7;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          try {
            resolve(canvas.toDataURL('image/jpeg', quality));
          } catch (err) { reject(err); }
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadImage(file) {
    // Try Firebase Storage first (if enabled)
    if (storage) {
      try {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `property-images/uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const ref = storage.ref().child(path);
        await ref.put(file);
        return await ref.getDownloadURL();
      } catch (e) {
        console.warn('Storage upload failed, falling back to base64:', e.message);
      }
    }
    // Free fallback: compressed base64 (no billing, no Storage)
    return await compressToBase64(file, 1000, 0.7);
  }

  function previewImages(input, previewEl, hiddenInput, existingUrls) {
    input.addEventListener('change', async () => {
      const files = Array.from(input.files || []);
      const urls = existingUrls ? [...existingUrls] : [];
      for (const f of files) {
        try {
          const url = await uploadImage(f);
          urls.push(url);
          const img = document.createElement('img');
          img.src = url;
          previewEl.appendChild(img);
        } catch (e) {
          console.error(e);
          toast(document.getElementById('propertyStatus'), 'فشل رفع صورة: ' + e.message, false);
        }
      }
      if (hiddenInput) hiddenInput.value = JSON.stringify(urls);
    });
  }

  // ============ PROPERTIES ============
  let propUnsub = null;
  let allPropsCache = [];

  function renderPropertiesTable(wrap) {
    if (allPropsCache.length === 0) {
      wrap.innerHTML = '<p style="color:var(--text-muted);">لا توجد عقارات. أضف عقاراً جديداً.</p>';
      return;
    }
    let html = '<table class="admin-table"><thead><tr><th>الاسم</th><th>النوع</th><th>المساحة</th><th>السعر</th><th>الحالة</th><th>منشور</th><th>مميز</th><th>إجراءات</th></tr></thead><tbody>';
    allPropsCache.forEach((p) => {
      html += `<tr>
        <td>${esc(p.name_ar)}</td>
        <td>${esc(p.type)}</td>
        <td>${p.size}</td>
        <td>${p.price != null ? Number(p.price).toLocaleString() : '—'}</td>
        <td><span class="badge-status">${AH.statusLabel(p.status, 'ar')}</span></td>
        <td>${p.is_published ? '✓' : '—'}</td>
        <td>${p.is_featured ? '★' : '—'}</td>
        <td class="actions">
          <button class="btn btn-ghost btn-sm" data-edit-prop="${p.id}">تعديل</button>
          <button class="btn btn-ghost btn-sm" data-toggle-prop="${p.id}" data-published="${p.is_published}">${p.is_published ? 'إخفاء' : 'إظهار'}</button>
          <button class="btn btn-ghost btn-sm" data-feature-prop="${p.id}" data-featured="${p.is_featured}">${p.is_featured ? 'إلغاء تمييز' : 'تمييز'}</button>
          <button class="btn btn-ghost btn-sm" data-delete-prop="${p.id}" style="color:var(--danger);">حذف</button>
        </td>
      </tr>`;
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;

    wrap.querySelectorAll('[data-edit-prop]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = allPropsCache.find((x) => x.id === btn.dataset.editProp);
        if (p) editProperty(p);
      });
    });
    wrap.querySelectorAll('[data-toggle-prop]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.toggleProp;
        const cur = btn.dataset.published === 'true';
        await db.collection('properties').doc(id).update({ is_published: !cur, updated_at: firebase.firestore.FieldValue.serverTimestamp() });
      });
    });
    wrap.querySelectorAll('[data-feature-prop]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.featureProp;
        const cur = btn.dataset.featured === 'true';
        await db.collection('properties').doc(id).update({ is_featured: !cur, updated_at: firebase.firestore.FieldValue.serverTimestamp() });
      });
    });
    wrap.querySelectorAll('[data-delete-prop]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('حذف هذا العقار؟')) return;
        await db.collection('properties').doc(btn.dataset.deleteProp).delete();
      });
    });
  }

  async function loadProperties() {
    const wrap = document.getElementById('propertiesTableWrap');
    wrap.innerHTML = '<p style="color:var(--text-muted);">جاري التحميل...</p>';
    dbg('loadProperties start');
    try {
      const snap = await db.collection('properties').get();
      dbg('get() returned ' + snap.size + ' docs');
      allPropsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      allPropsCache.sort((a,b) => {
        const ta = a.created_at && a.created_at.toDate ? a.created_at.toDate().getTime() : 0;
        const tb = b.created_at && b.created_at.toDate ? b.created_at.toDate().getTime() : 0;
        return tb - ta;
      });
      renderPropertiesTable(wrap);
    } catch (e) {
      dbg('loadProperties error: ' + e.message);
      wrap.innerHTML = '<p class="form-status error">خطأ: ' + esc(e.message) + '</p>' +
        '<button class="btn btn-ghost btn-sm" onclick="location.reload()" style="margin-top:10px;">إعادة تحميل</button>';
      return;
    }
    if (propUnsub) propUnsub();
    propUnsub = db.collection('properties').onSnapshot((snap) => {
      allPropsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      allPropsCache.sort((a,b) => {
        const ta = a.created_at && a.created_at.toDate ? a.created_at.toDate().getTime() : 0;
        const tb = b.created_at && b.created_at.toDate ? b.created_at.toDate().getTime() : 0;
        return tb - ta;
      });
      renderPropertiesTable(wrap);
    }, (err) => {
      console.error('[admin] onSnapshot error', err);
    });
  }

  function resetPropertyForm() {
    const form = document.getElementById('propertyForm');
    form.reset();
    form.id.value = '';
    document.getElementById('propertyImagesPreview').innerHTML = '';
    document.getElementById('propertyFormCard').querySelector('input[name="images"]').value = '';
    document.getElementById('propertyFormTitle').textContent = 'عقار جديد';
    document.getElementById('propertyFormCard').style.display = 'none';
  }

  function editProperty(p) {
    const form = document.getElementById('propertyForm');
    form.id.value = p.id;
    form.name_ar.value = p.name_ar || '';
    form.name_en.value = p.name_en || '';
    form.type.value = p.type || 'residential';
    form.unit_type_ar.value = p.unit_type_ar || '';
    form.unit_type_en.value = p.unit_type_en || '';
    form.area_ar.value = p.area_ar || '';
    form.area_en.value = p.area_en || '';
    form.size.value = p.size || '';
    form.price.value = p.price != null ? p.price : '';
    form.rooms.value = p.rooms != null ? p.rooms : '';
    form.bathrooms.value = p.bathrooms != null ? p.bathrooms : '';
    form.status.value = p.status || 'draft';
    form.is_published.checked = !!p.is_published;
    form.is_featured.checked = !!p.is_featured;
    form.description_ar.value = p.description_ar || '';
    form.description_en.value = p.description_en || '';
    form.features_ar.value = Array.isArray(p.features_ar) ? p.features_ar.join('\n') : '';
    form.features_en.value = Array.isArray(p.features_en) ? p.features_en.join('\n') : '';
    const imgs = p.images || [];
    form.images.value = JSON.stringify(imgs);
    const prev = document.getElementById('propertyImagesPreview');
    prev.innerHTML = '';
    imgs.forEach((u) => { const img = document.createElement('img'); img.src = u; prev.appendChild(img); });
    document.getElementById('propertyFormTitle').textContent = 'تعديل عقار';
    document.getElementById('propertyFormCard').style.display = 'block';
    window.scrollTo({ top: document.getElementById('propertyFormCard').offsetTop - 80, behavior: 'smooth' });
    // setup image upload merge
    const input = document.getElementById('propertyImages');
    // remove old listener by cloning
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    previewImages(newInput, document.getElementById('propertyImagesPreview'), document.querySelector('#propertyForm input[name="images"]'), imgs);
  }

  document.getElementById('newPropertyBtn').addEventListener('click', () => {
    resetPropertyForm();
    document.getElementById('propertyFormCard').style.display = 'block';
    const input = document.getElementById('propertyImages');
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    previewImages(newInput, document.getElementById('propertyImagesPreview'), document.querySelector('#propertyForm input[name="images"]'), []);
  });
  document.getElementById('cancelPropertyBtn').addEventListener('click', resetPropertyForm);

  // initial previewImages binding (for new)
  previewImages(document.getElementById('propertyImages'), document.getElementById('propertyImagesPreview'), document.querySelector('#propertyForm input[name="images"]'), []);

  document.getElementById('propertyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const statusEl = document.getElementById('propertyStatus');
    let images = [];
    try { images = JSON.parse(form.images.value || '[]'); } catch (e) { images = []; }
    const payload = {
      name_ar: form.name_ar.value.trim(),
      name_en: form.name_en.value.trim(),
      type: form.type.value,
      unit_type_ar: form.unit_type_ar.value.trim(),
      unit_type_en: form.unit_type_en.value.trim(),
      area_ar: form.area_ar.value.trim(),
      area_en: form.area_en.value.trim(),
      size: parseFloat(form.size.value) || 0,
      price: form.price.value ? parseFloat(form.price.value) : null,
      rooms: form.rooms.value ? parseInt(form.rooms.value) : null,
      bathrooms: form.bathrooms.value ? parseInt(form.bathrooms.value) : null,
      status: form.status.value,
      is_published: form.is_published.checked,
      is_featured: form.is_featured.checked,
      description_ar: form.description_ar.value.trim(),
      description_en: form.description_en.value.trim(),
      features_ar: form.features_ar.value.split('\n').map((s) => s.trim()).filter(Boolean),
      features_en: form.features_en.value.split('\n').map((s) => s.trim()).filter(Boolean),
      images: images,
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
      if (form.id.value) {
        await db.collection('properties').doc(form.id.value).update(payload);
      } else {
        payload.created_at = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('properties').add(payload);
      }
      toast(statusEl, 'تم الحفظ بنجاح.', true);
      resetPropertyForm();
    } catch (err) {
      toast(statusEl, err.message, false);
    }
  });

  // ============ PROJECTS ============
  let projUnsub = null;
  let allProjectsCache = [];

  async function loadProjects() {
    const wrap = document.getElementById('projectsTableWrap');
    wrap.innerHTML = '<p style="color:var(--text-muted);">جاري التحميل...</p>';
    try {
      const snap = await db.collection('projects').get();
      allProjectsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      allProjectsCache.sort((a,b) => {
        const ta = a.created_at && a.created_at.toDate ? a.created_at.toDate().getTime() : 0;
        const tb = b.created_at && b.created_at.toDate ? b.created_at.toDate().getTime() : 0;
        return tb - ta;
      });
    } catch (e) {
      wrap.innerHTML = '<p class="form-status error">خطأ: ' + esc(e.message) + '</p>';
      return;
    }
    // render
    if (allProjectsCache.length === 0) { wrap.innerHTML = '<p style="color:var(--text-muted);">لا توجد مشروعات.</p>'; }
    else {
      let html = '<table class="admin-table"><thead><tr><th>الاسم</th><th>المنطقة</th><th>منشور</th><th>مميز</th><th>إجراءات</th></tr></thead><tbody>';
      allProjectsCache.forEach((p) => {
        html += `<tr>
          <td>${esc(p.name_ar)}</td>
          <td>${esc(p.area_ar || '')}</td>
          <td>${p.is_published ? '✓' : '—'}</td>
          <td>${p.is_featured ? '★' : '—'}</td>
          <td class="actions">
            <button class="btn btn-ghost btn-sm" data-edit-proj="${p.id}">تعديل</button>
            <button class="btn btn-ghost btn-sm" data-toggle-proj="${p.id}" data-published="${p.is_published}">${p.is_published ? 'إخفاء' : 'إظهار'}</button>
            <button class="btn btn-ghost btn-sm" data-delete-proj="${p.id}" style="color:var(--danger);">حذف</button>
          </td>
        </tr>`;
      });
      html += '</tbody></table>';
      wrap.innerHTML = html;
      wrap.querySelectorAll('[data-edit-proj]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const p = allProjectsCache.find((x) => x.id === btn.dataset.editProj);
          if (!p) return;
          const form = document.getElementById('projectForm');
          form.id.value = p.id;
          form.name_ar.value = p.name_ar || '';
          form.name_en.value = p.name_en || '';
          form.area_ar.value = p.area_ar || '';
          form.area_en.value = p.area_en || '';
          form.description_ar.value = p.description_ar || '';
          form.description_en.value = p.description_en || '';
          form.is_published.checked = !!p.is_published;
          form.is_featured.checked = !!p.is_featured;
          form.image.value = p.image || '';
          const prev = document.getElementById('projectImagePreview');
          prev.innerHTML = '';
          if (p.image) { const img = document.createElement('img'); img.src = p.image; prev.appendChild(img); }
          document.getElementById('projectFormCard').style.display = 'block';
        });
      });
      wrap.querySelectorAll('[data-toggle-proj]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.toggleProj;
          const cur = btn.dataset.published === 'true';
          await db.collection('projects').doc(id).update({ is_published: !cur, updated_at: firebase.firestore.FieldValue.serverTimestamp() });
        });
      });
      wrap.querySelectorAll('[data-delete-proj]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('حذف هذا المشروع؟')) return;
          await db.collection('projects').doc(btn.dataset.deleteProj).delete();
        });
      });
    }
    if (projUnsub) projUnsub();
    projUnsub = db.collection('projects').onSnapshot((snap) => {
      allProjectsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      allProjectsCache.sort((a,b) => {
        const ta = a.created_at && a.created_at.toDate ? a.created_at.toDate().getTime() : 0;
        const tb = b.created_at && b.created_at.toDate ? b.created_at.toDate().getTime() : 0;
        return tb - ta;
      });
      // re-render quickly
      loadProjects();
    }, (err) => { console.error('[admin] projects onSnapshot', err); });
  }
      if (allProjectsCache.length === 0) {
        wrap.innerHTML = '<p style="color:var(--text-muted);">لا توجد مشروعات.</p>';
        return;
      }
      let html = '<table class="admin-table"><thead><tr><th>الاسم</th><th>المنطقة</th><th>منشور</th><th>مميز</th><th>إجراءات</th></tr></thead><tbody>';
      allProjectsCache.forEach((p) => {
        html += `<tr>
          <td>${esc(p.name_ar)}</td>
          <td>${esc(p.area_ar || '')}</td>
          <td>${p.is_published ? '✓' : '—'}</td>
          <td>${p.is_featured ? '★' : '—'}</td>
          <td class="actions">
            <button class="btn btn-ghost btn-sm" data-edit-proj="${p.id}">تعديل</button>
            <button class="btn btn-ghost btn-sm" data-toggle-proj="${p.id}" data-published="${p.is_published}">${p.is_published ? 'إخفاء' : 'إظهار'}</button>
            <button class="btn btn-ghost btn-sm" data-delete-proj="${p.id}" style="color:var(--danger);">حذف</button>
          </td>
        </tr>`;
      });
      html += '</tbody></table>';
      wrap.innerHTML = html;

      wrap.querySelectorAll('[data-edit-proj]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const p = allProjectsCache.find((x) => x.id === btn.dataset.editProj);
          if (!p) return;
          const form = document.getElementById('projectForm');
          form.id.value = p.id;
          form.name_ar.value = p.name_ar || '';
          form.name_en.value = p.name_en || '';
          form.area_ar.value = p.area_ar || '';
          form.area_en.value = p.area_en || '';
          form.description_ar.value = p.description_ar || '';
          form.description_en.value = p.description_en || '';
          form.is_published.checked = !!p.is_published;
          form.is_featured.checked = !!p.is_featured;
          form.image.value = p.image || '';
          const prev = document.getElementById('projectImagePreview');
          prev.innerHTML = '';
          if (p.image) { const img = document.createElement('img'); img.src = p.image; prev.appendChild(img); }
          document.getElementById('projectFormCard').style.display = 'block';
        });
      });
      wrap.querySelectorAll('[data-toggle-proj]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.toggleProj;
          const cur = btn.dataset.published === 'true';
          await db.collection('projects').doc(id).update({ is_published: !cur, updated_at: firebase.firestore.FieldValue.serverTimestamp() });
        });
      });
      wrap.querySelectorAll('[data-delete-proj]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('حذف هذا المشروع؟')) return;
          await db.collection('projects').doc(btn.dataset.deleteProj).delete();
        });
      });

  document.getElementById('newProjectBtn').addEventListener('click', () => {
    document.getElementById('projectForm').reset();
    document.getElementById('projectForm').id.value = '';
    document.getElementById('projectImagePreview').innerHTML = '';
    document.getElementById('projectFormCard').style.display = 'block';
  });
  document.getElementById('cancelProjectBtn').addEventListener('click', () => {
    document.getElementById('projectFormCard').style.display = 'none';
  });

  document.getElementById('projectImage').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const url = await uploadImage(file);
      document.getElementById('projectImagePreview').innerHTML = `<img src="${url}" />`;
      document.querySelector('#projectForm input[name="image"]').value = url;
    } catch (err) {
      toast(document.getElementById('projectStatus'), err.message, false);
    }
  });

  document.getElementById('projectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const statusEl = document.getElementById('projectStatus');
    const payload = {
      name_ar: form.name_ar.value.trim(),
      name_en: form.name_en.value.trim(),
      area_ar: form.area_ar.value.trim(),
      area_en: form.area_en.value.trim(),
      description_ar: form.description_ar.value.trim(),
      description_en: form.description_en.value.trim(),
      image: form.image.value.trim() || null,
      is_published: form.is_published.checked,
      is_featured: form.is_featured.checked,
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
      if (form.id.value) {
        await db.collection('projects').doc(form.id.value).update(payload);
      } else {
        payload.created_at = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('projects').add(payload);
      }
      toast(statusEl, 'تم الحفظ.', true);
      document.getElementById('projectFormCard').style.display = 'none';
    } catch (err) {
      toast(statusEl, err.message, false);
    }
  });

  // ============ AREAS ============
  let areaUnsub = null;
  let allAreasCache = [];

  async function loadAreas() {
    const wrap = document.getElementById('areasTableWrap');
    wrap.innerHTML = '<p style="color:var(--text-muted);">جاري التحميل...</p>';
    if (areaUnsub) areaUnsub();
    areaUnsub = db.collection('areas').onSnapshot((snap) => {
      allAreasCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      allAreasCache.sort((a,b) => {
        const ta = a.created_at && a.created_at.toDate ? a.created_at.toDate().getTime() : 0;
        const tb = b.created_at && b.created_at.toDate ? b.created_at.toDate().getTime() : 0;
        return tb - ta;
      });
      if (allAreasCache.length === 0) {
        wrap.innerHTML = '<p style="color:var(--text-muted);">لا توجد مناطق.</p>';
        return;
      }
      let html = '<table class="admin-table"><thead><tr><th>AR</th><th>EN</th><th>Slug</th><th>إجراءات</th></tr></thead><tbody>';
      allAreasCache.forEach((a) => {
        html += `<tr>
          <td>${esc(a.name_ar)}</td>
          <td>${esc(a.name_en)}</td>
          <td>${esc(a.slug || '')}</td>
          <td class="actions">
            <button class="btn btn-ghost btn-sm" data-edit-area="${a.id}">تعديل</button>
            <button class="btn btn-ghost btn-sm" data-delete-area="${a.id}" style="color:var(--danger);">حذف</button>
          </td>
        </tr>`;
      });
      html += '</tbody></table>';
      wrap.innerHTML = html;

      wrap.querySelectorAll('[data-edit-area]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const a = allAreasCache.find((x) => x.id === btn.dataset.editArea);
          if (!a) return;
          const form = document.getElementById('areaForm');
          form.id.value = a.id;
          form.name_ar.value = a.name_ar || '';
          form.name_en.value = a.name_en || '';
          form.slug.value = a.slug || '';
          document.getElementById('areaFormCard').style.display = 'block';
        });
      });
      wrap.querySelectorAll('[data-delete-area]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('حذف هذه المنطقة؟')) return;
          await db.collection('areas').doc(btn.dataset.deleteArea).delete();
        });
      });
    }, (err) => {
      wrap.innerHTML = '<p class="form-status error">' + esc(err.message) + '</p>';
    });
  }

  document.getElementById('newAreaBtn').addEventListener('click', () => {
    document.getElementById('areaForm').reset();
    document.getElementById('areaForm').id.value = '';
    document.getElementById('areaFormCard').style.display = 'block';
  });
  document.getElementById('cancelAreaBtn').addEventListener('click', () => {
    document.getElementById('areaFormCard').style.display = 'none';
  });
  document.getElementById('areaForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const statusEl = document.getElementById('areaStatus');
    const payload = {
      name_ar: form.name_ar.value.trim(),
      name_en: form.name_en.value.trim(),
      slug: form.slug.value.trim() || null,
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
      if (form.id.value) {
        await db.collection('areas').doc(form.id.value).update(payload);
      } else {
        payload.created_at = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('areas').add(payload);
      }
      toast(statusEl, 'تم الحفظ.', true);
      document.getElementById('areaFormCard').style.display = 'none';
    } catch (err) {
      toast(statusEl, err.message, false);
    }
  });

  // ============ INQUIRIES ============
  let inqUnsub = null;

  async function loadInquiries() {
    const wrap = document.getElementById('inquiriesTableWrap');
    wrap.innerHTML = '<p style="color:var(--text-muted);">جاري التحميل...</p>';
    if (inqUnsub) inqUnsub();
    inqUnsub = db.collection('inquiries').onSnapshot((snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a,b) => {
        const ta = a.created_at && a.created_at.toDate ? a.created_at.toDate().getTime() : 0;
        const tb = b.created_at && b.created_at.toDate ? b.created_at.toDate().getTime() : 0;
        return tb - ta;
      });
      if (data.length === 0) {
        wrap.innerHTML = '<p style="color:var(--text-muted);">لا توجد طلبات.</p>';
        return;
      }
      let html = '<table class="admin-table"><thead><tr><th>الاسم</th><th>الهاتف</th><th>النوع</th><th>الرسالة</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th></tr></thead><tbody>';
      data.forEach((q) => {
        html += `<tr>
          <td>${esc(q.name || '')}</td>
          <td>${esc(q.phone || '')}</td>
          <td>${esc(q.type || '')}</td>
          <td style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(q.message || '')}</td>
          <td>
            <select data-inq-status="${q.id}">
              <option value="new" ${q.status==='new'?'selected':''}>جديد</option>
              <option value="contacted" ${q.status==='contacted'?'selected':''}>تم التواصل</option>
              <option value="closed" ${q.status==='closed'?'selected':''}>مغلق</option>
            </select>
          </td>
          <td>${tsToDate(q.created_at)}</td>
          <td class="actions">
            <button class="btn btn-ghost btn-sm" data-delete-inq="${q.id}" style="color:var(--danger);">حذف</button>
          </td>
        </tr>`;
      });
      html += '</tbody></table>';
      wrap.innerHTML = html;

      wrap.querySelectorAll('[data-inq-status]').forEach((sel) => {
        sel.addEventListener('change', async () => {
          await db.collection('inquiries').doc(sel.dataset.inqStatus).update({ status: sel.value });
        });
      });
      wrap.querySelectorAll('[data-delete-inq]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('حذف هذا الطلب؟')) return;
          await db.collection('inquiries').doc(btn.dataset.deleteInq).delete();
        });
      });
    }, (err) => {
      wrap.innerHTML = '<p class="form-status error">' + esc(err.message) + '</p>';
    });
  }

  async function loadSocial() {
    try {
      const snap = await db.collection('settings').doc('social').get();
      const d = snap.exists ? snap.data() : {};
      const form = document.getElementById('socialForm');
      if (!form) return;
      form.facebook.value = d.facebook || '';
      form.instagram.value = d.instagram || '';
      form.twitter.value = d.twitter || '';
      form.tiktok.value = d.tiktok || '';
    } catch (e) { console.error(e); }
  }

  document.getElementById('socialForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const statusEl = document.getElementById('socialStatus');
    const payload = {
      facebook: form.facebook.value.trim() || null,
      instagram: form.instagram.value.trim() || null,
      twitter: form.twitter.value.trim() || null,
      tiktok: form.tiktok.value.trim() || null,
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
      await db.collection('settings').doc('social').set(payload, { merge: true });
      toast(statusEl, 'تم حفظ الروابط.', true);
    } catch (err) {
      toast(statusEl, err.message, false);
    }
  });

  function loadTab(tab) {
    if (tab === 'properties') loadProperties();
    else if (tab === 'projects') loadProjects();
    else if (tab === 'areas') loadAreas();
    else if (tab === 'inquiries') loadInquiries();
    else if (tab === 'settings') loadSocial();
  }

  // ============ INIT ============
  // Safety timeout: if still loading after 8s, show diagnostic
  const loadTimeout = setTimeout(() => {
    const wrap = document.getElementById('propertiesTableWrap');
    if (wrap && wrap.textContent.indexOf('جاري التحميل') !== -1) {
      dbg('TIMEOUT: still loading after 8s');
      wrap.innerHTML = '<p class="form-status error">انتهت مهلة التحميل. تحقق من Console/Debug panel.</p>' +
        '<button class="btn btn-ghost btn-sm" onclick="location.reload()" style="margin-top:10px;">إعادة تحميل</button>';
    }
  }, 8000);

  guard().then((ok) => {
    clearTimeout(loadTimeout);
    dbg('guard result: ' + ok);
    if (ok) loadTab('properties');
    else dbg('guard failed -> redirected or error above');
  }).catch((e) => {
    clearTimeout(loadTimeout);
    dbg('guard threw: ' + (e && e.message ? e.message : e));
  });
})();