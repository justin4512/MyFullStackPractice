document.documentElement.classList.add('js');

const projects = [
  {
    id: 'field-notes', title: 'Field Notes', year: '2026', type: 'PRODUCT EXPERIENCE', url: 'fieldnotes.app',
    summary: '讓散落的田野觀察，成為團隊可以共同理解與採取行動的研究脈絡。',
    role: 'UX Strategy · Frontend', challenge: '研究資料很多，真正被團隊看見的洞察卻很少。', result: '研究整理時間 -42%',
    tags: ['Product Design', 'Vanilla JS', 'A11y'], color: '#b9d4ff', scene: 'notes'
  },
  {
    id: 'after-rain', title: 'After Rain', year: '2025', type: 'CULTURAL ARCHIVE', url: 'afterrain.tw',
    summary: '用聲音、地圖與日常物件，重新拼起一座城市在雨後留下的集體記憶。',
    role: 'Creative Direction · Motion', challenge: '地方故事很動人，傳統資料庫卻讓它們失去溫度。', result: '平均停留時間 4m 18s',
    tags: ['Storytelling', 'Web Audio', 'Motion'], color: '#ffc7a8', scene: 'archive'
  },
  {
    id: 'common-ground', title: 'Common Ground', year: '2025', type: 'CIVIC PLATFORM', url: 'commonground.city',
    summary: '把艱澀的公共議題翻譯成每個人都能參與、比較與留下意見的討論工具。',
    role: 'Design System · Engineering', challenge: '資訊立場複雜，使用者很難快速建立完整觀點。', result: '任務完成率 +31%',
    tags: ['Design System', 'Data UI', 'Testing'], color: '#c8ff32', scene: 'civic'
  },
  {
    id: 'slow-office', title: 'Slow Office', year: '2024', type: 'WORKPLACE TOOL', url: 'slowoffice.work',
    summary: '不再用更多通知催促工作，而是替團隊留下真正能專心完成事情的安靜空間。',
    role: 'Product Design · Prototype', challenge: '協作工具越來越多，深度工作的時間卻越來越少。', result: '非必要會議 -27%',
    tags: ['UX Research', 'Prototype', 'Frontend'], color: '#d7c8ff', scene: 'office'
  }
];

const scenes = {
  notes: `<div class="scene scene-notes"><aside><b>FIELD / NOTES</b><span>12 insights</span><span>7 interviews</span><span>3 themes</span></aside><main><p>INSIGHT 04</p><h4>People don't need<br>more data.<br><em>They need a thread.</em></h4><div class="note-cards"><i></i><i></i><i></i></div></main></div>`,
  archive: `<div class="scene scene-archive"><div class="archive-title"><small>AN AUDIO ARCHIVE OF</small><strong>雨<br>後</strong><span>AFTER RAIN</span></div><div class="sound-wave">${'<i></i>'.repeat(18)}</div><p>25.0330° N<br>121.5654° E</p></div>`,
  civic: `<div class="scene scene-civic"><header><b>COMMON / GROUND</b><span>議題探索</span></header><main><p>我們如何讓城市<br><strong>更適合步行？</strong></p><div class="poll"><i style="--w:76%"></i><i style="--w:58%"></i><i style="--w:42%"></i></div></main></div>`,
  office: `<div class="scene scene-office"><header><b>SLOW OFFICE</b><span>FOCUS MODE</span></header><div class="focus-clock"><small>DEEP WORK</small><strong>42:18</strong><i></i></div><p>Quiet tools for<br>thoughtful teams.</p></div>`
};

const $ = (selector) => document.querySelector(selector);
const elements = {
  visual: $('#project-visual'), mock: $('#mock-content'), url: $('#mock-url'), caption: $('#visual-caption'), story: $('#project-story'),
  number: $('#project-number'), year: $('#project-year'), title: $('#project-title'), summary: $('#project-summary'), role: $('#project-role'),
  challenge: $('#project-challenge'), result: $('#project-result'), tags: $('#project-tags'), count: $('#current-count'), total: $('#total-count'),
  index: $('#project-index'), announcement: $('#project-announcement'), prev: $('#prev-project'), next: $('#next-project'), motion: $('.motion-toggle')
};

let currentIndex = 0;
let cleanupTimer;
let reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
elements.total.textContent = String(projects.length).padStart(2, '0');

function renderIndex() {
  elements.index.innerHTML = projects.map((project, index) => `
    <button class="index-button" type="button" data-index="${index}" aria-current="${index === currentIndex}">
      <span class="index-no">${String(index + 1).padStart(2, '0')}</span>
      <strong>${project.title}</strong>
      <small>${project.year} · ${project.type}</small>
    </button>`).join('');
}

