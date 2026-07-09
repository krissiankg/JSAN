// ===== SLIDESHOW LOGIC =====
const sliderWrapper = document.getElementById('slider-wrapper');
const originalSlides = Array.from(document.querySelectorAll('#slider-wrapper > section, #slider-wrapper > footer'));
const totalOriginalSlides = originalSlides.length;
const navLinks = document.querySelectorAll('.nav-links a');

// Clone first and last slides for infinite loop
const firstClone = originalSlides[0].cloneNode(true);
const lastClone = originalSlides[totalOriginalSlides - 1].cloneNode(true);

firstClone.id = 'first-clone';
lastClone.id = 'last-clone';

sliderWrapper.appendChild(firstClone);
sliderWrapper.insertBefore(lastClone, originalSlides[0]);

const allSlides = document.querySelectorAll('#slider-wrapper > section, #slider-wrapper > footer');
const totalSlides = allSlides.length;

let currentSlide = 1; // Start at the first real slide
let isTransitioning = false;

// Initial transform to hide the clone
sliderWrapper.style.transition = 'none';
sliderWrapper.style.transform = `translateX(-100vw)`;
// Force layout
sliderWrapper.offsetHeight;
sliderWrapper.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';

let slideInterval;
let userIdleTimer;
const autoSlideDelay = 5000;       // 5s between auto-slides
const userIdleRestart = 15000;     // 15s of inactivity before auto-slide resumes

function startAutoSlide() {
  clearInterval(slideInterval);
  slideInterval = setInterval(() => {
    if (!isTransitioning) goToSlide(currentSlide + 1);
  }, autoSlideDelay);
}

function stopAutoSlide() {
  clearInterval(slideInterval);
  slideInterval = null;
}

// Pause auto-slide and restart only after user is idle for 15s
function pauseAutoSlide() {
  stopAutoSlide();
  clearTimeout(userIdleTimer);
  userIdleTimer = setTimeout(() => {
    startAutoSlide();
  }, userIdleRestart);
}

// Listen for user interactions inside slide content to pause auto-slide
['click', 'touchstart', 'pointerdown'].forEach(evt => {
  sliderWrapper.addEventListener(evt, () => {
    pauseAutoSlide();
  }, { passive: true });
});

// Also pause when user scrolls inside any section (vertical scroll)
sliderWrapper.addEventListener('scroll', () => {
  pauseAutoSlide();
}, { passive: true });

// Pause when user focuses on any form input (e.g. ticket selection)
document.addEventListener('focusin', (e) => {
  if (e.target.matches('input, select, textarea, button')) {
    pauseAutoSlide();
  }
});

function goToSlide(index) {
  if (isTransitioning) return;
  currentSlide = index;
  
  sliderWrapper.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
  sliderWrapper.style.transform = `translateX(-${currentSlide * 100}vw)`;
  isTransitioning = true;
  
  // Real index for navigation
  let realIndex;
  if (currentSlide === 0) {
    realIndex = totalOriginalSlides - 1;
  } else if (currentSlide === totalSlides - 1) {
    realIndex = 0;
  } else {
    realIndex = currentSlide - 1;
  }

  // Update Nav Links
  navLinks.forEach(a => a.classList.remove('active'));
  const currentId = originalSlides[realIndex].getAttribute('id');
  if (currentId) {
    const activeLink = document.querySelector(`.nav-links a[href="#${currentId}"]`);
    if (activeLink) activeLink.classList.add('active');
  }

  // Trigger animations
  triggerAnimations(allSlides[currentSlide]);
}

sliderWrapper.addEventListener('transitionend', () => {
  isTransitioning = false;
  if (currentSlide === 0) {
    sliderWrapper.style.transition = 'none';
    currentSlide = totalSlides - 2;
    sliderWrapper.style.transform = `translateX(-${currentSlide * 100}vw)`;
  } else if (currentSlide === totalSlides - 1) {
    sliderWrapper.style.transition = 'none';
    currentSlide = 1;
    sliderWrapper.style.transform = `translateX(-${currentSlide * 100}vw)`;
  }
});

// UI Arrow Click Events
const prevBtn = document.getElementById('prevSlide');
const nextBtn = document.getElementById('nextSlide');
if (prevBtn) prevBtn.addEventListener('click', () => {
  if (!isTransitioning) { pauseAutoSlide(); goToSlide(currentSlide - 1); }
});
if (nextBtn) nextBtn.addEventListener('click', () => {
  if (!isTransitioning) { pauseAutoSlide(); goToSlide(currentSlide + 1); }
});

// Nav link click events
navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href');
    if(href && href.startsWith('#')) {
      e.preventDefault();
      pauseAutoSlide();
      const targetId = href.substring(1);
      const targetIndex = originalSlides.findIndex(s => s.id === targetId || (s.tagName === 'FOOTER' && targetId === 'contact'));
      if (targetIndex !== -1) {
        goToSlide(targetIndex + 1);
      } else if (targetId === 'contact') {
        goToSlide(totalOriginalSlides); // index of the real last slide
      }
    }
  });
});

// Keyboard Navigation
window.addEventListener('keydown', (e) => {
  if (isTransitioning) return;
  pauseAutoSlide();
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    goToSlide(currentSlide + 1);
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    goToSlide(currentSlide - 1);
  }
});

