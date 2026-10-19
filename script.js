/* ==========================================================================
   soul.exe — behaviour
   Sections: 1 config · 2 state · 3 helpers · 4 rendering · 5 transitions
             · 6 modals · 7 input · 8 init
   ========================================================================== */
(() => {
  'use strict';

  /* ======================= 1. CONFIG (edit here) ======================= */

  // Every artwork path lives here. Change a filename once and it updates everywhere.
  const ASSETS = {
    desktop:   'assets/desktop-bg.png',
    console:   'assets/console.png',
    cartridge: 'assets/cartridge.png',
    room:      'assets/room-bg.png',
  };

  const STAGE = { w: 1600, h: 900 };

  // Where the console ends up in the close-up (stage px). Its width = scale * CSS console width.
  const CLOSEUP = { scale: 1.84, centerX: 780, top: -34, desktopZoom: 1.05 };

  const TIMING = {
    instructionFade: 300,
    insert: 700,
    insertDistance: 300,   // px the cartridge travels down (must clear the console's top edge)
    enlarge: 900,
    insertedHold: 800,
    dotStep: 190,
    reveal: 500,
    zoom: 1200,
    settle: 500,
    menuIn: 600,
  };

  const EASE = {
    inOut: 'cubic-bezier(.65,0,.35,1)',
    out: 'cubic-bezier(.22,.8,.3,1)',
    insert: 'cubic-bezier(.45,0,.9,.5)',
  };

  const STORAGE = { checkpoint: 'soulexe.checkpoint', reduced: 'soulexe.reducedMotion' };

  // Room menu. `action` ids are handled in onMenu().
  const MENU = [
    { id: 'continue', label: 'Continue' },
    { id: 'new-game', label: 'New Game' },
    { id: 'settings', label: 'Settings' },
    { id: 'gallery',  label: 'Gallery' },
    { id: 'quit',     label: 'Quit' },
  ];

  // Difficulty cards. To link a finished page later, add `page: 'moons-brew.html'`
  // (see README → "Adding the next page").
  const DIFFICULTIES = [
    {
      id: 'easy', label: 'Easy', image: 'assets/card-easy.png',
      project: 'Social media and promotional graphics',
      subtitle: 'Small quests, big personality',
      description: 'Every adventure starts somewhere. Explore social media graphics and promotional designs made to catch the eye and get the message across.',
    },
    {
      id: 'normal', label: 'Normal', image: 'assets/card-normal.png',
      project: 'Moon’s Brew',
      subtitle: 'A little creative magic',
      description: 'Step into Moon’s Brew, where a café gets a magical new identity. Discover the ideas, colours, and details that bring its personality to life.',
    },
    {
      id: 'hard', label: 'Hard', image: 'assets/card-hard.png',
      project: 'Hot Noonchi',
      subtitle: 'A whole world to build',
      description: 'Welcome to Hot Noonchi. From playful mascots to packaging and spaces, explore how one idea grows into a complete, flavour-filled brand world.',
    },
    {
      id: 'custom', label: 'Custom', image: 'assets/card-custom.png', pixelArt: true,
      project: 'Bespoke project enquiry',
      subtitle: 'Your quest starts here',
      description: 'Have an idea that doesn’t fit the usual settings? Let’s create your own quest—from a fresh brand identity to an interactive little world.',
    },
  ];

  /* ============================ 2. STATE ============================ */

  // One explicit state object. `screen` is the settled screen; `busy` is true while a transition runs.
  const state = {
    screen: 'cartridge',      // 'cartridge' | 'room' | 'difficulty'
    busy: false,
    modal: null,              // null | 'settings' | 'project'
    hasCheckpoint: false,
    reducedMotion: false,
    lastMenu: null,
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const el = {
    viewport: $('#viewport'), stage: $('#stage'),
    startup: $('#startup'), world: $('#world'), desktopBg: $('.desktop-bg'),
    instruction: $('#instruction'), cartridge: $('#cartridge'),
    console: $('#console'), lcd: $('#lcd'), lcdRoom: $('#lcd-room'), lcdText: $('#lcd-text'),
    roomLayer: $('#room-layer'), roomBg: $('.room-bg'), roomDim: $('.room-dim'),
    roomUI: $('#room-ui'), menu: $('#menu'),
    diffUI: $('#difficulty-ui'), diffHeading: $('#difficulty-heading'), cards: $('#cards'), back: $('#back-btn'),
    modalLayer: $('#modal-layer'), settingsModal: $('#settings-modal'), projectModal: $('#project-modal'),
    projectKicker: $('#project-kicker'), projectTitle: $('#project-title'),
    reducedToggle: $('#reduced-toggle'), warning: $('#asset-warning'),
  };

  const SCREENS = { cartridge: el.startup, room: el.roomUI, difficulty: el.diffUI };

  /* =========================== 3. HELPERS =========================== */

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function readStore(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function writeStore(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* private mode */ } }

  // Web Animations helper. With `commit`, the end state is written to inline style.
  // Without it the element returns to its CSS state afterwards (hover styles keep working).
  function anim(node, frames, { duration = 400, delay = 0, easing = 'ease', commit = null } = {}) {
    if (state.reducedMotion) {
      frames = frames.map(({ transform, ...rest }) => rest);   // no movement, fades only
      duration = Math.min(duration, 220);
      delay = 0;
    }
    const a = node.animate(frames, { duration, delay, easing, fill: commit ? 'forwards' : 'backwards' });
    return a.finished.then(
      () => { if (commit) Object.assign(node.style, commit); a.cancel(); },
      () => {}
    );
  }

  function fadeIn(node, duration = 400) {
    node.style.visibility = 'visible';
    return anim(node, [{ opacity: 0 }, { opacity: 1 }], { duration, commit: { opacity: '1' } });
  }
  function fadeOut(node, duration = 300) {
    return anim(node, [{ opacity: 1 }, { opacity: 0 }], { duration, commit: { opacity: '0', visibility: 'hidden' } });
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const done = () => resolve({ src, ok: true });
        if (img.decode) img.decode().then(done, done); else done();
      };
      img.onerror = () => resolve({ src, ok: false });
      img.src = src;
    });
  }

  /* ========================== 4. RENDERING ========================== */

  function fitStage() {
    const k = Math.min(document.documentElement.clientWidth / STAGE.w, document.documentElement.clientHeight / STAGE.h);
    el.stage.style.setProperty('--k', String(k));
  }

  function renderMenu() {
    el.menu.innerHTML = '';
    MENU.forEach((item) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'menu-btn';
      btn.dataset.action = item.id;
      btn.textContent = item.label;
      li.appendChild(btn);
      el.menu.appendChild(li);
    });
    updateContinue();
  }

  function updateContinue() {
    const btn = $('[data-action="continue"]', el.menu);
    if (btn) btn.disabled = !state.hasCheckpoint;
  }

  function renderCards() {
    el.cards.innerHTML = DIFFICULTIES.map((d) => `
      <li class="card-wrap">
        <button class="card" type="button" data-id="${d.id}">
          <span class="card-body">
            <span class="card-title">${d.label}</span>
            <span class="card-art"><img ${d.pixelArt ? 'class="pixel"' : ''} src="${d.image}" alt="" draggable="false"></span>
            <span class="card-sub">${d.subtitle}</span>
            <span class="card-desc">${d.description}</span>
          </span>
        </button>
      </li>`).join('');
  }

  function setAssetSources() {
    $$('[data-asset]').forEach((img) => { img.src = ASSETS[img.dataset.asset]; });
    const root = document.documentElement.style;
    root.setProperty('--img-desktop', `url("${ASSETS.desktop}")`);
    root.setProperty('--img-room', `url("${ASSETS.room}")`);
  }

  function applyReducedMotion(on, persist) {
    state.reducedMotion = on;
    document.documentElement.classList.toggle('reduced-motion', on);
    el.reducedToggle.checked = on;
    if (persist) writeStore(STORAGE.reduced, String(on));
  }

  // Keep inert / aria-hidden in step with state so inactive screens never take clicks or focus.
  function syncUI() {
    Object.entries(SCREENS).forEach(([name, node]) => {
      const interactive = !state.busy && !state.modal && state.screen === name;
      node.toggleAttribute('inert', !interactive);
      node.setAttribute('aria-hidden', String(state.screen !== name));
    });
    el.stage.classList.toggle('is-busy', state.busy);
  }

  function setLayer(node, on) {
    node.style.visibility = on ? 'visible' : 'hidden';
    node.style.opacity = on ? '1' : '0';
  }

  function resetStartup() {
    [el.world, el.desktopBg, el.instruction, el.cartridge, el.console, el.lcdRoom, el.lcdText]
      .forEach((n) => n.removeAttribute('style'));
    el.lcdText.textContent = '';
  }

  // Put every layer into the resting state of `screen` (used at init, after transitions, and on errors).
  function snapTo(screen) {
    const start = screen === 'cartridge';
    if (start) resetStartup(); else el.world.style.visibility = 'hidden';
    setLayer(el.roomLayer, !start);
    el.roomBg.style.transform = '';
    el.roomDim.style.opacity = screen === 'difficulty' ? '1' : '0';
    setLayer(el.roomUI, screen === 'room');
    setLayer(el.diffUI, screen === 'difficulty');
    el.viewport.dataset.bg = start ? 'desktop' : 'room';
  }

  function focusScreen(name) {
    let target = null;
    if (name === 'cartridge') target = el.cartridge;
    else if (name === 'room') {
      const btns = $$('.menu-btn:not(:disabled)', el.menu);
      target = btns.find((b) => b.dataset.action === state.lastMenu) || btns[0];
    } else if (name === 'difficulty') target = $('.card', el.cards);
    if (target) target.focus({ preventScroll: true });
  }

  /* ========================= 5. TRANSITIONS ========================= */

  const TRANSITIONS = {
    'cartridge>room': runStartup,
    'room>difficulty': roomToDifficulty,
    'difficulty>room': difficultyToRoom,
    'room>cartridge': roomToCartridge,
  };

  async function goTo(target) {
    const run = TRANSITIONS[`${state.screen}>${target}`];
    if (!run || state.busy || state.modal) return;       // ignores repeat activation mid-transition
    state.busy = true;
    syncUI();
    try { await run(); } catch (err) { console.error('Transition failed, snapping to target:', err); }
    snapTo(target);
    state.screen = target;
    state.busy = false;
    if (target === 'difficulty') saveCheckpoint();
    syncUI();
    focusScreen(target);
  }

  function saveCheckpoint() {
    writeStore(STORAGE.checkpoint, 'difficulty');
    state.hasCheckpoint = true;
    updateContinue();
  }

  // --- screen 1 → 4: the startup sequence ---

  function closeUpTransform() {
    const left = el.console.offsetLeft, top = el.console.offsetTop, width = el.console.offsetWidth;
    const s = CLOSEUP.scale;
    const tx = CLOSEUP.centerX - (s * width) / 2 - left;
    const ty = CLOSEUP.top - top;
    return `translate(${tx}px, ${ty}px) scale(${s})`;
  }

  // Measure the live display rect so the zoom stays aligned at every window size.
  function computeZoom() {
    const sr = el.stage.getBoundingClientRect();
    const k = sr.width / STAGE.w;
    const r = el.lcd.getBoundingClientRect();
    const x = (r.left - sr.left) / k, y = (r.top - sr.top) / k;
    const w = r.width / k, h = r.height / k;
    const s = Math.max(STAGE.w / w, STAGE.h / h) * 1.004;
    const tx = STAGE.w / 2 - s * (x + w / 2);
    const ty = STAGE.h / 2 - s * (y + h / 2);
    const cover = Math.max(w / STAGE.w, h / STAGE.h);     // how the room image is cropped inside the display
    return { s, tx, ty, roomStart: cover * s };
  }

  async function runStartup() {
    const rm = state.reducedMotion;
    await Promise.race([assetsReady, sleep(4000)]);       // never hang on a slow/missing file

    // 1. instruction fades
    await fadeOut(el.instruction, TIMING.instructionFade);

    // 2. cartridge drops into the slot (it sits behind the console, so the console edge masks it)
    if (rm) {
      await fadeOut(el.cartridge, 200);
    } else {
      const to = `translateY(${TIMING.insertDistance}px)`;
      await anim(el.cartridge, [{ transform: 'translateY(0)' }, { transform: to }],
        { duration: TIMING.insert, easing: EASE.insert, commit: { transform: to } });
      el.cartridge.style.visibility = 'hidden';
    }

    // 3. the SAME console moves + scales into the close-up
    const closeUp = closeUpTransform();
    const bgZoom = `scale(${CLOSEUP.desktopZoom})`;
    if (rm) {
      await anim(el.world, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, commit: { opacity: '0' } });
      el.console.style.transform = closeUp;
      el.desktopBg.style.transform = bgZoom;
      await anim(el.world, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, commit: { opacity: '1' } });
    } else {
      await Promise.all([
        anim(el.console, [{ transform: 'none' }, { transform: closeUp }],
          { duration: TIMING.enlarge, easing: EASE.inOut, commit: { transform: closeUp } }),
        anim(el.desktopBg, [{ transform: 'none' }, { transform: bgZoom }],
          { duration: TIMING.enlarge, easing: EASE.inOut, commit: { transform: bgZoom } }),
      ]);
    }

    // 4. "soul.exe inserted"
    el.lcdText.textContent = 'soul.exe inserted';
    await anim(el.lcdText, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, commit: { opacity: '1' } });
    await sleep(TIMING.insertedHold);

    // 5. "loading..." with animated dots
    await anim(el.lcdText, [{ opacity: 1 }, { opacity: 0 }], { duration: 100, commit: { opacity: '0' } });
    el.lcdText.innerHTML = 'loading<span aria-hidden="true"><span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></span>';
    const dots = $$('.dot', el.lcdText);
    await anim(el.lcdText, [{ opacity: 0 }, { opacity: 1 }], { duration: 100, commit: { opacity: '1' } });
    const pattern = rm ? [1, 2, 3] : [1, 2, 3, 1, 2, 3];
    for (const n of pattern) {
      dots.forEach((d, i) => d.classList.toggle('on', i < n));
      await sleep(TIMING.dotStep);
    }

    // 6. bedroom opens inside the display (clipped to the inner screen)
    const hideText = anim(el.lcdText, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, commit: { opacity: '0' } });
    await Promise.all([
      hideText,
      anim(el.lcdRoom, [{ clipPath: 'inset(50% 0 50% 0)' }, { clipPath: 'inset(0 0 0 0)' }],
        { duration: TIMING.reveal, easing: 'ease-out', commit: { clipPath: 'inset(0 0 0 0)' } }),
    ]);
    await sleep(120);

    // 7. zoom through the display until the bedroom fills the stage
    el.viewport.dataset.bg = 'room';
    if (rm) {
      el.roomLayer.style.visibility = 'visible';
      await Promise.all([
        anim(el.roomLayer, [{ opacity: 0 }, { opacity: 1 }], { duration: 250, commit: { opacity: '1' } }),
        anim(el.world, [{ opacity: 1 }, { opacity: 0 }], { duration: 250, commit: { opacity: '0', visibility: 'hidden' } }),
      ]);
    } else {
      const z = computeZoom();
      const end = `translate(${z.tx}px, ${z.ty}px) scale(${z.s})`;
      await anim(el.world, [{ transform: 'none' }, { transform: end }],
        { duration: TIMING.zoom, easing: EASE.inOut, commit: { transform: end } });

      // The room layer now shows the same pixels the display was showing, then eases to its normal framing.
      el.roomBg.style.transform = `scale(${z.roomStart})`;
      setLayer(el.roomLayer, true);
      await Promise.all([
        anim(el.roomBg, [{ transform: `scale(${z.roomStart})` }, { transform: 'scale(1)' }],
          { duration: TIMING.settle, easing: EASE.out, commit: { transform: 'scale(1)' } }),
        anim(el.world, [{ opacity: 1 }, { opacity: 0 }],
          { duration: TIMING.settle, commit: { opacity: '0', visibility: 'hidden' } }),
      ]);
    }

    // 8. title + menu
    await showRoomUI();
  }

  function showRoomUI() {
    el.roomUI.style.visibility = 'visible';
    const parts = [
      anim(el.roomUI, [{ opacity: 0 }, { opacity: 1 }], { duration: TIMING.menuIn, commit: { opacity: '1' } }),
      anim($('.room-title', el.roomUI), [{ opacity: 0, transform: 'translateY(-14px)' }, { opacity: 1, transform: 'none' }],
        { duration: TIMING.menuIn, easing: EASE.out }),
      ...$$('.menu li', el.roomUI).map((li, i) =>
        anim(li, [{ opacity: 0, transform: 'translateX(24px)' }, { opacity: 1, transform: 'none' }],
          { duration: 450, delay: 150 + i * 70, easing: EASE.out })),
    ];
    return Promise.all(parts);
  }

  // --- room ⇄ difficulty (same room background throughout) ---

  async function roomToDifficulty() {
    await Promise.all([
      fadeOut(el.roomUI, 300),
      anim(el.roomDim, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, commit: { opacity: '1' } }),
    ]);
    el.diffUI.style.visibility = 'visible';
    el.diffUI.style.opacity = '1';
    await Promise.all([
      anim(el.diffHeading, [{ opacity: 0, transform: 'translateY(-22px)' }, { opacity: 1, transform: 'none' }],
        { duration: 450, easing: EASE.out }),
      anim(el.back, [{ opacity: 0 }, { opacity: 1 }], { duration: 450, delay: 200 }),
      ...$$('.card-wrap', el.cards).map((c, i) =>
        anim(c, [{ opacity: 0, transform: 'translateY(28px)' }, { opacity: 1, transform: 'none' }],
          { duration: 450, delay: 120 + i * 90, easing: EASE.out })),
    ]);
  }

  async function difficultyToRoom() {
    await Promise.all([
      fadeOut(el.diffUI, 300),
      anim(el.roomDim, [{ opacity: 1 }, { opacity: 0 }], { duration: 500, commit: { opacity: '0' } }),
    ]);
    await showRoomUI();
  }

  // --- Quit: back to the cartridge screen (never closes the tab) ---

  async function roomToCartridge() {
    await fadeOut(el.roomUI, 300);
    resetStartup();                       // rebuilt behind the room layer
    el.viewport.dataset.bg = 'desktop';
    await fadeOut(el.roomLayer, 700);
    el.roomDim.style.opacity = '0';
  }

  /* ============================ 6. MODALS ============================ */

  let modalOpener = null;

  function modalNode(name) { return name === 'settings' ? el.settingsModal : el.projectModal; }

  function openModal(name, opener) {
    if (state.busy || state.modal) return;
    modalOpener = opener || document.activeElement;
    state.modal = name;
    el.modalLayer.hidden = false;
    el.settingsModal.hidden = name !== 'settings';
    el.projectModal.hidden = name !== 'project';
    syncUI();
    const node = modalNode(name);
    anim(node, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 180 });
    const first = name === 'settings' ? el.reducedToggle : $('[data-close].btn', node);
    first.focus({ preventScroll: true });
  }

  function closeModal() {
    if (!state.modal) return;
    el.modalLayer.hidden = true;
    el.settingsModal.hidden = true;
    el.projectModal.hidden = true;
    state.modal = null;
    syncUI();
    if (modalOpener && modalOpener.isConnected && !modalOpener.disabled) modalOpener.focus({ preventScroll: true });
    else focusScreen(state.screen);
    modalOpener = null;
  }

  function openProject(id, opener) {
    const d = DIFFICULTIES.find((x) => x.id === id);
    if (!d) return;
    // Later: if (d.page) { window.location.href = d.page; return; }
    el.projectKicker.textContent = d.project;
    el.projectTitle.textContent = d.label;
    openModal('project', opener);
  }

  function focusables(root) {
    return $$('button, input, [href], [tabindex]:not([tabindex="-1"])', root).filter((n) => !n.disabled);
  }

  /* ============================ 7. INPUT ============================= */

  function onMenu(action, btn) {
    if (state.busy || state.modal) return;
    state.lastMenu = action;
    switch (action) {
      case 'continue': if (state.hasCheckpoint) goTo('difficulty'); break;
      case 'new-game':
      case 'gallery':  goTo('difficulty'); break;       // Gallery is a stand-in for now
      case 'settings': openModal('settings', btn); break;
      case 'quit':     goTo('cartridge'); break;
    }
  }

  function bindEvents() {
    el.cartridge.addEventListener('click', () => goTo('room'));      // Enter/Space on the focused button also fire click

    el.menu.addEventListener('click', (e) => {
      const btn = e.target.closest('.menu-btn');
      if (btn && !btn.disabled) onMenu(btn.dataset.action, btn);
    });

    el.cards.addEventListener('click', (e) => {
      const card = e.target.closest('.card');
      if (card && !state.busy && !state.modal) openProject(card.dataset.id, card);
    });

    el.back.addEventListener('click', () => goTo('room'));

    el.modalLayer.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });

    el.reducedToggle.addEventListener('change', () => applyReducedMotion(el.reducedToggle.checked, true));

    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', (e) => {
      if (readStore(STORAGE.reduced) === null) applyReducedMotion(e.matches, false);   // follow the OS until the user chooses
    });

    window.addEventListener('resize', fitStage);

    document.addEventListener('keydown', (e) => {
      if (state.modal) {
        if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
        if (e.key === 'Tab') {                                         // keep focus inside the dialog
          const items = focusables(modalNode(state.modal));
          if (!items.length) return;
          const first = items[0], last = items[items.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
        return;
      }
      if (state.busy) return;

      if (state.screen === 'room' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        const items = $$('.menu-btn:not(:disabled)', el.menu);
        if (!items.length) return;
        e.preventDefault();
        const i = items.indexOf(document.activeElement);
        const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i <= 0 ? items.length - 1 : i - 1);
        items[next].focus();
      } else if (state.screen === 'difficulty') {
        if (e.key === 'Escape') { e.preventDefault(); goTo('room'); return; }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          const items = $$('.card', el.cards);
          e.preventDefault();
          const i = items.indexOf(document.activeElement);
          const next = e.key === 'ArrowRight' ? (i + 1) % items.length : (i <= 0 ? items.length - 1 : i - 1);
          items[next].focus();
        }
      }
    });
  }

  /* ============================== 8. INIT ============================ */

  const criticalAssets = [ASSETS.desktop, ASSETS.console, ASSETS.cartridge];
  const laterAssets = [ASSETS.room, ...DIFFICULTIES.map((d) => d.image)];
  const criticalReady = Promise.all(criticalAssets.map(loadImage));
  const laterReady = Promise.all(laterAssets.map(loadImage));
  const assetsReady = Promise.all([criticalReady, laterReady]);

  function reportMissing(results) {
    const missing = results.flat().filter((r) => !r.ok).map((r) => r.src);
    if (!missing.length) return;
    console.warn('Missing artwork:', missing);
    el.warning.textContent = `Missing artwork: ${missing.join(', ')}`;
    el.warning.hidden = false;
  }

  async function init() {
    const saved = readStore(STORAGE.reduced);
    state.hasCheckpoint = readStore(STORAGE.checkpoint) === 'difficulty';
    setAssetSources();
    renderMenu();
    renderCards();
    fitStage();
    applyReducedMotion(saved === null ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : saved === 'true', false);
    snapTo('cartridge');
    syncUI();
    bindEvents();

    await Promise.race([criticalReady, sleep(5000)]);   // first frame only appears once the key art is decoded
    criticalReady.then(reportMissing);
    laterReady.then(reportMissing);
    el.viewport.classList.remove('is-loading');
    focusScreen('cartridge');
  }

  init();
})();
