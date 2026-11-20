/*
 * Lift Lab motion: the hero light, the report reveal, the unlock sequence and the 3D barbell.
 * Everything here is an extra. If GSAP or WebGL is missing, or the person asked their phone for
 * reduced motion, the page works as it always did and nothing below runs.
 * Switch it all off in js/config.js with  motion: false  (or only the 3D with  barbell3d: false).
 */
(function () {
  'use strict';

  const CFG = window.LL_CONFIG || {};
  const SCRIPT = document.currentScript;
  if (CFG.motion === false) return;

  const gs = window.gsap;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const animated = () => !!gs && !reduce.matches;
  const fmt = (n, d) => n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
  const VERSION = (() => {
    try { return new URL(SCRIPT.src).searchParams.get('v') || ''; } catch (e) { return ''; }
  })();

  /* ------------------------------------------------------------------ */
  /* Hero: the photo is black and white and lit from the cursor          */
  /* ------------------------------------------------------------------ */

  function initHero() {
    const hero = $('.hero');
    const photo = $('.hero-photo');
    const logo = $('.hero-logo-wrap');
    if (!hero || !photo) return;

    let w = 0;
    let h = 0;
    let radius = 320;
    const setLight = (x, y, r) => {
      photo.style.setProperty('--lx', `${x}px`);
      photo.style.setProperty('--ly', `${y}px`);
      photo.style.setProperty('--lr', `${r}px`);
    };
    const measure = () => {
      const r = photo.getBoundingClientRect();
      w = r.width;
      h = r.height;
      radius = Math.max(190, Math.min(w, h) * 0.46);
    };
    measure();
    window.addEventListener('resize', measure);

    // Reduced motion: a fixed light on the chest, nothing moves.
    if (reduce.matches) { setLight(w * 0.55, h * 0.42, radius); return; }

    let tx = 0;
    let ty = 0;
    let lastMove = -1e9;
    let x = w * 0.55;
    let y = h * 0.42;
    let raf = 0;
    let visible = true;

    const tick = (t) => {
      raf = visible && !document.hidden ? requestAnimationFrame(tick) : 0;
      const following = t - lastMove < 2500;
      // With no pointer (phones) the light drifts across the photo by itself.
      const goalX = following ? tx : w * 0.55 + Math.sin(t * 0.00033) * w * 0.2;
      const goalY = following ? ty : h * 0.42 + Math.sin(t * 0.00051 + 1.3) * h * 0.16;
      x += (goalX - x) * 0.08;
      y += (goalY - y) * 0.08;
      setLight(x.toFixed(1), y.toFixed(1), (radius * (1 + Math.sin(t * 0.0011) * 0.04)).toFixed(1));
    };
    const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };
    new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; if (visible) wake(); }).observe(hero);
    document.addEventListener('visibilitychange', wake);
    wake();

    // On a mouse the emblem tilts and the photo shifts a little the other way, like depth.
    let tilt = null;
    if (gs && logo) {
      gs.set(logo, { transformPerspective: 900 });
      gs.set(photo, { scale: 1.06 });
      tilt = {
        rx: gs.quickTo(logo, 'rotationX', { duration: 0.7, ease: 'power3' }),
        ry: gs.quickTo(logo, 'rotationY', { duration: 0.7, ease: 'power3' }),
        px: gs.quickTo(photo, 'x', { duration: 0.9, ease: 'power3' }),
        py: gs.quickTo(photo, 'y', { duration: 0.9, ease: 'power3' }),
      };
    }
    hero.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const r = photo.getBoundingClientRect();
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
      lastMove = performance.now();
      if (tilt) {
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        tilt.ry(nx * 14);
        tilt.rx(-ny * 10);
        tilt.px(-nx * 14);
        tilt.py(-ny * 10);
      }
    });
    hero.addEventListener('pointerleave', () => {
      lastMove = -1e9;
      if (tilt) { tilt.ry(0); tilt.rx(0); tilt.px(0); tilt.py(0); }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Report: the lab scan                                                */
  /* ------------------------------------------------------------------ */

  let reportTl = null;

  function reportParts() {
    return {
      report: $('#report'),
      bmi: $('#bmiNum'),
      flag: $('#bmiFlag'),
      pin: $('#gaugePin'),
      rows: $$('#reportRows tr'),
      bars: $$('#macroBar span'),
    };
  }

  // Stop a running reveal and put the real numbers back, exactly as they were before it started.
  // app.js calls this before it writes new numbers.
  function settle() {
    if (!reportTl) return;
    const finals = reportTl.finals;
    reportTl.kill();
    reportTl = null;
    const p = reportParts();
    if (finals) {
      p.bmi.textContent = finals.bmi;
      p.rows.forEach((row, i) => { if (row.children[1]) row.children[1].textContent = finals.cells[i]; });
      p.pin.style.left = finals.pin;
      p.bars.forEach((bar, i) => { bar.style.flexBasis = finals.bars[i]; });
    }
    for (const el of [p.pin, ...p.bars]) { if (el) el.style.transition = ''; }
    if (gs) gs.set([p.flag, ...p.rows], { clearProps: 'opacity,visibility,transform' });
    const scan = $('.scan-line');
    if (scan) scan.style.opacity = '0';
  }

  function countTo(tl, el, at, duration) {
    if (!el) return;
    const text = el.textContent.trim();
    if (!/^[\d,]+(\.\d+)?$/.test(text)) return; // ranges and words stay as they are
    const end = parseFloat(text.replace(/,/g, ''));
    const decimals = (text.split('.')[1] || '').length;
    const o = { v: 0 };
    el.textContent = fmt(0, decimals);
    tl.to(o, {
      v: end,
      duration,
      ease: 'power2.out',
      onUpdate: () => { el.textContent = fmt(o.v, decimals); },
      onComplete: () => { el.textContent = text; },
    }, at);
  }

  function animateReport() {
    if (!animated()) return;
    const p = reportParts();
    if (!p.report || !p.bmi) return;
    settle();

    let scan = $('.scan-line', p.report);
    if (!scan) {
      scan = document.createElement('i');
      scan.className = 'scan-line';
      scan.setAttribute('aria-hidden', 'true');
      p.report.appendChild(scan);
    }

    const finals = {
      bmi: p.bmi.textContent,
      cells: p.rows.map((row) => (row.children[1] ? row.children[1].textContent : '')),
      pin: p.pin.style.left,
      bars: p.bars.map((b) => b.style.flexBasis),
    };
    const pinTarget = finals.pin;
    const barTargets = finals.bars;
    for (const el of [p.pin, ...p.bars]) el.style.transition = 'none'; // our tween drives these, not the CSS transition

    const tl = gs.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: () => settle(),
    });
    tl.finals = finals;
    reportTl = tl;

    // the scan line sweeps the report top to bottom
    tl.fromTo(scan, { top: '0%', opacity: 0 }, { top: '100%', opacity: 1, duration: 1.05, ease: 'power1.inOut' }, 0)
      .to(scan, { opacity: 0, duration: 0.2 }, '>-0.2');

    countTo(tl, p.bmi, 0.1, 1.3);
    tl.from(p.flag, { scale: 0.5, autoAlpha: 0, duration: 0.55, ease: 'back.out(2.4)' }, 0.75);
    tl.fromTo(p.pin, { left: '0%' }, { left: pinTarget, duration: 1.3 }, 0.15);

    tl.from(p.rows, { autoAlpha: 0, x: -14, duration: 0.45, stagger: 0.06 }, 0.35);
    p.rows.forEach((row, i) => countTo(tl, row.children[1], 0.4 + i * 0.06, 1.0));

    p.bars.forEach((bar, i) => {
      tl.fromTo(bar, { flexBasis: '0%' }, { flexBasis: barTargets[i], duration: 1.1 }, 0.5 + i * 0.12);
    });
  }

  function initReport() {
    const report = $('#report');
    if (!report || !('IntersectionObserver' in window)) return;
    // The first time the report scrolls into view it plays once, even before anyone presses a button.
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); animateReport(); }
    }, { threshold: 0.35 });
    io.observe(report);
  }

  /* ------------------------------------------------------------------ */
  /* Plan: the lock opens, then the plan builds itself                   */
  /* ------------------------------------------------------------------ */

  // Plays the padlock opening, then calls done() so the page can swap in the plan.
  function unlock(done) {
    const card = $('.lock-card');
    const shackle = $('.padlock .shackle');
    if (!animated() || !card || !shackle) { done(); return; }
    const reset = () => {
      gs.set([card, shackle, '.padlock'], { clearProps: 'all' });
      done();
    };
    gs.timeline({ onComplete: reset })
      .to(shackle, { y: -7, rotation: -28, svgOrigin: '44 28', duration: 0.35, ease: 'back.out(2)' })
      .to('.padlock', { color: '#f5821f', scale: 1.15, duration: 0.25, ease: 'power2.out' }, '<')
      .fromTo(card, { boxShadow: '0 0 0 0 rgba(245,130,31,0)' },
        { boxShadow: '0 0 60px 6px rgba(245,130,31,.35)', duration: 0.3, yoyo: true, repeat: 1 }, '<0.1')
      .to(card, { autoAlpha: 0, y: -16, scale: 0.97, duration: 0.35, ease: 'power2.in' }, '+=0.1');
  }

  function cascade(selector) {
    if (!animated()) return;
    const targets = $$(selector);
    if (!targets.length) return;
    gs.from(targets, {
      autoAlpha: 0,
      y: 18,
      duration: 0.45,
      stagger: 0.06,
      ease: 'power3.out',
      clearProps: 'opacity,visibility,transform',
    });
  }

  function revealPlan() {
    if (!animated()) return;
    gs.from(['#planFor', '.plan-switch', '#dayTabs', '#dayTotal'], {
      autoAlpha: 0,
      y: 14,
      duration: 0.5,
      stagger: 0.07,
      ease: 'power3.out',
      clearProps: 'opacity,visibility,transform',
    });
    cascade('#meals .meal');
  }

  /* ------------------------------------------------------------------ */
  /* How it works: the 3D barbell loads one plate per step               */
  /* ------------------------------------------------------------------ */

  function canDo3D() {
    if (CFG.barbell3d === false || !gs || reduce.matches) return false;
    try {
      const c = document.createElement('canvas');
      if (!(c.getContext('webgl2') || c.getContext('webgl'))) return false;
    } catch (e) { return false; }
    if ((navigator.hardwareConcurrency || 4) < 4) return false;
    if (navigator.deviceMemory && navigator.deviceMemory < 3) return false;
    const conn = navigator.connection;
    if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) return false;
    return true;
  }

  function initSteps() {
    const wrap = $('#stepsWrap');
    const stage = $('#barStage');
    const canvas = $('#barCanvas');
    if (!wrap || !stage || !canvas || !canDo3D()) return;

    const html = document.documentElement;
    html.classList.add('has-3d'); // the photo tiles give way to the pinned barbell
    const steps = $$('.step', wrap);
    const kgEl = $('#barKg');
    const stateEl = $('#barState');
    const segs = $$('.bar-progress i', stage);
    let api = null;
    let kgTween = null;
    let current = -1;
    let raf = 0;

    const fallBack = () => {
      html.classList.remove('has-3d');
      steps.forEach((s) => s.classList.remove('is-active'));
      removeEventListener('scroll', queue);
      removeEventListener('resize', queue);
      api = null;
    };

    const hud = (n, kg) => {
      segs.forEach((s, i) => s.classList.toggle('on', i < n));
      if (stateEl) {
        const title = n > 0 && steps[n - 1] ? steps[n - 1].querySelector('h3').textContent : '';
        stateEl.textContent = n === 0 ? 'Empty bar' : n === steps.length ? 'Ready to lift' : `Step ${n} · ${title}`;
      }
      if (!kgEl) return;
      if (kgTween) kgTween.kill();
      const o = { v: parseFloat(kgEl.textContent) || 0 };
      kgTween = gs.to(o, { v: kg, duration: 0.9, ease: 'power2.out', onUpdate: () => { kgEl.textContent = Math.round(o.v); } });
    };

    let kgByStep = [20];

    function update() {
      raf = 0;
      if (!api) return;
      const vh = window.innerHeight;
      const stacked = window.matchMedia('(max-width: 900px)').matches;
      // The "now showing" line: lower down on phones, where the barbell is pinned above the text.
      const line = stacked ? Math.max(vh * 0.58, stage.getBoundingClientRect().bottom + 70) : vh * 0.58;
      let active = 0;
      steps.forEach((el, i) => { if (el.getBoundingClientRect().top < line) active = i + 1; });
      const box = wrap.getBoundingClientRect();
      api.setProgress(clamp((vh * 0.6 - box.top) / Math.max(1, box.height), 0, 1));
      if (active !== current) {
        current = active;
        steps.forEach((el, i) => el.classList.toggle('is-active', i === active - 1));
        api.setStep(active);
        hud(active, kgByStep[active] ?? kgByStep[kgByStep.length - 1]);
      }
    }
    function queue() { if (!raf) raf = requestAnimationFrame(update); }

    async function load() {
      try {
        const mod = await import(`./barbell.js${VERSION ? `?v=${VERSION}` : ''}`);
        kgByStep = mod.KG_BY_STEP;
        api = mod.createBarbell({ canvas, stage, onFail: () => fallBack() });
        if (!api) { fallBack(); return; }
        window.addEventListener('scroll', queue, { passive: true });
        window.addEventListener('resize', queue);
        update();
      } catch (err) {
        fallBack();
      }
    }

    // Fetch the 3D code only when the section is close, not for everyone who opens the site.
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); load(); }
    }, { rootMargin: '1200px 0px' });
    io.observe(wrap);
  }

  /* ------------------------------------------------------------------ */

  window.LLMotion = {
    report: animateReport,
    settle,
    unlock,
    revealPlan,
    cascade,
  };

  initHero();
  initReport();
  initSteps();
})();