function animateProject(direction) {
  [elements.visual, elements.story].forEach((element) => {
    element.classList.remove('project-enter-next', 'project-enter-prev');
    void element.offsetWidth;
    if (!reducedMotion) element.classList.add(direction === 'prev' ? 'project-enter-prev' : 'project-enter-next');
  });
  clearTimeout(cleanupTimer);
  cleanupTimer = setTimeout(() => [elements.visual, elements.story].forEach((el) => el.classList.remove('project-enter-next', 'project-enter-prev')), 550);
}

function showProject(nextIndex, options = {}) {
  const normalized = (nextIndex + projects.length) % projects.length;
  const previousIndex = currentIndex;
  currentIndex = normalized;
  const project = projects[currentIndex];
  const direction = options.direction || (currentIndex < previousIndex ? 'prev' : 'next');

  elements.visual.style.setProperty('--visual-bg', project.color);
  elements.mock.innerHTML = scenes[project.scene];
  elements.url.textContent = project.url;
  elements.caption.textContent = `${project.type} / ${project.year}`;
  elements.number.textContent = `PROJECT ${String(currentIndex + 1).padStart(2, '0')}`;
  elements.year.textContent = project.year;
  elements.title.textContent = project.title;
  elements.summary.textContent = project.summary;
  elements.role.textContent = project.role;
  elements.challenge.textContent = project.challenge;
  elements.result.textContent = project.result;
  elements.tags.innerHTML = project.tags.map((tag) => `<span>${tag}</span>`).join('');
  elements.count.textContent = String(currentIndex + 1).padStart(2, '0');
  renderIndex();
  if (options.restoreIndexFocus) elements.index.querySelector(`[data-index="${currentIndex}"]`)?.focus();
  animateProject(direction);

  if (options.history !== false) history.pushState({ projectId: project.id }, '', `${location.pathname}?project=${project.id}#work`);
  if (options.announce !== false) elements.announcement.textContent = `目前顯示第 ${currentIndex + 1} 件作品，共 ${projects.length} 件：${project.title}`;
}

elements.prev.addEventListener('click', () => showProject(currentIndex - 1, { direction: 'prev' }));
elements.next.addEventListener('click', () => showProject(currentIndex + 1, { direction: 'next' }));
elements.index.addEventListener('click', (event) => {
  const button = event.target.closest('[data-index]');
  if (!button) return;
  const nextIndex = Number(button.dataset.index);
  showProject(nextIndex, { direction: nextIndex < currentIndex ? 'prev' : 'next', restoreIndexFocus: true });
});

window.addEventListener('popstate', (event) => {
  const id = event.state?.projectId || new URLSearchParams(location.search).get('project');
  const index = projects.findIndex((project) => project.id === id);
  if (index >= 0) showProject(index, { history: false, direction: 'next' });
});

document.addEventListener('keydown', (event) => {
  if (!document.querySelector('#work:hover') && !document.activeElement.closest?.('#work')) return;
  if (event.key === 'ArrowRight') { event.preventDefault(); showProject(currentIndex + 1, { direction: 'next' }); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); showProject(currentIndex - 1, { direction: 'prev' }); }
});

const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
motionQuery.addEventListener('change', (event) => { reducedMotion = event.matches || document.documentElement.dataset.reducedMotion === 'true'; });
elements.motion.addEventListener('click', () => {
  const active = elements.motion.getAttribute('aria-pressed') !== 'true';
  elements.motion.setAttribute('aria-pressed', String(active));
  elements.motion.lastChild.textContent = active ? ' MOTION OFF' : ' MOTION ON';
  document.documentElement.dataset.reducedMotion = String(active);
  reducedMotion = active || motionQuery.matches;
});

if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));
} else {
  document.querySelectorAll('.reveal').forEach((element) => element.classList.add('is-visible'));
}

const cursorGlow = $('.cursor-glow');
let pointerFrame;
window.addEventListener('pointermove', (event) => {
  if (reducedMotion) return;
  cancelAnimationFrame(pointerFrame);
  pointerFrame = requestAnimationFrame(() => { cursorGlow.style.transform = `translate3d(${event.clientX - 130}px,${event.clientY - 130}px,0)`; });
}, { passive: true });

const initialId = new URLSearchParams(location.search).get('project');
const initialIndex = projects.findIndex((project) => project.id === initialId);
showProject(initialIndex >= 0 ? initialIndex : 0, { history: false, announce: false });
history.replaceState({ projectId: projects[currentIndex].id }, '', location.href);
