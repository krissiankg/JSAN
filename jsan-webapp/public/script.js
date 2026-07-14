// ===== JSAN home slider — compatible React/Next =====
// Pas de clones dans le DOM (React les efface au re-render).
// Délégation d'événements + ré-init idempotente.

(function () {
  const AUTO_DELAY = 5000;
  const IDLE_RESTART = 15000;

  let currentSlide = 0;
  let isTransitioning = false;
  let slideInterval = null;
  let userIdleTimer = null;
  let listenersBound = false;

  function getWrapper() {
    return document.getElementById('slider-wrapper');
  }

  function getSlides() {
    const wrapper = getWrapper();
    if (!wrapper) return [];
    return Array.from(wrapper.querySelectorAll(':scope > section, :scope > footer'));
  }

  function pauseAutoSlide() {
    stopAutoSlide();
    clearTimeout(userIdleTimer);
    userIdleTimer = setTimeout(() => startAutoSlide(), IDLE_RESTART);
  }

  function stopAutoSlide() {
    clearInterval(slideInterval);
    slideInterval = null;
  }

  function startAutoSlide() {
    stopAutoSlide();
    const slides = getSlides();
    if (slides.length < 2) return;
    slideInterval = setInterval(() => {
      if (!isTransitioning) goToSlide(currentSlide + 1);
    }, AUTO_DELAY);
  }

  function updateNavActive(realIndex) {
    const slides = getSlides();
    document.querySelectorAll('.nav-links a').forEach((a) => a.classList.remove('active'));
    const currentId = slides[realIndex]?.getAttribute('id');
    if (!currentId) return;
    const activeLink = document.querySelector(`.nav-links a[href="#${currentId}"]`);
    if (activeLink) activeLink.classList.add('active');
  }

  function triggerAnimations(slide) {
    if (!slide) return;
    slide.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'));
    slide.querySelectorAll('.price-bar-inner').forEach((bar) => {
      if (!bar.dataset.animated) {
        const targetWidth = bar.style.width;
        bar.style.width = '0%';
        setTimeout(() => {
          bar.style.width = targetWidth;
          bar.dataset.animated = 'true';
        }, 200);
      }
    });
    slide.querySelectorAll('.expo-price, .sym-price').forEach((counter) => {
      if (counter.dataset.animated) return;
      const text = counter.textContent || '';
      const match = text.replace(/\s/g, '').match(/[\d]+/);
      if (!match) return;
      const target = parseInt(match[0], 10);
      if (!Number.isFinite(target)) return;
      counter.dataset.animated = 'true';
      let current = 0;
      const step = Math.max(1, Math.floor(target / 40));
      const timer = setInterval(() => {
        current = Math.min(target, current + step);
        counter.textContent = text.replace(/[\d\s]+/, current.toLocaleString('fr-FR'));
        if (current >= target) clearInterval(timer);
      }, 30);
    });
  }

  function goToSlide(index, opts = {}) {
    const wrapper = getWrapper();
    const slides = getSlides();
    if (!wrapper || !slides.length) return;

    const len = slides.length;
    let next = index;
    if (opts.wrap !== false) {
      if (next < 0) next = len - 1;
      if (next >= len) next = 0;
    } else {
      next = Math.max(0, Math.min(len - 1, next));
    }

    if (isTransitioning && !opts.force) return;
    currentSlide = next;
    isTransitioning = true;

    wrapper.style.transition = opts.instant
      ? 'none'
      : 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
    wrapper.style.transform = `translateX(-${currentSlide * 100}vw)`;

    updateNavActive(currentSlide);
    triggerAnimations(slides[currentSlide]);

    if (opts.instant) {
      // force reflow then restore transition
      void wrapper.offsetHeight;
      wrapper.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
      isTransitioning = false;
      return;
    }

    window.setTimeout(() => {
      isTransitioning = false;
    }, 650);
  }

  function closeMenu() {
    const navLinksContainer = document.getElementById('navLinks');
    const hamburger = document.getElementById('hamburger');
    if (!navLinksContainer) return;
    navLinksContainer.classList.remove('active');
    document.body.style.overflow = '';
    if (!hamburger) return;
    const spans = hamburger.querySelectorAll('span');
    if (spans[0]) spans[0].style.transform = 'none';
    if (spans[1]) spans[1].style.opacity = '1';
    if (spans[2]) spans[2].style.transform = 'none';
  }

  function openMenu() {
    const navLinksContainer = document.getElementById('navLinks');
    const hamburger = document.getElementById('hamburger');
    if (!navLinksContainer) return;
    navLinksContainer.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (!hamburger) return;
    const spans = hamburger.querySelectorAll('span');
    if (spans[0]) spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
    if (spans[1]) spans[1].style.opacity = '0';
    if (spans[2]) spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
  }

  function toggleAccordion(header) {
    const item = header.parentElement;
    const wasActive = item.classList.contains('active');
    const parent = item.parentElement;
    parent.querySelectorAll('.accordion-item').forEach((ai) => {
      ai.classList.remove('active');
      const chevron = ai.querySelector('.chevron');
      if (chevron) chevron.textContent = '▼';
    });
    if (!wasActive) {
      item.classList.add('active');
      const chevron = item.querySelector('.chevron');
      if (chevron) chevron.textContent = '▲';
    }
  }

  function switchTab(btn) {
    const tabId = btn.getAttribute('data-tab');
    const wrapper = btn.closest('.tabs-wrapper') || document;
    wrapper.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    wrapper.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
    const activePane = wrapper.querySelector(`#${tabId}`) || document.getElementById(tabId);
    if (activePane) activePane.classList.add('active');
  }

  function toggleFaq(question) {
    const item = question.parentElement;
    const wasActive = item.classList.contains('active');
    document.querySelectorAll('.faq-item').forEach((fi) => {
      fi.classList.remove('active');
      const chevron = fi.querySelector('.faq-chevron');
      if (chevron) chevron.textContent = '▼';
    });
    if (!wasActive) {
      item.classList.add('active');
      const chevron = item.querySelector('.faq-chevron');
      if (chevron) chevron.textContent = '▲';
    }
  }

  function handleContact(e) {
    e.preventDefault();
  }

  function updatePrice() {
    /* legacy no-op kept for compatibility */
  }

  function bindListenersOnce() {
    if (listenersBound) return;
    listenersBound = true;

    document.addEventListener('click', (e) => {
      const prev = e.target.closest('#prevSlide');
      const next = e.target.closest('#nextSlide');
      if (prev) {
        e.preventDefault();
        if (!isTransitioning) {
          pauseAutoSlide();
          goToSlide(currentSlide - 1);
        }
        return;
      }
      if (next) {
        e.preventDefault();
        if (!isTransitioning) {
          pauseAutoSlide();
          goToSlide(currentSlide + 1);
        }
        return;
      }

      const hamburger = e.target.closest('#hamburger');
      if (hamburger) {
        const navLinksContainer = document.getElementById('navLinks');
        if (!navLinksContainer) return;
        if (navLinksContainer.classList.contains('active')) closeMenu();
        else openMenu();
        return;
      }

      const hashLink = e.target.closest('.nav-links a[href^="#"], .bottom-contact-link[href^="#"], a.navbar-brand[href="#"]');
      if (hashLink) {
        const href = hashLink.getAttribute('href') || '';
        if (!href.startsWith('#')) return;
        e.preventDefault();
        pauseAutoSlide();
        closeMenu();

        if (href === '#') {
          goToSlide(0);
          return;
        }

        const targetId = href.slice(1);
        const slides = getSlides();
        let targetIndex = slides.findIndex((s) => s.id === targetId);
        if (targetIndex === -1 && targetId === 'contact') {
          targetIndex = slides.findIndex((s) => s.id === 'faq' || s.id === 'contact');
          if (targetIndex === -1) targetIndex = slides.length - 1;
        }
        if (targetIndex !== -1) goToSlide(targetIndex);
        return;
      }

      const navBackdrop = e.target;
      if (navBackdrop && navBackdrop.id === 'navLinks') closeMenu();
    });

    document.addEventListener(
      'click',
      (e) => {
        const wrapper = getWrapper();
        if (wrapper && wrapper.contains(e.target)) pauseAutoSlide();
      },
      { passive: true }
    );

    document.addEventListener('focusin', (e) => {
      if (e.target.matches('input, select, textarea, button')) pauseAutoSlide();
    });

    window.addEventListener('keydown', (e) => {
      if (!getWrapper()) return;
      if (isTransitioning) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        pauseAutoSlide();
        goToSlide(currentSlide + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        pauseAutoSlide();
        goToSlide(currentSlide - 1);
      }
    });

    let touchStartX = 0;
    let touchEndX = 0;
    window.addEventListener(
      'touchstart',
      (e) => {
        touchStartX = e.changedTouches[0].screenX;
      },
      { passive: true }
    );
    window.addEventListener(
      'touchend',
      (e) => {
        touchEndX = e.changedTouches[0].screenX;
        if (isTransitioning || !getWrapper()) return;
        const threshold = 50;
        if (touchStartX - touchEndX > threshold) {
          pauseAutoSlide();
          goToSlide(currentSlide + 1);
        }
        if (touchEndX - touchStartX > threshold) {
          pauseAutoSlide();
          goToSlide(currentSlide - 1);
        }
      },
      { passive: true }
    );
  }

  function initJsanHomeSlider(opts = {}) {
    const wrapper = getWrapper();
    const slides = getSlides();
    if (!wrapper || !slides.length) return;

    bindListenersOnce();

    // Keep current index if still valid after React re-render
    if (currentSlide >= slides.length) currentSlide = 0;
    const keepIndex = opts.reset ? 0 : currentSlide;
    goToSlide(keepIndex, { instant: true, force: true, wrap: false });
    startAutoSlide();
  }

  window.toggleAccordion = toggleAccordion;
  window.switchTab = switchTab;
  window.toggleFaq = toggleFaq;
  window.goToSlide = function (index) {
    pauseAutoSlide();
    goToSlide(typeof index === 'number' ? index : 0);
  };
  window.handleContact = handleContact;
  window.updatePrice = updatePrice;
  window.initJsanHomeSlider = initJsanHomeSlider;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initJsanHomeSlider({ reset: true }));
  } else {
    initJsanHomeSlider({ reset: true });
  }
})();