// Touch (Swipe) Navigation
let touchStartX = 0;
let touchEndX = 0;
window.addEventListener('touchstart', e => {
  touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

window.addEventListener('touchend', e => {
  touchEndX = e.changedTouches[0].screenX;
  handleSwipe();
}, { passive: true });

function handleSwipe() {
  if (isTransitioning) return;
  const threshold = 50;
  if (touchStartX - touchEndX > threshold) {
    pauseAutoSlide();
    goToSlide(currentSlide + 1); // Swipe left -> Next slide
  }
  if (touchEndX - touchStartX > threshold) {
    pauseAutoSlide();
    goToSlide(currentSlide - 1); // Swipe right -> Prev slide
  }
}

// ===== HAMBURGER MENU =====
const hamburger = document.getElementById('hamburger');
const navLinksContainer = document.getElementById('navLinks');

function closeMenu() {
  navLinksContainer.classList.remove('active');
  document.body.style.overflow = '';
  const spans = hamburger.querySelectorAll('span');
  spans[0].style.transform = 'none';
  spans[1].style.opacity = '1';
  spans[2].style.transform = 'none';
}

function openMenu() {
  navLinksContainer.classList.add('active');
  document.body.style.overflow = 'hidden';
  const spans = hamburger.querySelectorAll('span');
  spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
  spans[1].style.opacity = '0';
  spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
}

hamburger.addEventListener('click', () => {
  if (navLinksContainer.classList.contains('active')) {
    closeMenu();
  } else {
    openMenu();
  }
});

// Close menu when clicking a nav link
navLinks.forEach(link => {
  link.addEventListener('click', () => {
    closeMenu();
  });
});

// Close menu when clicking on the backdrop (::before pseudo-element area)
navLinksContainer.addEventListener('click', (e) => {
  // If the click is on the nav-links container itself (not a child), close
  if (e.target === navLinksContainer) {
    closeMenu();
  }
});

// ===== UI COMPONENTS (Tabs, Accordion, FAQ, Forms) =====
function toggleAccordion(header) {
  const item = header.parentElement;
  const wasActive = item.classList.contains('active');
  const parent = item.parentElement;
  parent.querySelectorAll('.accordion-item').forEach(ai => {
    ai.classList.remove('active');
    ai.querySelector('.chevron').textContent = '▼';
  });
  if (!wasActive) {
    item.classList.add('active');
    item.querySelector('.chevron').textContent = '▲';
  }
}

function switchTab(btn) {
  const tabId = btn.getAttribute('data-tab');
  const wrapper = btn.closest('.tabs-wrapper') || document;
  wrapper.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  wrapper.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  const activePane = wrapper.querySelector(`#${tabId}`) || document.getElementById(tabId);
  if (activePane) activePane.classList.add('active');
}

function toggleFaq(question) {
  const item = question.parentElement;
  const wasActive = item.classList.contains('active');
  document.querySelectorAll('.faq-item').forEach(fi => {
    fi.classList.remove('active');
    fi.querySelector('.faq-chevron').textContent = '▼';
  });
  if (!wasActive) {
    item.classList.add('active');
    item.querySelector('.faq-chevron').textContent = '▲';
  }
}

function handleContact(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const originalText = btn.textContent;
  btn.textContent = 'Envoyé ✓';
  btn.style.background = '#4caf50';
  form.reset();
  setTimeout(() => {
    btn.textContent = originalText;
    btn.style.background = '';
  }, 3000);
}

// ===== ANIMATIONS (Triggered per slide) =====
function triggerAnimations(slide) {
  // Reveal elements
  const reveals = slide.querySelectorAll('.reveal');
  reveals.forEach(el => el.classList.add('visible'));

  // Price bars
  const priceBars = slide.querySelectorAll('.price-bar-inner');
  priceBars.forEach(bar => {
    if (!bar.dataset.animated) {
      const targetWidth = bar.style.width;
      bar.style.width = '0%';
      setTimeout(() => {
        bar.style.width = targetWidth;
        bar.dataset.animated = 'true';
      }, 200);
    }
  });

  // Counters
  const counters = slide.querySelectorAll('.expo-price, .sym-price');
  counters.forEach(el => {
    if (!el.dataset.animated) {
      const text = el.textContent.replace(/\./g, '').replace(/\s/g, '');
      const num = parseInt(text);
      if (!isNaN(num)) {
        animateCounter(el, num, 1500);
        el.dataset.animated = 'true';
      }
    }
  });
}

function animateCounter(element, target, duration) {
  let start = 0;
  const step = target / (duration / 16);
  const timer = setInterval(() => {
    start += step;
    if (start >= target) {
      start = target;
      clearInterval(timer);
    }
    element.textContent = Math.floor(start).toLocaleString('fr-FR');
  }, 16);
}

// ===== DYNAMIC PRICING =====
function updatePrice(category, selectElement) {
  const selectedOption = selectElement.options[selectElement.selectedIndex];
  const priceValue = selectedOption.value;
  const paymentLink = selectedOption.getAttribute('data-link');
  
  // Update price text with formatting
  const priceDisplay = document.getElementById(`price-${category}`);
  if (priceDisplay) {
    const formattedPrice = parseInt(priceValue).toLocaleString('fr-FR');
    priceDisplay.textContent = formattedPrice;
  }
  
  // Update button link
  const btn = document.getElementById(`btn-${category}`);
  if (btn) {
    btn.href = paymentLink;
  }
}

// Initialize
setTimeout(() => {
  // Set to first real slide without transition lock
  currentSlide = 1;
  sliderWrapper.style.transform = `translateX(-100vw)`;
  triggerAnimations(allSlides[currentSlide]);
  // Update nav link
  navLinks.forEach(a => a.classList.remove('active'));
  const firstId = originalSlides[0].getAttribute('id');
  if (firstId) {
    const activeLink = document.querySelector(`.nav-links a[href="#${firstId}"]`);
    if (activeLink) activeLink.classList.add('active');
  }
  startAutoSlide();
}, 100);


// Expose to window for React
window.toggleAccordion = toggleAccordion;
window.switchTab = switchTab;
window.toggleFaq = toggleFaq;
window.goToSlide = goToSlide;
window.handleContact = handleContact;
window.updatePrice = updatePrice;
