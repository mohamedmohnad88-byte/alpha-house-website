(function () {
  const AH = window.AH;
  if (!document.getElementById('galleryMain')) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  let p = null;
  const db = AH.fb;

  function L() { return AH.getLang(); }

  async function load() {
    if (db && id) {
      try {
        const snap = await db.collection('properties').doc(id).get();
        if (snap.exists) {
          const data = snap.data();
          if (data.is_published === true) p = { id: snap.id, ...data };
        }
      } catch (e) { console.error(e); }
    }
    if (!p) {
      const title = document.getElementById('propTitle');
      if (title) title.textContent = L() === 'ar' ? 'العقار غير موجود' : 'Property not found';
      return;
    }
    render();
  }

  function render() {
    if (!p) return;
    const lang = L();
    const t = AH.translations[lang] || {};
    const bc = document.getElementById('breadcrumbName');
    if (bc) bc.textContent = lang === 'ar' ? p.name_ar : p.name_en;

    const title = document.getElementById('propTitle');
    if (title) title.textContent = lang === 'ar' ? p.name_ar : p.name_en;
    const area = document.getElementById('propArea');
    if (area) area.textContent = lang === 'ar' ? p.area_ar : p.area_en;

    const gallery = p.images && p.images.length ? p.images : ['assets/img/prop1.svg'];
    const mainImg = document.getElementById('galleryMain');
    if (mainImg) mainImg.src = gallery[0];
    const thumbs = document.getElementById('galleryThumbs');
    if (thumbs) {
      thumbs.innerHTML = '';
      gallery.forEach((src, i) => {
        const div = document.createElement('div');
        div.className = 'gallery-thumb' + (i === 0 ? ' active' : '');
        div.innerHTML = `<img src="${src}" alt="" loading="lazy" />`;
        div.addEventListener('click', () => {
          if (mainImg) mainImg.src = src;
          thumbs.querySelectorAll('.gallery-thumb').forEach((x) => x.classList.remove('active'));
          div.classList.add('active');
        });
        thumbs.appendChild(div);
      });
    }

    const price = document.getElementById('propPrice');
    if (price) price.textContent = p.price != null ? Number(p.price).toLocaleString() + ' ' + (lang === 'ar' ? 'ج.م' : 'EGP') : '—';

    const status = document.getElementById('propStatus');
    if (status) { status.textContent = AH.statusLabel(p.status, lang); status.className = 'property-status ' + (p.status === 'sold' ? 'sold' : p.status === 'reserved' ? 'reserved' : ''); }

    const specs = document.getElementById('propSpecs');
    if (specs) {
      specs.innerHTML = `
        <div class="spec"><div class="lbl">${t['detail.type'] || 'Type'}</div><div class="val">${lang === 'ar' ? p.unit_type_ar : p.unit_type_en}</div></div>
        <div class="spec"><div class="lbl">${t['detail.area'] || 'Area'}</div><div class="val">${lang === 'ar' ? p.area_ar : p.area_en}</div></div>
        <div class="spec"><div class="lbl">${t['detail.size'] || 'Size'}</div><div class="val">${p.size} m²</div></div>
        <div class="spec"><div class="lbl">${t['detail.status'] || 'Status'}</div><div class="val">${AH.statusLabel(p.status, lang)}</div></div>
      `;
    }
    const desc = document.getElementById('propDesc');
    if (desc) desc.textContent = lang === 'ar' ? p.description_ar : p.description_en;
    const feats = document.getElementById('propFeatures');
    if (feats) {
      const f = lang === 'ar' ? p.features_ar : p.features_en;
      feats.innerHTML = (Array.isArray(f) ? f : []).map((x) => `<li>${x}</li>`).join('');
    }

    const pname = lang === 'ar' ? p.name_ar : p.name_en;
    const waBtn = document.getElementById('waInquiryBtn');
    if (waBtn) {
      waBtn.onclick = () => {
        const text = lang === 'ar' ? "مرحبًا مستر محمد، أود الاستفسار عن: " + pname : "Hello Mr. Mohamed, I would like to inquire about: " + pname;
        window.open(AH.WA + "?text=" + encodeURIComponent(text), "_blank");
      };
    }
    const callBtn = document.getElementById('callBtn');
    if (callBtn) callBtn.onclick = () => { window.location.href = "tel:" + AH.PHONE_INTL; };

    const propField = document.getElementById('interestProperty');
    if (propField) propField.value = pname;
    const viewingProp = document.getElementById('viewingProperty');
    if (viewingProp) viewingProp.value = pname;
  }

  load();

  const viewingForm = document.getElementById('viewingForm');
  if (viewingForm) {
    viewingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(viewingForm);
      const lang = L();
      let text = lang === 'ar' ? "مرحبًا مستر محمد، أود طلب معاينة.\n" : "Hello Mr. Mohamed, I would like to request a viewing.\n";
      text += (lang === 'ar' ? "الاسم: " : "Name: ") + (data.get('name') || '') + "\n";
      text += (lang === 'ar' ? "الهاتف: " : "Phone: ") + (data.get('phone') || '') + "\n";
      text += (lang === 'ar' ? "العقار: " : "Property: ") + (data.get('property') || '') + "\n";
      if (data.get('date')) text += (lang === 'ar' ? "التاريخ المفضل: " : "Preferred date: ") + data.get('date') + "\n";
      window.open(AH.WA + "?text=" + encodeURIComponent(text), "_blank");
      if (AH.fb) {
        AH.fb.collection('inquiries').add({
          name: data.get('name') || null,
          phone: data.get('phone') || null,
          property_id: id,
          type: 'viewing',
          message: data.get('date') ? 'Preferred date: ' + data.get('date') : null,
          status: 'new',
          created_at: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
      }
    });
  }

  const origSetLang = AH.setLang;
  AH.setLang = function (lang) {
    origSetLang(lang);
    render();
  };
})();