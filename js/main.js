(function () {
  'use strict';
  const AH = window.AH;

  // ============ NAVBAR SCROLL ============
  const navbar = document.getElementById('navbar');
  function onScroll() {
    if (!navbar) return;
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ============ MOBILE MENU ============
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('open');
      navLinks.classList.toggle('open');
    });
    navLinks.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => {
        hamburger.classList.remove('open');
        navLinks.classList.remove('open');
      });
    });
  }

  // ============ LANG TOGGLE ============
  const langToggle = document.getElementById('langToggle');
  if (langToggle) {
    langToggle.addEventListener('click', () => {
      const cur = AH.getLang();
      AH.setLang(cur === 'ar' ? 'en' : 'ar');
    });
  }

  // ============ REVEAL ============
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const ro = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          ro.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    reveals.forEach((el) => ro.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('visible'));
  }

  // ============ COUNTERS ============
  const counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window) {
    const co = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const el = e.target;
          const target = parseFloat(el.dataset.count);
          const isFloat = target % 1 !== 0;
          const dur = 1500;
          const start = performance.now();
          function tick(now) {
            const t = Math.min((now - start) / dur, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            const val = target * eased;
            el.textContent = isFloat ? val.toFixed(1) : Math.floor(val).toLocaleString();
            if (t < 1) requestAnimationFrame(tick);
            else el.textContent = isFloat ? target.toFixed(1) : target.toLocaleString();
          }
          requestAnimationFrame(tick);
          co.unobserve(el);
        }
      });
    }, { threshold: 0.4 });
    counters.forEach((c) => co.observe(c));
  }

  // ============ FORMS -> WhatsApp ============
  function buildWaMessage(text) {
    return AH.WA + "?text=" + encodeURIComponent(text);
  }

  document.querySelectorAll('form[data-wa]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const name = (data.get('name') || '').toString().trim();
      const phone = (data.get('phone') || '').toString().trim();
      const email = (data.get('email') || '').toString().trim();
      const message = (data.get('message') || '').toString().trim();
      const property = (data.get('property') || '').toString().trim();
      const lang = AH.getLang();
      let text = lang === 'ar'
        ? "مرحبًا مستر محمد،\n"
        : "Hello Mr. Mohamed,\n";
      if (name) text += (lang === 'ar' ? "الاسم: " : "Name: ") + name + "\n";
      if (phone) text += (lang === 'ar' ? "الهاتف: " : "Phone: ") + phone + "\n";
      if (email) text += (lang === 'ar' ? "البريد: " : "Email: ") + email + "\n";
      if (property) text += (lang === 'ar' ? "العقار المطلوب: " : "Property of interest: ") + property + "\n";
      if (message) text += (lang === 'ar' ? "الرسالة: " : "Message: ") + message + "\n";
      const status = form.querySelector('.form-status');
      if (status) {
        status.textContent = lang === 'ar' ? "جاري فتح WhatsApp..." : "Opening WhatsApp...";
        status.className = "form-status success";
      }
      // Save inquiry to Firestore (if configured)
      if (window.AH.fb) {
        window.AH.fb.collection('inquiries').add({
          name: name || null,
          phone: phone || null,
          email: email || null,
          message: message || null,
          property_id: null,
          type: form.getAttribute('data-inquiry-type') || 'general',
          status: 'new',
          created_at: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
      }
      window.open(buildWaMessage(text), "_blank");
    });
  });

  // ============ DIRECT CALL BUTTONS ============
  document.querySelectorAll('[data-call]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = "tel:" + AH.PHONE_INTL;
    });
  });

  // ============ WA INQUIRY BUTTONS WITH PROPERTY NAME ============
  document.querySelectorAll('[data-wa-property]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const pname = btn.getAttribute('data-wa-property');
      const lang = AH.getLang();
      const text = lang === 'ar'
        ? "مرحبًا مستر محمد، أود الاستفسار عن: " + pname
        : "Hello Mr. Mohamed, I would like to inquire about: " + pname;
      window.open(buildWaMessage(text), "_blank");
    });
  });

  // ============ ACTIVE NAV ============
  const sections = document.querySelectorAll('section[id]');
  const navItems = document.querySelectorAll('.nav-link');
  if ('IntersectionObserver' in window && sections.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navItems.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === '#' + id));
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach((s) => io.observe(s));
  }
  // ============ CAREERS WA BUTTON ============
  const careersBtn = document.getElementById('careersWaBtn');
  if (careersBtn) {
    careersBtn.addEventListener('click', () => {
      const text = 'مرحبًا ALPHA HOUSE،\nأنا أبحث عن وظيفة في قسم المبيعات (Sales).\n\nالاسم: \nرقم الهاتف: \nالخبرة: \n\nأرغب في الانضمام إلى فريقكم. شكرًا.';
      window.open(AH.WA + '?text=' + encodeURIComponent(text), '_blank');
    });
  }
})();