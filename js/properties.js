(function () {
  const AH = window.AH;
  const grid = document.getElementById('propertiesGrid');
  if (!grid) return;

  const db = AH.fb;
  let allProps = [];
  let unsub = null;

  const typeSel = document.getElementById('filterType');
  const unitSel = document.getElementById('filterUnit');
  const areaSel = document.getElementById('filterArea');
  const priceSel = document.getElementById('filterPrice');
  const sizeSel = document.getElementById('filterSize');
  const searchInput = document.getElementById('searchInput');

  function L() { return AH.getLang(); }

  function fillSelect(sel, options, allLabel) {
    if (!sel) return;
    sel.innerHTML = '';
    const all = document.createElement('option');
    all.value = '';
    all.textContent = allLabel;
    sel.appendChild(all);
    options.forEach((o) => {
      const opt = document.createElement('option');
      opt.value = o;
      opt.textContent = o;
      sel.appendChild(opt);
    });
  }

  function initFilters() {
    const lang = L();
    const allLabel = (AH.translations[lang] || {})['properties.all'] || 'All';
    const t = AH.translations[lang] || {};

    if (typeSel) {
      typeSel.innerHTML = '';
      ['', 'residential', 'commercial'].forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v === '' ? allLabel : (v === 'residential' ? (t['properties.residential'] || 'Residential') : (t['properties.commercial'] || 'Commercial'));
        typeSel.appendChild(opt);
      });
    }

    const unitTypes = [...new Set(allProps.map((p) => (lang === 'ar' ? p.unit_type_ar : p.unit_type_en)))];
    const areas = [...new Set(allProps.map((p) => (lang === 'ar' ? p.area_ar : p.area_en)))];
    fillSelect(unitSel, unitTypes.filter(Boolean), allLabel);
    fillSelect(areaSel, areas.filter(Boolean), allLabel);

    if (priceSel && priceSel.options.length === 0) {
      priceSel.innerHTML = '';
      const all = document.createElement('option'); all.value = ''; all.textContent = allLabel; priceSel.appendChild(all);
      const ranges = [
        { v: '0-2000000', ar: 'حتى 2,000,000', en: 'Up to 2,000,000' },
        { v: '2000000-4000000', ar: '2,000,000 - 4,000,000', en: '2,000,000 - 4,000,000' },
        { v: '4000000-999999999', ar: '4,000,000 فما فوق', en: '4,000,000+' }
      ];
      ranges.forEach((r) => {
        const opt = document.createElement('option');
        opt.value = r.v;
        opt.textContent = lang === 'ar' ? r.ar : r.en;
        priceSel.appendChild(opt);
      });
    }
    if (sizeSel && sizeSel.options.length === 0) {
      sizeSel.innerHTML = '';
      const all = document.createElement('option'); all.value = ''; all.textContent = allLabel; sizeSel.appendChild(all);
      const ranges = [
        { v: '0-150', ar: 'حتى 150 م²', en: 'Up to 150 m²' },
        { v: '150-300', ar: '150 - 300 م²', en: '150 - 300 m²' },
        { v: '300-999999', ar: '300 م² فما فوق', en: '300 m²+' }
      ];
      ranges.forEach((r) => {
        const opt = document.createElement('option');
        opt.value = r.v;
        opt.textContent = lang === 'ar' ? r.ar : r.en;
        sizeSel.appendChild(opt);
      });
    }
  }

  function statusClass(s) { if (s === 'sold') return 'sold'; if (s === 'reserved') return 'reserved'; return ''; }

  function render() {
    const lang = L();
    const t = AH.translations[lang] || {};
    const type = typeSel ? typeSel.value : '';
    const unit = unitSel ? unitSel.value : '';
    const area = areaSel ? areaSel.value : '';
    const price = priceSel ? priceSel.value : '';
    const size = sizeSel ? sizeSel.value : '';

    const q = (searchInput ? searchInput.value : '').trim().toLowerCase();
    let filtered = allProps.filter((p) => {
      if (type && p.type !== type) return false;
      const unitName = lang === 'ar' ? p.unit_type_ar : p.unit_type_en;
      const areaName = lang === 'ar' ? p.area_ar : p.area_en;
      if (unit && unitName !== unit) return false;
      if (area && areaName !== area) return false;
      if (price) {
        const [mn, mx] = price.split('-').map(Number);
        if ((p.price || 0) < mn || (p.price || 0) > mx) return false;
      }
      if (size) {
        const [mn, mx] = size.split('-').map(Number);
        if (p.size < mn || p.size > mx) return false;
      }
      if (q) {
        const hay = [p.name_ar, p.name_en, p.area_ar, p.area_en, p.unit_type_ar, p.unit_type_en, p.description_ar, p.description_en].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    grid.innerHTML = '';
    const countEl = document.getElementById('resultCount');
    if (countEl) countEl.textContent = filtered.length + ' ' + (t['properties.found'] || 'available');

    if (!AH.isConfigured) {
      grid.innerHTML = '<div class="empty-state"><div class="icon">⚙️</div><p>' +
        (lang === 'ar' ? 'لم يتم إعداد Firebase بعد. عدّل js/config.js.' : 'Firebase not configured. Please set up js/config.js.') +
        '</p></div>';
      return;
    }
    if (filtered.length === 0) {
      grid.innerHTML = '<div class="empty-state"><div class="icon">🏠</div><p>' + (lang === 'ar' ? 'لا توجد نتائج.' : 'No results.') + '</p></div>';
      return;
    }

    filtered.forEach((p) => {
      const card = document.createElement('article');
      card.className = 'property-card reveal';
      const img = (p.images && p.images[0]) ? p.images[0] : 'assets/img/prop1.svg';
      const unitName = lang === 'ar' ? p.unit_type_ar : p.unit_type_en;
      const areaName = lang === 'ar' ? p.area_ar : p.area_en;
      const name = lang === 'ar' ? p.name_ar : p.name_en;
      const priceStr = p.price != null ? Number(p.price).toLocaleString() + ' ' + (lang === 'ar' ? 'ج.م' : 'EGP') : '—';
      card.innerHTML = `
        <div class="property-img">
          <img src="${img}" alt="${name}" loading="lazy" />
          <span class="property-badge">${unitName || ''}</span>
          <span class="property-status ${statusClass(p.status)}">${AH.statusLabel(p.status, lang)}</span>
        </div>
        <div class="property-body">
          <div class="property-area">${areaName || ''}</div>
          <h3 class="property-title">${name}</h3>
          <div class="property-meta">
            <span>📐 ${p.size} m²</span>
            ${p.rooms ? `<span>🛏 ${p.rooms}</span>` : ''}
            ${p.bathrooms ? `<span>🛁 ${p.bathrooms}</span>` : ''}
            <span>🏷️ ${p.type === 'residential' ? (t['properties.residential'] || 'Residential') : (t['properties.commercial'] || 'Commercial')}</span>
          </div>
          <div class="property-price">${priceStr}</div>
          <div class="property-actions">
            <a class="btn btn-primary btn-sm" href="property.html?id=${p.id}">${lang === 'ar' ? 'التفاصيل' : 'Details'}</a>
            <button class="btn btn-whatsapp btn-sm" data-wa-property="${name}" data-prop-id="${p.id}">WhatsApp</button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });

    grid.querySelectorAll('[data-wa-property]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const pname = btn.getAttribute('data-wa-property');
        const pid = btn.getAttribute('data-prop-id');
        const prop = allProps.find((x) => x.id === pid);
        const l = L();
        let text = l === 'ar' ? 'مرحبًا ALPHA HOUSE،\nأرغب في طلب معاينة للعقار التالي:\n' : 'Hello ALPHA HOUSE,\nI would like to request a viewing for the following property:\n';
        if (prop) {
          text += (l==='ar'?'اسم العقار: ':'Property name: ') + (l==='ar'?prop.name_ar:prop.name_en) + '\n';
          text += (l==='ar'?'المنطقة: ':'Area: ') + (l==='ar'?prop.area_ar:prop.area_en) + '\n';
          text += (l==='ar'?'السعر: ':'Price: ') + (prop.price != null ? Number(prop.price).toLocaleString() + ' ' + (l==='ar'?'ج.م':'EGP') : '—') + '\n';
          text += (l==='ar'?'المساحة: ':'Size: ') + prop.size + ' m²\n';
        } else {
          text += pname + '\n';
        }
        text += (l==='ar'?'رابط العقار: ':'Property link: ') + window.location.origin + window.location.pathname.replace('properties.html','') + 'property.html?id=' + pid + '\n';
        text += l==='ar' ? '\nأرغب في تحديد موعد للمعاينة ومعرفة التفاصيل المتاحة.\nشكرًا لكم.' : '\nI would like to schedule a viewing and get available details.\nThank you.';
        window.open(AH.WA + "?text=" + encodeURIComponent(text), "_blank");
      });
    });

    grid.querySelectorAll('.reveal').forEach((el) => {
      if ('IntersectionObserver' in window) {
        const ro = new IntersectionObserver((entries) => {
          entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visible'); ro.unobserve(e.target); } });
        }, { threshold: 0.1 });
        ro.observe(el);
      } else el.classList.add('visible');
    });
  }

  function load() {
    if (!db) { allProps = []; initFilters(); render(); return; }
    if (unsub) unsub();
    unsub = db.collection('properties').where('is_published', '==', true).onSnapshot((snap) => {
      allProps = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      initFilters();
      render();
    }, (err) => { console.error(err); allProps = []; render(); });
  }

  load();

  [typeSel, unitSel, areaSel, priceSel, sizeSel].forEach((s) => { if (s) s.addEventListener('change', render); });
  const resetBtn = document.getElementById('resetFilters');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    [typeSel, unitSel, areaSel, priceSel, sizeSel].forEach((s) => { if (s) s.value = ''; });
    if (searchInput) searchInput.value = '';
    render();
  });
  if (searchInput) searchInput.addEventListener('input', render);

  const origSetLang = AH.setLang;
  AH.setLang = function (lang) {
    origSetLang(lang);
    initFilters();
    render();
  };
})();