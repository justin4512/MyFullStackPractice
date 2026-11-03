/* Progressive enhancement for the Justin Chiu portfolio. Content is readable without JS. */
(() => {
  'use strict';
  const site = document.querySelector('.profile-site');
  if (!site) return;
  const menuButton = site.querySelector('[data-menu-toggle]');
  const navigation = site.querySelector('#profile-navigation');
  const mobile = window.matchMedia('(max-width: 991.98px)');
  if (menuButton && navigation) {
    const setMenu = (open, returnFocus = false) => {
      menuButton.setAttribute('aria-expanded', String(open));
      navigation.hidden = mobile.matches && !open;
      if (returnFocus) menuButton.focus();
    };
    menuButton.hidden = false;
    setMenu(false);
    menuButton.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
    navigation.addEventListener('click', event => {
      if (event.target.closest('a') && mobile.matches) setMenu(false);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && mobile.matches && menuButton.getAttribute('aria-expanded') === 'true') setMenu(false, true);
    });
    mobile.addEventListener('change', () => setMenu(false));
  }

  const slider = site.querySelector('[data-slider]');
  if (slider) {
    const slides = [...slider.querySelectorAll('[data-slide]')];
    const choices = [...slider.querySelectorAll('[data-slide-to]')];
    const status = slider.querySelector('[data-slide-status]');
    let current = 0;
    const show = (index, announce = true) => {
      const focusWasInSlide = slides[current].contains(document.activeElement);
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, position) => { slide.hidden = position !== current; });
      if (focusWasInSlide && !slides[current].contains(document.activeElement)) slider.focus({ preventScroll: true });
      choices.forEach((button, position) => button.setAttribute('aria-pressed', String(position === current)));
      if (status && announce) status.textContent = `第 ${current + 1} 個故事，共 ${slides.length} 個：${slides[current].dataset.title}`;
    };
    if (slides.length) {
      slider.classList.add('pf-slider-ready');
      slider.querySelector('[data-slider-controls]').hidden = false;
      show(0, false);
      slider.querySelector('[data-prev]').addEventListener('click', () => show(current - 1));
      slider.querySelector('[data-next]').addEventListener('click', () => show(current + 1));
      choices.forEach(button => button.addEventListener('click', () => show(Number(button.dataset.slideTo))));
      slider.addEventListener('keydown', event => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('a') || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          show(current + (event.key === 'ArrowRight' ? 1 : -1));
        }
      });
      let origin = null;
      slider.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse' || event.target.closest('a,button,input')) return;
        origin = { x: event.clientX, y: event.clientY, id: event.pointerId };
      });
      slider.addEventListener('pointerup', event => {
        if (!origin || origin.id !== event.pointerId) return;
        const dx = event.clientX - origin.x, dy = event.clientY - origin.y;
        origin = null;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) show(current + (dx < 0 ? 1 : -1));
      });
      slider.addEventListener('pointercancel', () => { origin = null; });
    }
  }

  const filter = site.querySelector('[data-project-filters]');
  if (filter) {
    filter.hidden = false;
    const cards = [...site.querySelectorAll('[data-project]')];
    const count = site.querySelector('[data-filter-status]');
    filter.addEventListener('click', event => {
      const button = event.target.closest('[data-filter]');
      if (!button) return;
      filter.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      cards.forEach(card => { card.hidden = button.dataset.filter !== 'all' && card.dataset.project !== button.dataset.filter; });
      if (count) count.textContent = `顯示 ${cards.filter(card => !card.hidden).length} 個作品`;
    });
  }

  // Optional analytics adapter: no cookies or third-party requests are created here.
  // Integrators can subscribe to `profile:action` or attach an existing dataLayer.
  site.addEventListener('click', event => {
    const link = event.target.closest('a[data-track]');
    if (!link) return;
    const detail = { event: link.dataset.track, label: link.dataset.trackLabel || link.textContent.trim() };
    document.dispatchEvent(new CustomEvent('profile:action', { detail }));
    if (Array.isArray(window.dataLayer)) window.dataLayer.push(detail);
  });
})();
