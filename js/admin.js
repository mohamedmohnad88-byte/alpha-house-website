(function () {
  const AH = window.AH;
  const sb = AH.sb;

  // ============ AUTH GUARD ============
  async function guard() {
    if (!sb) {
      window.location.href = 'login.html';
      return false;
    }
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return false;
    }
    const { data: prof } = await sb.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
    if (!prof || prof.role !== 'admin') {
      await sb.auth.signOut();
      window.location.href = 'login.html';
      return false;
    }
    document.getElementById('adminEmail').textContent = session.user.email;
    return true;
  }

  // ============ HELPERS ============
  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function toast(el, msg, ok) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'form-status ' + (ok ? 'success' : 'error');
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
    await sb.auth.signOut();
    window.location.href = 'login.html';
  });

  // ============ IMAGE UPLOAD ============
  async function uploadImage(file) {
    const ext = file.name.split('.').pop();
    const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await sb.storage.from('property-images').upload(path, file);
    if (error) throw error;
    const { data } = sb.storage.from('property-images').getPublicUrl(path);
    return data.publicUrl;
  }

  function previewImages(input, previewEl, hiddenInput) {
    input.addEventListener('change', async () => {
      const files = Array.from(input.files || []);
      previewEl.innerHTML = '';
      const urls = [];
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
  let editingPropertyId = null;

  async function loadProperties() {
    const wrap = document.getElementById('propertiesTableWrap');
    wrap.innerHTML = '<p style="color:var(--text-muted);">جاري التحميل...</p>';
    const { data, error } = await sb.from('properties').select('*').order('created_at', { ascending: false });
    if (error) { wrap.innerHTML = '<p class="form-status error">' + esc(error.message) + '</p>'; return; }
    if (!data || data.length === 0) { wrap.innerHTML = '<p style="color:var(--text-muted);">لا توجد عقارات.</p>'; return; }
    let html = '<table class="admin-table"><thead><tr><th>الاسم</th><th>النوع</th><th>المساحة</th><th>السعر</th><th>الحالة</th><th>منشور</th><th>مميز</th><th>إجراءات</th></tr></thead><tbody>';
    data.forEach((p) => {
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

    // attach handlers
    wrap.querySelectorAll('[data-edit-prop]').forEach((btn) => {
      btn.addEventListener('click', () => editProperty(btn.dataset.editProp, data));
    });
    wrap.querySelectorAll('[data-toggle-prop]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.toggleProp;
        const cur = btn.dataset.published === 'true';
        await sb.from('properties').update({ is_published: !cur }).eq('id', id);
        loadProperties();
      });
    });
    wrap.querySelectorAll('[data-feature-prop]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.featureProp;
        const cur = btn.dataset.featured === 'true';
        await sb.from('properties').update({ is_featured: !cur }).eq('id', id);
        loadProperties();
      });
    });
    wrap.querySelectorAll('[data-delete-prop]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('حذف هذا العقار؟')) return;
        await sb.from('properties').delete().eq('id', btn.dataset.deleteProp);
        loadProperties();
      });
    });
  }

  function resetPropertyForm() {
    const form = document.getElementById('propertyForm');
    form.reset();
    form.id.value = '';
    document.getElementById('propertyImagesPreview').innerHTML = '';
    document.getElementById('propertyFormCard').querySelector('input[name="images"]').value = '';
    editingPropertyId = null;
    document.getElementById('propertyFormTitle').textContent = 'عقار جديد';
    document.getElementById('propertyFormCard').style.display = 'none';
  }

  function editProperty(id, list) {
    const p = list.find((x) => x.id === id);
    if (!p) return;
    editingPropertyId = id;
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
    form.status.value = p.status || 'draft';
    form.is_published.checked = !!p.is_published;
    form.is_featured.checked = !!p.is_featured;
    form.description_ar.value = p.description_ar || '';
    form.description_en.value = p.description_en || '';
    form.features_ar.value = Array.isArray(p.features_ar) ? p.features_ar.join('\n') : '';
    form.features_en.value = Array.isArray(p.features_en) ? p.features_en.join('\n') : '';
    form.images.value = JSON.stringify(p.images || []);
    // preview existing images
    const prev = document.getElementById('propertyImagesPreview');
    prev.innerHTML = '';
    (p.images || []).forEach((u) => { const img = document.createElement('img'); img.src = u; prev.appendChild(img); });
    document.getElementById('propertyFormTitle').textContent = 'تعديل عقار';
    document.getElementById('propertyFormCard').style.display = 'block';
    window.scrollTo({ top: document.getElementById('propertyFormCard').offsetTop - 80, behavior: 'smooth' });
  }

  document.getElementById('newPropertyBtn').addEventListener('click', () => {
    resetPropertyForm();
    document.getElementById('propertyFormCard').style.display = 'block';
  });
  document.getElementById('cancelPropertyBtn').addEventListener('click', resetPropertyForm);

  previewImages(
    document.getElementById('propertyImages'),
    document.getElementById('propertyImagesPreview'),
    document.querySelector('#propertyForm input[name="images"]')
  );

  document.getElementById('propertyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const statusEl = document.getElementById('propertyStatus');
    let images = [];
    try { images = JSON.parse(form.images.value || '[]'); } catch (e) { images = []; }
    // if new images uploaded, input hidden replaced; but if editing and no new upload, keep existing from preview? We stored existing in images hidden already.
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
      status: form.status.value,
      is_published: form.is_published.checked,
      is_featured: form.is_featured.checked,
      description_ar: form.description_ar.value.trim(),
      description_en: form.description_en.value.trim(),
      features_ar: form.features_ar.value.split('\n').map((s) => s.trim()).filter(Boolean),
      features_en: form.features_en.value.split('\n').map((s) => s.trim()).filter(Boolean),
      images: images
    };
    let res;
    if (form.id.value) {
      res = await sb.from('properties').update(payload).eq('id', form.id.value);
    } else {
      res = await sb.from('properties').insert([payload]);
    }
    if (res.error) {
      toast(statusEl, res.error.message, false);
    } else {
      toast(statusEl, 'تم الحفظ بنجاح.', true);
      resetPropertyForm();
      loadProperties();
    }
  });

  // ============ PROJECTS ============
  async function loadProjects() {
    const wrap = document.getElementById('projectsTableWrap');
    wrap.innerHTML = '<p style="color:var(--text-muted);">جاري التحميل...</p>';
    const { data, error } = await sb.from('projects').select('*').order('created_at', { ascending: false });
    if (error) { wrap.innerHTML = '<p class="form-status error">' + esc(error.message) + '</p>'; return; }
    if (!data || data.length === 0) { wrap.innerHTML = '<p style="color:var(--text-muted);">لا توجد مشروعات.</p>'; return; }
    let html = '<table class="admin-table"><thead><tr><th>الاسم</th><th>المنطقة</th><th>منشور</th><th>مميز</th><th>إجراءات</th></tr></thead><tbody>';
    data.forEach((p) => {
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
        const p = data.find((x) => x.id === btn.dataset.editProj);
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
        await sb.from('projects').update({ is_published: !cur }).eq('id', id);
        loadProjects();
      });
    });
    wrap.querySelectorAll('[data-delete-proj]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('حذف هذا المشروع؟')) return;
        await sb.from('projects').delete().eq('id', btn.dataset.deleteProj);
        loadProjects();
      });
    });
  }

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
      is_featured: form.is_featured.checked
    };
    let res;
    if (form.id.value) res = await sb.from('projects').update(payload).eq('id', form.id.value);
    else res = await sb.from('projects').insert([payload]);
    if (res.error) toast(statusEl, res.error.message, false);
    else { toast(statusEl, 'تم الحفظ.', true); document.getElementById('projectFormCard').style.display = 'none'; loadProjects(); }
  });

  // ============ AREAS ============
  async function loadAreas() {
    const wrap = document.getElementById('areasTableWrap');
    wrap.innerHTML = '<p style="color:var(--text-muted);">جاري التحميل...</p>';
    const { data, error } = await sb.from('areas').select('*').order('created_at', { ascending: false });
    if (error) { wrap.innerHTML = '<p class="form-status error">' + esc(error.message) + '</p>'; return; }
    if (!data || data.length === 0) { wrap.innerHTML = '<p style="color:var(--text-muted);">لا توجد مناطق.</p>'; return; }
    let html = '<table class="admin-table"><thead><tr><th>AR</th><th>EN</th><th>Slug</th><th>إجراءات</th></tr></thead><tbody>';
    data.forEach((a) => {
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
        const a = data.find((x) => x.id === btn.dataset.editArea);
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
        await sb.from('areas').delete().eq('id', btn.dataset.deleteArea);
        loadAreas();
      });
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
      slug: form.slug.value.trim() || null
    };
    let res;
    if (form.id.value) res = await sb.from('areas').update(payload).eq('id', form.id.value);
    else res = await sb.from('areas').insert([payload]);
    if (res.error) toast(statusEl, res.error.message, false);
    else { toast(statusEl, 'تم الحفظ.', true); document.getElementById('areaFormCard').style.display = 'none'; loadAreas(); }
  });

  // ============ INQUIRIES ============
  async function loadInquiries() {
    const wrap = document.getElementById('inquiriesTableWrap');
    wrap.innerHTML = '<p style="color:var(--text-muted);">جاري التحميل...</p>';
    const { data, error } = await sb.from('inquiries').select('*').order('created_at', { ascending: false });
    if (error) { wrap.innerHTML = '<p class="form-status error">' + esc(error.message) + '</p>'; return; }
    if (!data || data.length === 0) { wrap.innerHTML = '<p style="color:var(--text-muted);">لا توجد طلبات.</p>'; return; }
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
        <td>${new Date(q.created_at).toLocaleDateString()}</td>
        <td class="actions">
          <button class="btn btn-ghost btn-sm" data-delete-inq="${q.id}" style="color:var(--danger);">حذف</button>
        </td>
      </tr>`;
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;

    wrap.querySelectorAll('[data-inq-status]').forEach((sel) => {
      sel.addEventListener('change', async () => {
        await sb.from('inquiries').update({ status: sel.value }).eq('id', sel.dataset.inqStatus);
      });
    });
    wrap.querySelectorAll('[data-delete-inq]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('حذف هذا الطلب؟')) return;
        await sb.from('inquiries').delete().eq('id', btn.dataset.deleteInq);
        loadInquiries();
      });
    });
  }

  function loadTab(tab) {
    if (tab === 'properties') loadProperties();
    else if (tab === 'projects') loadProjects();
    else if (tab === 'areas') loadAreas();
    else if (tab === 'inquiries') loadInquiries();
  }

  // ============ INIT ============
  guard().then((ok) => {
    if (ok) loadTab('properties');
  });
})();