/* ==========================================================================
   soul.exe — behaviour
   Sections: 1 config · 2 state · 3 helpers · 4 rendering · 5 transitions
             · 6 modals · 7 input · 8 gallery · 9 init
   ========================================================================== */
(() => {
  'use strict';

  /* ======================= 1. CONFIG (edit here) ======================= */

  // Every artwork path lives here. Change a filename once and it updates everywhere.
  const ASSETS = {
    // start screens
    desktop:   'assets/desktop-bg.png',
    console:   'assets/console.png',
    cartridge: 'assets/cartridge.png',
    room:      'assets/room-bg.png',
    // gallery
    errorPopup:     'assets/gallery/error-popup.png',
    loadingDialog:  'assets/gallery/loading-dialog.png',
    galleryDesktop: 'assets/gallery/desktop.png',          // wallpaper + shortcut icons + taskbar
    explorerFrame:  'assets/gallery/explorer-frame.png',
    iconFolder:     'assets/gallery/icon-folder.png',
    iconPng:        'assets/gallery/icon-png.png',
  };

  // The gallery loader waits for these before it shows a full bar (the popups are preloaded earlier, in the background).
  const GALLERY_ESSENTIALS = ['galleryDesktop', 'explorerFrame', 'iconFolder', 'iconPng'];

  const STAGE = { w: 1600, h: 900 };

  // Where the console ends up in the close-up (stage px). Its width = scale * CSS console width.
  const CLOSEUP = { scale: 1.84, centerX: 780, top: -38, desktopZoom: 1.05 };

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
    loaderMin: 1600,       // gallery loader: minimum time before the bar can complete
    loaderHold: 350,       // …then the full bar is shown this long before the desktop fades in
    loaderTimeout: 15000,  // an asset that never answers counts as failed (Retry / Back)
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

  /* ----- Gallery content: edit here ----- */

  // Folder tree shown in Explorer. `type: 'folder'` opens a level; `type: 'file'` opens the PNG viewer.
  // To add artwork to a PNG, set its `src` (e.g. 'assets/gallery/wips-01-01.png'); null shows "Preview coming soon".
  const file = (name, src = null) => ({ type: 'file', name, src });
  const folder = (name, children) => ({ type: 'folder', name, children });
  const GALLERY = {
    root: folder('My Projects', [
      folder('WIPS', [
        folder('01', [file('01.png'), file('02.png'), file('03.png')]),
        folder('02', [file('01.png'), file('02.png'), file('03.png')]),
        folder('03', [file('01.png'), file('02.png'), file('03.png')]),
      ]),
    ]),
  };

  // Clickable areas laid over the shortcuts/taskbar already painted in assets/gallery/desktop.png.
  // rect = [left, top, right, bottom] in pixels of the supplied 1366×768 artwork.
  // action: 'explorer' opens/restores the Explorer window · 'soon' shows a "Coming soon" panel.
  const DESKTOP = {
    shortcuts: [
      { id: 'my-space',   label: 'My Space',    rect: [6, 38, 104, 130],   action: 'soon' },
      { id: 'projects',   label: 'Projects',    rect: [6, 158, 104, 250],  action: 'explorer' },
      { id: 'sketchbook', label: 'Sketchbook',  rect: [4, 270, 110, 364],  action: 'soon' },
      { id: 'gallery',    label: 'Gallery',     rect: [6, 388, 104, 478],  action: 'explorer' },
      { id: 'contact',    label: 'Contact',     rect: [6, 506, 104, 590],  action: 'soon' },
      { id: 'recycle',    label: 'Recycle Bin', rect: [4, 592, 112, 682],  action: 'soon' },
    ],
    taskbar: [
      { id: 'start',     label: 'Start',                rect: [0, 724, 138, 768],   action: 'soon' },
      { id: 'ql-folder', label: 'File Explorer',        rect: [340, 726, 404, 766], action: 'explorer' },
      { id: 'ql-ie',     label: 'Web browser',          rect: [434, 726, 496, 766], action: 'soon' },
      { id: 'ql-notes',  label: 'Notepad',              rect: [520, 726, 576, 766], action: 'soon' },
    ],
  };

  // Loader bar: left edge (art px of loading-dialog.png) of each of its 19 segments.
  const LOADER_SEGMENTS = [96, 117, 139, 162, 185, 207, 230, 252, 275, 297, 320, 343, 366, 389, 412, 435, 458, 481, 504];
  const LOADER_END = 526;

  /* ============================ 2. STATE ============================ */

  // One explicit state object. `screen` is the settled screen; `busy` is true while a transition runs.
  const state = {
    screen: 'cartridge',      // 'cartridge' | 'room' | 'difficulty' | 'error' | 'loading' | 'desktop'
    busy: false,
    modal: null,              // null | 'settings' | 'project' | 'viewer'
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
    roomLayer: $('#room-layer'), roomBg: $('.room-bg'), roomDim: $('.room-dim'), roomPale: $('.room-pale'), black: $('#black-layer'),
    roomUI: $('#room-ui'), menu: $('#menu'),
    diffUI: $('#difficulty-ui'), diffHeading: $('#difficulty-heading'), cards: $('#cards'), back: $('#back-btn'),
    modalLayer: $('#modal-layer'), settingsModal: $('#settings-modal'), projectModal: $('#project-modal'),
    projectKicker: $('#project-kicker'), projectTitle: $('#project-title'),
    reducedToggle: $('#reduced-toggle'), warning: $('#asset-warning'),
    projectText: $('#project-text'),
    // gallery
    gErr: $('#gallery-error'), geOk: $('#ge-ok'), geClose: $('#ge-close'),
    gLoad: $('#gallery-loading'), glDialog: $('#gl-dialog'), glCover: $('#gl-cover'), glProgress: $('#gl-progress'),
    glClose: $('#gl-close'), glFail: $('#gl-fail'), glFailText: $('#gl-fail-text'), glRetry: $('#gl-retry'), glBack: $('#gl-back'),
    gDesk: $('#gallery-desktop'), shortcuts: $('#g-shortcuts'), taskbar: $('#g-taskbar'),
    tbWindow: $('#tb-window'), tbReturn: $('#tb-return'),
    xp: $('#xp'), xpBack: $('#xp-back'), xpFwd: $('#xp-fwd'), xpUp: $('#xp-up'),
    xpMin: $('#xp-min'), xpMax: $('#xp-max'), xpClose: $('#xp-close'),
    xpAddress: $('#xp-address'), xpPane: $('#xp-pane'), xpStatus: $('#xp-status'),
    viewerModal: $('#viewer-modal'), viewerTitle: $('#viewer-title'), viewerImg: $('#viewer-img'),
    viewerEmpty: $('#viewer-empty'), viewerName: $('#viewer-name'),
  };

  const SCREENS = {
    cartridge: el.startup, room: el.roomUI, difficulty: el.diffUI,
    error: el.gErr, loading: el.gLoad, desktop: el.gDesk,
  };

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
    $$('[data-asset]:not([data-lazy])').forEach((img) => { img.src = ASSETS[img.dataset.asset]; });
    const root = document.documentElement.style;
    root.setProperty('--img-desktop', `url("${ASSETS.desktop}")`);
    root.setProperty('--img-room', `url("${ASSETS.room}")`);
  }

  // Gallery artwork is only requested by the gallery loader, so first-time visitors don't pay for it up front.
  function attachGalleryAssets() {
    $$('[data-asset][data-lazy]').forEach((img) => { if (!img.getAttribute('src')) img.src = ASSETS[img.dataset.asset]; });
    const root = document.documentElement.style;
    root.setProperty('--img-gallery', `url("${ASSETS.galleryDesktop}")`);
    root.setProperty('--img-explorer', `url("${ASSETS.explorerFrame}")`);
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
    setLayer(el.roomLayer, !start && screen !== 'desktop');
    el.roomBg.style.transform = '';
    el.roomDim.style.opacity = screen === 'difficulty' ? '1' : '0';
    el.roomPale.style.opacity = screen === 'error' || screen === 'loading' ? '1' : '0';
    setLayer(el.roomUI, screen === 'room');
    setLayer(el.diffUI, screen === 'difficulty');
    setLayer(el.gErr, screen === 'error');
    setLayer(el.gLoad, screen === 'loading');
    setLayer(el.gDesk, screen === 'desktop');
    setLayer(el.black, screen === 'loading');
    if (screen !== 'loading') { el.glFail.hidden = true; el.glDialog.hidden = false; }
    if (screen !== 'desktop') teardownDesktop();
    el.viewport.dataset.bg = start ? 'desktop' : screen === 'loading' ? 'black' : screen === 'desktop' ? 'gallery' : 'room';
  }

  function focusScreen(name) {
    let target = null;
    if (name === 'cartridge') target = el.cartridge;
    else if (name === 'room') {
      const btns = $$('.menu-btn:not(:disabled)', el.menu);
      target = btns.find((b) => b.dataset.action === state.lastMenu) || btns[0];
    } else if (name === 'difficulty') target = $('.card', el.cards);
    else if (name === 'error') target = el.geOk;
    else if (name === 'loading') target = el.glFail.hidden ? el.glDialog : el.glRetry;
    else if (name === 'desktop') target = $('.xp-item', el.xpPane) || (xp.state === 'open' ? el.xpPane : $('.g-short', el.shortcuts));
    if (target) target.focus({ preventScroll: true });
  }

  /* ========================= 5. TRANSITIONS ========================= */

  const TRANSITIONS = {
    'cartridge>room': runStartup,
    'room>difficulty': roomToDifficulty,
    'difficulty>room': difficultyToRoom,
    'room>cartridge': roomToCartridge,
    'room>error': roomToError,            // gallery
    'error>room': errorToRoom,
    'error>loading': errorToLoading,
    'loading>room': loadingToRoom,        // cancel / Back
    'loading>desktop': loadingToDesktop,
    'desktop>room': desktopToRoom,        // Return to room
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
    if (target === 'loading') startLoading();
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

  function modalNode(name) {
    return name === 'settings' ? el.settingsModal : name === 'viewer' ? el.viewerModal : el.projectModal;
  }

  function openModal(name, opener) {
    if (state.busy || state.modal) return;
    modalOpener = opener || document.activeElement;
    state.modal = name;
    el.modalLayer.hidden = false;
    el.settingsModal.hidden = name !== 'settings';
    el.projectModal.hidden = name !== 'project';
    el.viewerModal.hidden = name !== 'viewer';
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
    el.viewerModal.hidden = true;
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
    el.projectText.textContent = 'This page is coming soon.';
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
      case 'new-game': goTo('difficulty'); break;
      case 'gallery':  goTo('error'); break;            // starts the gallery sequence
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

    // Nothing in the stage is meant to scroll. `overflow: clip` already prevents it; this snaps back in browsers without it.
    [el.stage, el.viewport].forEach((n) => n.addEventListener('scroll', () => { n.scrollLeft = 0; n.scrollTop = 0; }, { passive: true }));

    bindGalleryEvents();      // bound once, here — never again, so re-entering the gallery cannot stack listeners

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

      if (state.screen === 'error' || state.screen === 'loading') {      // gallery popups: Esc dismisses / cancels
        if (e.key === 'Escape') { e.preventDefault(); goTo('room'); }
        else if (e.key === 'Tab') trapTab(e, state.screen === 'error' ? el.gErr : el.gLoad);
        return;
      }
      if (state.screen === 'desktop') { desktopKeys(e); return; }

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

  /* ============================== 8. GALLERY ============================ */

  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rectVars = ([l, t, r, b]) => `--x:${l};--y:${t};--w:${r - l};--h:${b - t}`;

  const xp = { state: 'closed', history: [], index: 0, selected: null };   // state: 'closed' | 'open' | 'min'

  function renderDesktop() {            // shortcut + taskbar hit areas, from DESKTOP
    const btn = (d) => `<button class="g-hit g-short" type="button" data-id="${d.id}" data-action="${d.action}" data-label="${esc(d.label)}" aria-label="${esc(d.label)}" style="${rectVars(d.rect)}"></button>`;
    el.shortcuts.innerHTML = DESKTOP.shortcuts.map((d) => `<li>${btn(d)}</li>`).join('');
    el.taskbar.insertAdjacentHTML('afterbegin', DESKTOP.taskbar.map(btn).join(''));
  }

  // ----- Tab / arrow-key helpers -----

  function trapTab(e, root) {
    const items = $$('button, [tabindex]:not([tabindex="-1"])', root).filter((n) => !n.disabled && !n.closest('[hidden]'));
    if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === items.length - 1 ? 0 : i + 1);
    e.preventDefault();
    items[next].focus();
  }

  function desktopKeys(e) {
    if (xp.state !== 'open' || !e.target.closest || !e.target.closest('#xp')) return;
    if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); xpBack(); return; }
    if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); xpForward(); return; }
    if (e.key === 'Backspace') { e.preventDefault(); xpUp(); return; }
    const item = e.target.closest('.xp-item');
    if (!item) return;
    const items = $$('.xp-item', el.xpPane), i = items.indexOf(item);
    if (e.key === 'Enter') { e.preventDefault(); xpOpen(Number(item.dataset.i), item); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
  }

  // ----- Loader (one run at a time; every callback checks its own `cancelled` flag) -----

  let loader = null;

  function cancelLoader() {
    if (!loader) return;
    loader.cancelled = true;
    cancelAnimationFrame(loader.raf);
    clearTimeout(loader.timer);
    clearTimeout(loader.timeoutId);
    if (loader.wake) loader.wake();
    loader = null;
  }

  function setBar(n) {                  // n = filled segments; the cover hides everything to the right of them
    const x = n >= LOADER_SEGMENTS.length ? LOADER_END : LOADER_SEGMENTS[n] - (n ? 2 : 0);
    el.glCover.style.setProperty('--cx', String(x));
    el.glProgress.setAttribute('aria-valuenow', String(Math.round((n / LOADER_SEGMENTS.length) * 100)));
  }

  function preloadGallery(run) {
    return new Promise((resolve) => {
      run.timeoutId = setTimeout(() => resolve({ ok: false, failed: [], timedOut: true }), TIMING.loaderTimeout);
      Promise.all(GALLERY_ESSENTIALS.map((k) => loadImage(ASSETS[k]))).then((rs) => {
        clearTimeout(run.timeoutId);
        const failed = rs.filter((r) => !r.ok).map((r) => r.src);
        resolve({ ok: failed.length === 0, failed });
      });
    });
  }

  function showLoadFailure(result) {
    el.glFailText.textContent = result.timedOut
      ? 'The gallery took too long to load. Check your connection and try again.'
      : `These files didn’t load: ${result.failed.join(', ')}`;
    el.glDialog.hidden = true;
    el.glFail.hidden = false;
    el.glRetry.focus({ preventScroll: true });
  }

  async function startLoading() {
    cancelLoader();
    const run = (loader = { cancelled: false, raf: 0, timer: 0, timeoutId: 0, wake: null });
    const N = LOADER_SEGMENTS.length;
    const minMs = state.reducedMotion ? 700 : TIMING.loaderMin;
    const wasFailing = !el.glFail.hidden;
    el.glFail.hidden = true;
    el.glDialog.hidden = false;
    setBar(0);
    if (wasFailing) el.glDialog.focus({ preventScroll: true });

    let result = null;
    preloadGallery(run).then((r) => { result = r; });

    const t0 = performance.now();
    await new Promise((resolve) => {
      run.wake = resolve;
      const tick = (now) => {
        if (run.cancelled) return resolve();
        const p = Math.min((now - t0) / minMs, 1);
        const ready = !!(result && result.ok);
        setBar(Math.min(Math.floor(p * N), ready ? N : N - 1));        // never a full bar while assets are outstanding
        if ((result && !result.ok) || (ready && p >= 1)) return resolve();
        run.raf = requestAnimationFrame(tick);
      };
      run.raf = requestAnimationFrame(tick);
    });
    if (run.cancelled) return;
    if (!result.ok) { showLoadFailure(result); return; }

    attachGalleryAssets();
    setBar(N);
    await new Promise((resolve) => { run.wake = resolve; run.timer = setTimeout(resolve, TIMING.loaderHold); });
    if (run.cancelled) return;
    loader = null;
    goTo('desktop');
  }

  // ----- Gallery transitions -----

  async function roomToError() {
    await Promise.race([laterReady, sleep(2500)]);                    // popup art is ready before the popup appears
    await Promise.all([
      fadeOut(el.roomUI, 300),
      anim(el.roomPale, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, commit: { opacity: '1' } }),
    ]);
    el.gErr.style.visibility = 'visible';
    await Promise.all([
      anim(el.gErr, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, commit: { opacity: '1' } }),
      anim($('.g-popup', el.gErr), [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 350, easing: EASE.out }),
    ]);
  }

  async function errorToRoom() {
    await Promise.all([
      fadeOut(el.gErr, 250),
      anim(el.roomPale, [{ opacity: 1 }, { opacity: 0 }], { duration: 450, commit: { opacity: '0' } }),
    ]);
    await showRoomUI();
  }

  async function errorToLoading() {
    el.viewport.dataset.bg = 'black';
    el.glFail.hidden = true;
    el.glDialog.hidden = false;
    setBar(0);
    await Promise.all([fadeOut(el.gErr, 300), fadeIn(el.black, 700)]);   // bedroom fades to black
    await fadeIn(el.gLoad, 300);
  }

  async function loadingToRoom() {                                      // cancel, or Back after a failure
    cancelLoader();
    el.viewport.dataset.bg = 'room';
    await Promise.all([
      fadeOut(el.gLoad, 250),
      fadeOut(el.black, 600),
      anim(el.roomPale, [{ opacity: 1 }, { opacity: 0 }], { duration: 600, commit: { opacity: '0' } }),
    ]);
    await showRoomUI();
  }

  async function loadingToDesktop() {
    xpReset();
    xpRender(false);
    xpShow();                                                           // Explorer is already open as the desktop fades in
    el.viewport.dataset.bg = 'gallery';
    el.gDesk.style.visibility = 'visible';
    await Promise.all([
      anim(el.gDesk, [{ opacity: 0 }, { opacity: 1 }], { duration: 600, commit: { opacity: '1' } }),
      fadeOut(el.gLoad, 450),
    ]);
  }

  async function desktopToRoom() {
    el.viewport.dataset.bg = 'black';
    setLayer(el.roomLayer, true);
    el.roomPale.style.opacity = '0';
    el.roomDim.style.opacity = '0';
    setLayer(el.black, true);                                           // sits under the desktop until it fades away
    await fadeOut(el.gDesk, 500);
    el.viewport.dataset.bg = 'room';
    await fadeOut(el.black, 600);
    await showRoomUI();
  }

  // ----- Explorer: model -----

  const xpPath = () => xp.history[xp.index];
  const xpFolder = () => { const p = xpPath(); return p[p.length - 1]; };

  function xpReset() {
    xp.history = [[GALLERY.root]];
    xp.index = 0;
    xp.selected = null;
    el.xp.classList.remove('is-max');
    syncMaxButton();
  }

  function xpGo(path) {                       // navigating forward discards the old "forward" history, like a browser
    xp.history = xp.history.slice(0, xp.index + 1);
    xp.history.push(path);
    xp.index += 1;
    xpRender(true);
  }
  function xpOpen(i, opener) {
    const node = xpFolder().children[i];
    if (!node) return;
    if (node.type === 'folder') xpGo([...xpPath(), node]);
    else openViewer(node, opener);
  }
  function xpBack()    { if (xp.index > 0) { xp.index -= 1; xpRender(true); } }
  function xpForward() { if (xp.index < xp.history.length - 1) { xp.index += 1; xpRender(true); } }
  function xpUp()      { const p = xpPath(); if (p.length > 1) xpGo(p.slice(0, -1)); }

  function xpSelect(i) {
    xp.selected = i;
    $$('.xp-item', el.xpPane).forEach((b, k) => {
      b.classList.toggle('is-selected', k === i);
      b.setAttribute('aria-pressed', String(k === i));
    });
  }

  function xpRender(focusFirst) {
    const path = xpPath(), folder = xpFolder(), n = folder.children.length;
    xp.selected = null;
    el.xpAddress.textContent = path.map((x) => x.name).join('\\');
    el.xpStatus.textContent = `${n} object${n === 1 ? '' : 's'}`;
    el.xpPane.innerHTML = folder.children.map((c, i) => `
      <button class="xp-item ${c.type === 'file' ? 'is-file' : 'is-folder'}" type="button" data-i="${i}" aria-pressed="false"
              aria-label="${esc(c.name)}, ${c.type === 'folder' ? 'folder' : 'PNG image'}">
        <img src="${c.type === 'folder' ? ASSETS.iconFolder : ASSETS.iconPng}" alt="" draggable="false">
        <span class="xp-label">${esc(c.name)}</span>
      </button>`).join('');
    const canBack = xp.index > 0, canFwd = xp.index < xp.history.length - 1, canUp = path.length > 1;
    el.xpBack.disabled = !canBack;
    el.xpFwd.disabled = !canFwd;
    el.xpUp.disabled = !canUp;
    el.xp.classList.toggle('no-back', !canBack);
    el.xp.classList.toggle('can-fwd', canFwd);
    if (focusFirst) (($('.xp-item', el.xpPane)) || el.xpPane).focus({ preventScroll: true });   // keeps focus off a control that just got disabled
  }

  // ----- Explorer: window controls -----

  function syncMaxButton() {
    const on = el.xp.classList.contains('is-max');
    el.xpMax.setAttribute('aria-pressed', String(on));
    el.xpMax.setAttribute('aria-label', on ? 'Restore down' : 'Maximise');
    el.xpMax.title = on ? 'Restore down' : 'Maximise';
  }
  function xpShow() { el.xp.hidden = false; el.tbWindow.hidden = true; xp.state = 'open'; }
  function xpAppear() { anim(el.xp, [{ opacity: 0, transform: 'scale(0.97)' }, { opacity: 1, transform: 'none' }], { duration: 180, easing: EASE.out }); }

  function xpCloseWindow() {
    el.xp.hidden = true;
    el.tbWindow.hidden = true;
    xp.state = 'closed';
    const target = $('.g-short[data-id="projects"]', el.shortcuts);
    if (target) target.focus({ preventScroll: true });
  }
  function xpMinimise() {
    el.xp.hidden = true;
    el.tbWindow.hidden = false;
    xp.state = 'min';
    el.tbWindow.focus({ preventScroll: true });
  }
  function xpRestore() {
    xpShow();
    xpAppear();
    (($('.xp-item.is-selected', el.xpPane)) || $('.xp-item', el.xpPane) || el.xpPane).focus({ preventScroll: true });
  }
  function xpToggleMax() {
    el.xp.classList.toggle('is-max');
    syncMaxButton();
  }
  function openExplorer() {                   // desktop shortcuts / quick launch
    if (xp.state === 'min') return xpRestore();
    if (xp.state === 'open') { (($('.xp-item', el.xpPane)) || el.xpPane).focus({ preventScroll: true }); return; }
    xpReset();
    xpRender(false);
    xpShow();
    xpAppear();
    (($('.xp-item', el.xpPane)) || el.xpPane).focus({ preventScroll: true });
  }
  function teardownDesktop() {                // leaving the desktop always leaves a clean slate for the next visit
    xp.state = 'closed';
    el.xp.hidden = true;
    el.xp.classList.remove('is-max');
    el.tbWindow.hidden = true;
  }

  // ----- PNG viewer + "coming soon" -----

  function openViewer(node, opener) {
    el.viewerTitle.textContent = node.name;
    const soon = $('.viewer-soon', el.viewerEmpty);
    el.viewerName.textContent = node.name;
    el.viewerImg.hidden = true;
    el.viewerEmpty.hidden = true;
    el.viewerImg.onload = el.viewerImg.onerror = null;
    if (node.src) {
      el.viewerImg.onload = () => { el.viewerImg.hidden = false; el.viewerEmpty.hidden = true; };
      el.viewerImg.onerror = () => { soon.textContent = 'Couldn’t load this preview'; el.viewerImg.hidden = true; el.viewerEmpty.hidden = false; };
      el.viewerImg.alt = node.name;
      el.viewerImg.src = node.src;
    } else {
      soon.textContent = 'Preview coming soon';
      el.viewerImg.removeAttribute('src');
      el.viewerEmpty.hidden = false;
    }
    openModal('viewer', opener);
  }

  function openSoon(label, opener) {
    el.projectKicker.textContent = 'Desktop shortcut';
    el.projectTitle.textContent = label;
    el.projectText.textContent = 'Coming soon.';
    openModal('project', opener);
  }

  // ----- Gallery events (all bound exactly once) -----

  function bindGalleryEvents() {
    el.geOk.addEventListener('click', () => goTo('loading'));
    el.geClose.addEventListener('click', () => goTo('room'));
    el.glClose.addEventListener('click', () => goTo('room'));
    el.glBack.addEventListener('click', () => goTo('room'));
    el.glRetry.addEventListener('click', () => { if (state.screen === 'loading' && !state.busy) startLoading(); });
    el.tbReturn.addEventListener('click', () => goTo('room'));
    el.tbWindow.addEventListener('click', () => xpRestore());

    el.gDesk.addEventListener('click', (e) => {                       // shortcuts + quick launch
      const b = e.target.closest('.g-short');
      if (!b || state.busy || state.modal) return;
      if (b.dataset.action === 'explorer') openExplorer(); else openSoon(b.dataset.label, b);
    });

    el.xpBack.addEventListener('click', xpBack);
    el.xpFwd.addEventListener('click', xpForward);
    el.xpUp.addEventListener('click', xpUp);
    el.xpMin.addEventListener('click', xpMinimise);
    el.xpMax.addEventListener('click', xpToggleMax);
    el.xpClose.addEventListener('click', xpCloseWindow);

    el.xpPane.addEventListener('click', (e) => {
      const item = e.target.closest('.xp-item');
      if (item) xpSelect(Number(item.dataset.i));
      else { xp.selected = null; $$('.xp-item', el.xpPane).forEach((b) => { b.classList.remove('is-selected'); b.setAttribute('aria-pressed', 'false'); }); }
    });
    el.xpPane.addEventListener('dblclick', (e) => {
      const item = e.target.closest('.xp-item');
      if (item) xpOpen(Number(item.dataset.i), item);
    });
  }

  /* ============================== 9. INIT ============================ */

  const criticalAssets = [ASSETS.desktop, ASSETS.console, ASSETS.cartridge];
  const laterAssets = [ASSETS.room, ASSETS.errorPopup, ASSETS.loadingDialog, ...DIFFICULTIES.map((d) => d.image)];
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
    renderDesktop();
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
