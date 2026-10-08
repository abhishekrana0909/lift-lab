/* Lift Lab page wiring: form → report → plan, unlock codes and WhatsApp links. */
(function () {
  'use strict';

  const L = window.LiftLab;
  const CFG = window.LL_CONFIG;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const STORE_FORM = 'liftlab.form.v1';
  const STORE_CODE = 'liftlab.code.v1';

  const EXAMPLE = {
    name: '', sex: 'male', age: 25, weight: 78, hunit: 'cm', heightCm: 175, heightFt: '', heightIn: '',
    activity: 'moderate', goal: 'lose', diet: 'veg', level: 'beginner', whey: false, fish: false, meatDays: '3', place: 'gym', days: '4',
    style: 'auto',
  };

  const storage = {
    get(key) {
      try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage blocked: page still works */ }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
    },
  };

  const fmt = (n, d = 0) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const waLink = (text) => `https://wa.me/${CFG.whatsapp}?text=${encodeURIComponent(text)}`;

  /* ---------- Static bits from config ---------- */

  $$('[data-price]').forEach((el) => { el.textContent = CFG.price; });
  $$('.wa-num').forEach((el) => { el.textContent = CFG.whatsappDisplay; });
  $('#upiId').textContent = CFG.upiId;
  $('#payeeName').textContent = CFG.payeeName;
  $('#year').textContent = new Date().getFullYear();
  $('#waFooter').href = waLink('Hi Dwon, I have a question about Lift Lab.');

  /* ---------- Nav ---------- */

  const nav = $('#nav');
  const navToggle = $('#navToggle');
  const navLinks = $('#navLinks');
  const onScroll = () => nav.classList.toggle('is-solid', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  navToggle.addEventListener('click', () => {
    const open = navToggle.getAttribute('aria-expanded') !== 'true';
    navToggle.setAttribute('aria-expanded', String(open));
    navLinks.classList.toggle('is-open', open);
    nav.classList.toggle('is-open', open);
  });
  navLinks.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      navToggle.setAttribute('aria-expanded', 'false');
      navLinks.classList.remove('is-open');
      nav.classList.remove('is-open');
    }
  });

  /* ---------- Hero: letters as windows onto the photo ---------- */

  // The faded background and the photo inside LIFT LAB are the same image, both sized and placed
  // against the screen (not the element). On scroll the letters move over a still photo.
  const heroEl = $('.hero');
  const heroBg = $('.hero-bg');
  const heroWord = $('.hero-word span');
  const HERO_RATIO = 2401 / 3600; // width / height of the rack photo
  let heroQueued = false;

  function paintHero() {
    heroQueued = false;
    const heroTop = heroEl.getBoundingClientRect().top;
    if (heroTop < -heroEl.offsetHeight) return; // scrolled past the hero
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    // Same maths as background-size: cover on a screen-sized box.
    let w = vw;
    let h = vw / HERO_RATIO;
    if (h < vh) { h = vh; w = vh * HERO_RATIO; }
    const x = (vw - w) / 2;
    const y = (vh - h) / 2;
    heroBg.style.height = `${vh}px`;
    heroBg.style.transform = `translate3d(0, ${-heroTop}px, 0)`;
    const r = heroWord.getBoundingClientRect();
    heroWord.style.backgroundSize = `${w}px ${h}px, 100% 100%`;
    heroWord.style.backgroundPosition = `${x - r.left}px ${y - r.top}px, 0 0`;
  }
  const queueHero = () => {
    if (!heroQueued) { heroQueued = true; requestAnimationFrame(paintHero); }
  };
  window.addEventListener('scroll', queueHero, { passive: true });
  window.addEventListener('resize', queueHero);
  if (document.fonts) document.fonts.ready.then(queueHero); // the text box changes size once Archivo loads
  paintHero();

  /* ---------- Form ---------- */

  const form = $('#labForm');
  const activitySel = $('#activity');
  for (const [key, a] of Object.entries(L.ACTIVITY)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = a.label;
    activitySel.appendChild(opt);
  }
  const LEVEL_HINTS = {
    beginner: 'Training for less than 6 months',
    intermediate: 'Training for 6 months to 2 years',
    advanced: 'Training for more than 2 years',
  };
  const syncActivityHint = () => {
    $('#activityHint').textContent = L.ACTIVITY[activitySel.value].hint;
    $('#levelHint').textContent = LEVEL_HINTS[$('#level').value];
  };
  activitySel.addEventListener('change', syncActivityHint);
  $('#level').addEventListener('change', syncActivityHint);

  const styleSel = $('#style');
  for (const [key, s] of Object.entries(L.SPLIT_STYLES)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = s.label;
    styleSel.appendChild(opt);
  }

  // Fish only makes sense for non-veg; the week strip shows what the chosen split looks like.
  function syncPlanChoices() {
    $('#nonvegBox').hidden = $('#diet').value !== 'nonveg';
    const days = Number(getRadio('days')) || 4;
    $('#weekPreview').innerHTML = L.weekPreview(days, styleSel.value).map((d) =>
      `<li class="${d.session ? 'train' : ''}"><b>${d.day.slice(0, 3)}</b>${d.session ? esc(d.session) : 'Rest'}</li>`).join('');
  }
  form.addEventListener('change', (e) => {
    if (['diet', 'days', 'style'].includes(e.target.name)) syncPlanChoices();
  });

  function setRadio(name, value) {
    const el = form.querySelector(`input[name="${name}"][value="${value}"]`);
    if (el) el.checked = true;
  }
  const getRadio = (name) => (form.querySelector(`input[name="${name}"]:checked`) || {}).value;

  function fillForm(v) {
    $('#name').value = v.name || '';
    setRadio('sex', v.sex);
    $('#age').value = v.age ?? '';
    $('#weight').value = v.weight ?? '';
    setRadio('hunit', v.hunit || 'cm');
    $('#heightCm').value = v.heightCm ?? '';
    $('#heightFt').value = v.heightFt ?? '';
    $('#heightIn').value = v.heightIn ?? '';
    activitySel.value = v.activity;
    setRadio('goal', v.goal);
    $('#diet').value = v.diet;
    $('#level').value = v.level;
    $('#whey').checked = !!v.whey;
    $('#fish').checked = !!v.fish;
    setRadio('meatDays', String(v.meatDays || 3));
    setRadio('place', v.place);
    setRadio('days', String(v.days));
    styleSel.value = L.SPLIT_STYLES[v.style] ? v.style : 'auto';
    syncHeightUnit();
    syncActivityHint();
    syncPlanChoices();
  }

  function readForm() {
    return {
      name: $('#name').value.trim(),
      sex: getRadio('sex'),
      age: $('#age').value === '' ? '' : Number($('#age').value),
      weight: $('#weight').value === '' ? '' : Number($('#weight').value),
      hunit: getRadio('hunit'),
      heightCm: $('#heightCm').value === '' ? '' : Number($('#heightCm').value),
      heightFt: $('#heightFt').value === '' ? '' : Number($('#heightFt').value),
      heightIn: $('#heightIn').value === '' ? '' : Number($('#heightIn').value),
      activity: activitySel.value,
      goal: getRadio('goal'),
      diet: $('#diet').value,
      level: $('#level').value,
      whey: $('#whey').checked,
      fish: $('#fish').checked,
      meatDays: getRadio('meatDays'),
      place: getRadio('place'),
      days: getRadio('days'),
      style: styleSel.value,
    };
  }

  function heightCmOf(v) {
    if (v.hunit === 'ft') {
      if (v.heightFt === '') return NaN;
      return Math.round(((Number(v.heightFt) * 12) + Number(v.heightIn || 0)) * 2.54 * 10) / 10;
    }
    return v.heightCm === '' ? NaN : Number(v.heightCm);
  }

  function syncHeightUnit() {
    const ft = getRadio('hunit') === 'ft';
    $('#heightCmBox').hidden = ft;
    $('#heightFtBox').hidden = !ft;
  }

  // Keep both height boxes in step so switching units never loses the number.
  form.addEventListener('change', (e) => {
    if (e.target.name === 'hunit') {
      const cmVal = Number($('#heightCm').value);
      if (e.target.value === 'ft' && cmVal) {
        const totalIn = cmVal / 2.54;
        let ft = Math.floor(totalIn / 12);
        let inch = Math.round(totalIn - ft * 12);
        if (inch === 12) { ft += 1; inch = 0; }
        $('#heightFt').value = ft;
        $('#heightIn').value = inch;
      } else if (e.target.value === 'cm' && $('#heightFt').value !== '') {
        $('#heightCm').value = heightCmOf({ hunit: 'ft', heightFt: $('#heightFt').value, heightIn: $('#heightIn').value });
      }
      syncHeightUnit();
    }
  });

  function showErrors(errors) {
    const map = { age: '#age', weight: '#weight', height: getRadio('hunit') === 'ft' ? '#heightFt' : '#heightCm' };
    $('#heightCm').removeAttribute('aria-invalid');
    $('#heightFt').removeAttribute('aria-invalid');
    for (const key of ['age', 'weight', 'height']) {
      const msg = errors[key] || '';
      $(`#${key}-err`).textContent = msg;
      if (msg) $(map[key]).setAttribute('aria-invalid', 'true');
      else $(map[key]).removeAttribute('aria-invalid');
    }
  }

  /* ---------- Report ---------- */

  let current = null; // { values, input, report }
  let isExample = true;

  function compute(values, { quiet } = {}) {
    const input = {
      sex: values.sex,
      age: values.age === '' ? NaN : Number(values.age),
      height: heightCmOf(values),
      weight: values.weight === '' ? NaN : Number(values.weight),
      activity: values.activity,
      goal: values.goal,
    };
    const errors = L.validate(input);
    if (!quiet) showErrors(errors);
    if (Object.keys(errors).length) return null;
    return { values, input, report: L.analyse(input) };
  }

  function renderReport(state) {
    const { values, input, report: r } = state;
    $('#exampleBadge').hidden = !isExample;
    $('#reportTitle').textContent = values.name ? `${values.name}'s numbers` : 'Your numbers';

    const today = L.fmtDate(new Date());
    const heightText = values.hunit === 'ft' ? `${values.heightFt}′${values.heightIn || 0}″` : `${fmt(input.height, input.height % 1 ? 1 : 0)} cm`;
    $('#reportMeta').innerHTML = [
      ['Age / sex', `${input.age} / ${input.sex === 'male' ? 'M' : 'F'}`],
      ['Height', heightText],
      ['Weight', `${fmt(input.weight, input.weight % 1 ? 1 : 0)} kg`],
      ['Date', today],
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');

    $('#bmiNum').textContent = r.bmi.toFixed(1);
    const flag = $('#bmiFlag');
    flag.textContent = r.category.label;
    flag.dataset.cat = r.category.key;
    $('#bmiWho').textContent = `Asian cut-off · WHO scale: ${r.categoryWHO}`;
    const pos = Math.min(100, Math.max(0, ((r.bmi - 15) / 20) * 100));
    $('#gaugePin').style.left = `${pos}%`;

    const goalWord = { lose: 'fat loss', maintain: 'recomp', gain: 'muscle gain' }[input.goal];
    const rows = [
      ['BMR (calories at rest)', fmt(r.bmr), 'kcal/day', 'Mifflin–St Jeor'],
      ['Maintenance calories', fmt(r.tdee), 'kcal/day', `BMR × ${L.ACTIVITY[input.activity].factor}`],
      ['Target calories', fmt(r.target), 'kcal/day', `For ${goalWord}`, true],
      ['Protein', fmt(r.protein), 'g/day', `${r.proteinPerKg} g per kg${r.refWeight < input.weight ? ` of ${fmt(r.refWeight)} kg` : ''}`, true],
      ['Carbs', fmt(r.carbs), 'g/day', 'Rest of your calories'],
      ['Fat', fmt(r.fat), 'g/day', `${Math.round((r.fat * 9 / r.target) * 100)}% of calories`],
      ['Fibre', fmt(r.fibre), 'g/day', '14 g per 1,000 kcal'],
      ['Water', fmt(r.water, 1), 'litres/day', '+0.5 L on training days'],
      ['Healthy weight', `${fmt(r.healthyRange[0])}–${fmt(r.healthyRange[1])}`, 'kg', 'BMI 18.5–22.9'],
    ];
    $('#reportRows').innerHTML = rows.map(([t, v, u, ref, key]) =>
      `<tr${key ? ' class="is-key"' : ''}><td>${t}</td><td>${v}</td><td>${u}</td><td>${esc(ref)}</td></tr>`).join('');

    const kcalP = r.protein * 4, kcalC = r.carbs * 4, kcalF = r.fat * 9;
    const total = kcalP + kcalC + kcalF;
    const bar = $('#macroBar');
    bar.querySelector('.m-p').style.flexBasis = `${(kcalP / total) * 100}%`;
    bar.querySelector('.m-c').style.flexBasis = `${(kcalC / total) * 100}%`;
    bar.querySelector('.m-f').style.flexBasis = `${(kcalF / total) * 100}%`;
    $('#macroLegend').innerHTML = [
      ['var(--orange)', 'Protein', kcalP], ['var(--chrome)', 'Carbs', kcalC], ['var(--dim)', 'Fat', kcalF],
    ].map(([c, n, k]) => `<li><i style="background:${c}"></i>${n} ${Math.round((k / total) * 100)}%</li>`).join('');

    let note;
    const wk = Math.abs(r.weeklyChange);
    if (input.goal === 'lose') {
      note = `At <b>${fmt(r.target)} kcal</b> a day you should lose about <b>${fmt(wk, 2)} kg a week</b>. If the scale hasn't moved in 3 weeks, take off 100–150 kcal.`;
      if (r.floored) note += ` We kept you at ${fmt(r.target)} kcal because going lower is hard to sustain without supervision.`;
    } else if (input.goal === 'gain') {
      note = `At <b>${fmt(r.target)} kcal</b> a day you should gain about <b>${fmt(wk, 2)} kg a week</b>, mostly muscle if you train hard. Gaining faster than that is mostly fat.`;
    } else {
      note = `Eat about <b>${fmt(r.target)} kcal</b> a day and keep protein high. Your weight should stay steady while your shape changes.`;
    }
    if (isExample) note = `These are example numbers. Enter your own details to get your real report. ${note}`;
    $('#reportNote').innerHTML = note;

    $('#waReport').href = waLink(reportMessage(state));
  }

  function foodText(values) {
    let text = $('#diet').selectedOptions[0].textContent;
    if (values.diet === 'nonveg') {
      const n = Number(values.meatDays) || 7;
      text += n >= 7 ? ', chicken daily' : `, chicken ${n} days/week`;
      if (values.fish) text += ' + fish';
    }
    return text;
  }

  function reportMessage({ values, input, report: r }) {
    const lines = [
      `Hi Dwon, here is my Lift Lab report.`,
      ``,
      values.name ? `Name: ${values.name}` : null,
      `Age / sex: ${input.age} / ${input.sex === 'male' ? 'Male' : 'Female'}`,
      `Height: ${fmt(input.height, input.height % 1 ? 1 : 0)} cm · Weight: ${input.weight} kg`,
      `Activity: ${L.ACTIVITY[input.activity].label}`,
      `Goal: ${L.GOALS[input.goal].label}`,
      `Food: ${foodText(values)}`,
      `Training: ${values.place}, ${values.days} days/week, ${L.SPLIT_STYLES[values.style].label}`,
      ``,
      `BMI: ${r.bmi.toFixed(1)} (${r.category.label})`,
      `Maintenance: ${fmt(r.tdee)} kcal`,
      `Target: ${fmt(r.target)} kcal`,
      `Protein ${r.protein} g · Carbs ${r.carbs} g · Fat ${r.fat} g`,
      ``,
      `I want to join the ₹${CFG.price}/month plan.`,
    ];
    return lines.filter((l) => l !== null).join('\n');
  }

  function paidMessage() {
    const name = current && current.values.name ? current.values.name : '';
    return `Hi Dwon, I've paid ₹${CFG.price} for the Lift Lab plan${name ? ` (name: ${name})` : ''}. Sending the payment screenshot now. Please send my unlock code.`;
  }

  /* ---------- Unlock ---------- */

  // A code unlocks the plan for one person: the one whose details were filled in when it was entered.
  // Their weight, goal, food and training choices can change; someone else's details lock the plan again.
  const normName = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

  function profileOf(state) {
    return { name: state.values.name || '', sex: state.input.sex, age: state.input.age, height: state.input.height };
  }

  function samePerson(who, state) {
    if (!who || !state) return false;
    const now = profileOf(state);
    if (who.sex !== now.sex) return false;
    if (Math.abs(who.age - now.age) > 1) return false; // a birthday during the month is fine
    if (Math.abs(who.height - now.height) > 2) return false; // allows cm / ft-in rounding
    const a = normName(who.name);
    const b = normName(now.name);
    return !(a && b && a !== b);
  }

  function activeCode() {
    const saved = storage.get(STORE_CODE);
    if (!saved || !saved.code) return null;
    const res = L.checkCode(saved.code, CFG.secret);
    if (res.reason === 'expired') return { expired: true, expires: res.expires };
    if (!res.ok) return null;
    // Codes saved before codes were tied to a person: tie them to the details on this phone now.
    if (!saved.who && current && !isExample) {
      saved.who = profileOf(current);
      storage.set(STORE_CODE, saved);
    }
    return { ...res, who: saved.who || null };
  }

  const unlockForm = $('#unlockForm');
  const unlockErr = $('#unlockErr');
  unlockForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const res = L.checkCode($('#unlockCode').value, CFG.secret);
    if (res.ok) {
      if (!current || isExample) {
        unlockErr.textContent = 'Fill in your own details in the calculator above first. The plan is made for the person whose details are filled in.';
        $('#lab').scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      storage.set(STORE_CODE, { code: res.code, who: profileOf(current) });
      unlockErr.textContent = '';
      $('#unlockCode').value = '';
      renderPlan();
      $('#plan').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    unlockErr.textContent = {
      format: 'That doesn’t look like a Lift Lab code. It should look like LL-ABC-DEFGH.',
      invalid: 'This code isn’t valid. Check it letter by letter, or message Dwon on WhatsApp.',
      expired: `This code ran out on ${res.expires ? L.fmtDate(res.expires) : 'an earlier date'}. Renew for ₹${CFG.price} to get a new one.`,
    }[res.reason];
  });

  /* ---------- Plan ---------- */

  let dietDays = [];
  let activeDay = 0;

  function renderPlan() {
    const unlock = activeCode();
    const status = $('#planStatus');
    const valid = unlock && !unlock.expired;
    const otherPerson = valid && current && !samePerson(unlock.who, current);
    const locked = !valid || !current || otherPerson;

    $('#lockPlace').textContent = current && current.values.place === 'home' ? 'home' : 'the gym';
    $('#lockDays').textContent = `${current ? current.values.days : 4} days`;

    if (!unlock) status.textContent = 'Locked';
    else if (unlock.expired) status.innerHTML = `Expired on ${esc(L.fmtDate(unlock.expires))} · enter a new code`;
    else if (otherPerson) status.textContent = 'Locked · this person needs their own code';
    else status.innerHTML = `<b>Unlocked</b> · open till ${esc(L.fmtDate(unlock.expires))}`;

    // Explain why the plan is locked when this phone's code belongs to someone else.
    const note = $('#lockNote');
    if (otherPerson) {
      const who = unlock.who;
      const body = `${who.sex === 'male' ? 'male' : 'female'}, ${who.age}, ${Math.round(who.height)} cm`;
      const sameName = normName(who.name) && normName(who.name) === normName(current.values.name);
      if (sameName) {
        note.textContent = `The code on this phone is for ${who.name} (${body}). These details don't match, so the plan stays locked. If this is you, correct your age or height above.`;
      } else {
        const owner = who.name ? who.name : `someone else (${body})`;
        const person = current.values.name || 'This person';
        note.textContent = `The code on this phone is for ${owner}. ${person} needs to pay ₹${CFG.price} and enter their own code to see a plan.`;
      }
      note.hidden = false;
    } else {
      note.hidden = true;
    }

    $('#planLocked').hidden = !locked;
    $('#planOpen').hidden = locked;
    if (locked) {
      if (valid && !current) status.textContent = 'Fill in your details above to see your plan';
      dietDays = [];
      $('#meals').innerHTML = '';
      $('#sessions').innerHTML = '';
      return;
    }

    const { values, input, report } = current;
    const prefs = {
      name: values.name,
      diet: values.diet,
      whey: values.whey,
      fish: values.fish,
      meatDays: Number(values.meatDays) || 7,
      level: values.level,
      place: values.place,
      days: Number(values.days),
      style: values.style,
    };
    dietDays = L.dietPlan(report, prefs);
    renderPlanFor(values, input, report);
    const today = (new Date().getDay() + 6) % 7; // Monday = 0
    activeDay = Math.min(activeDay, 6);
    if (!renderPlan.daySet) { activeDay = today; renderPlan.daySet = true; }
    renderDayTabs();
    renderDay();
    renderWorkout(L.workoutPlan(prefs, report));
  }

  // Who this plan was built for, so a new person can see at a glance that the plan is theirs.
  function renderPlanFor(values, input, r) {
    const food = foodText(values);
    const level = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' }[values.level];
    const who = values.name ? `${values.name}'s plan` : 'Your plan';
    $('#planFor').innerHTML = `
      <b>${esc(who)}</b>
      <span>${input.sex === 'male' ? 'Male' : 'Female'}, ${input.age}</span>
      <span>${fmt(input.weight, input.weight % 1 ? 1 : 0)} kg</span>
      <span>${esc(L.GOALS[input.goal].label)}</span>
      <span>${fmt(r.target)} kcal · ${r.protein} g protein</span>
      <span>${esc(food)}</span>
      <span>${level} · ${values.place === 'home' ? 'Home' : 'Gym'} ${values.days} days · ${esc(L.SPLIT_STYLES[values.style].label)}</span>`;
  }

  function renderDayTabs() {
    const box = $('#dayTabs');
    box.innerHTML = dietDays.map((d, i) =>
      `<button role="tab" id="day-${i}" aria-selected="${i === activeDay}" tabindex="${i === activeDay ? 0 : -1}" aria-controls="meals">${d.name.slice(0, 3)}</button>`).join('');
  }

  $('#dayTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    activeDay = Number(btn.id.split('-')[1]);
    renderDayTabs();
    renderDay();
    $(`#day-${activeDay}`).focus();
  });
  $('#dayTabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    activeDay = (activeDay + (e.key === 'ArrowRight' ? 1 : 6)) % 7;
    renderDayTabs();
    renderDay();
    $(`#day-${activeDay}`).focus();
  });

  function renderDay() {
    const day = dietDays[activeDay];
    const r = current.report;
    const t = day.totals;
    const match = Math.round((1 - Math.abs(t.kcal - r.target) / r.target) * 100);
    $('#dayTotal').innerHTML = `
      <span>${day.name} · <span class="day-kind${day.training ? ' is-train' : ''}">${day.training ? `Training · ${esc(day.training)}` : 'Rest day'}</span>${day.meatDay && current.values.diet === 'nonveg' && Number(current.values.meatDays) < 7 ? ' · <span class="day-kind is-train">Chicken day</span>' : ''}</span>
      <span>Total <b>${fmt(t.kcal)}</b> / ${fmt(r.target)} kcal</span>
      <span>P <b>${fmt(t.p)}</b> / ${r.protein} g</span>
      <span>C <b>${fmt(t.c)}</b> / ${r.carbs} g</span>
      <span>F <b>${fmt(t.f)}</b> / ${r.fat} g</span>
      <span class="match">${match}% calorie match</span>`;

    $('#meals').innerHTML = day.meals.map((m) => {
      const mt = { kcal: 0, p: 0, c: 0, f: 0 };
      const rows = m.items.map((it) => {
        const food = L.FOODS[it.id];
        mt.kcal += (food.kcal / food.per) * it.amount;
        mt.p += (food.p / food.per) * it.amount;
        mt.c += (food.c / food.per) * it.amount;
        mt.f += (food.f / food.per) * it.amount;
        const a = L.fmtAmount(it.id, it.amount);
        return `<li><span class="food">${esc(food.name)}</span><span class="qty">${esc(a.qty)}${a.hint ? `<small>${esc(a.hint)}</small>` : ''}</span></li>`;
      }).join('');
      return `
        <article class="meal">
          <div class="meal-head"><span>${m.label}</span><span>${m.time}</span></div>
          <h4>${esc(m.title)}</h4>
          <ul>${rows}</ul>
          <div class="meal-macros">
            <span><b>${fmt(mt.kcal)}</b>kcal</span>
            <span><b>${fmt(mt.p)}</b>P g</span>
            <span><b>${fmt(mt.c)}</b>C g</span>
            <span><b>${fmt(mt.f)}</b>F g</span>
          </div>
        </article>`;
    }).join('');
  }

  function renderWorkout(w) {
    const goalNote = {
      lose: 'Set for fat loss: moderate reps, shorter rest, and a 10-minute finisher after each session.',
      maintain: 'Set for recomp: a heavier first lift, then moderate reps.',
      gain: 'Set for muscle gain: heavier reps, longer rest and extra sets on smaller muscles.',
    }[w.goal];
    $('#splitName').innerHTML = `${esc(w.split)} · ${w.place === 'home' ? 'Home' : 'Gym'}<small>${esc(goalNote)}${w.splitNote ? ` ${esc(w.splitNote)}` : ''}</small>`;
    $('#weekStrip').innerHTML = w.sessions.map((s) =>
      `<li class="${s.rest ? 'rest' : 'train'}"><b>${s.day.slice(0, 3)}</b>${s.rest ? 'Rest' : esc(s.name.split(' · ')[0])}</li>`).join('');
    $('#sessions').innerHTML = w.sessions.filter((s) => !s.rest).map((s) => `
      <article class="session">
        <div class="session-head"><h4>${esc(s.name)}</h4><span>${s.day}</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th scope="col">Exercise</th><th scope="col">Sets</th><th scope="col">Reps</th><th scope="col">Rest</th></tr></thead>
            <tbody>${s.exercises.map((e) => `<tr><td>${esc(e.name)}</td><td>${e.sets}</td><td>${e.reps}</td><td>${e.rest}</td></tr>`).join('')}</tbody>
          </table>
        </div>
        ${s.finisher ? `<p class="finisher">${esc(s.finisher)}</p>` : ''}
      </article>`).join('');
    $('#workoutNotes').innerHTML = w.notes.map((n) => `<div><dt>${esc(n.label)}</dt><dd>${esc(n.text)}</dd></div>`).join('');
  }

  // Diet / workout switch
  const tabs = [$('#tab-diet'), $('#tab-workout')];
  function selectTab(i) {
    tabs.forEach((t, j) => {
      t.setAttribute('aria-selected', String(i === j));
      t.tabIndex = i === j ? 0 : -1;
      $(`#${t.getAttribute('aria-controls')}`).hidden = i !== j;
    });
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(i));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { selectTab(1 - i); tabs[1 - i].focus(); }
    });
  });

  /* ---------- Run ---------- */

  function run({ quiet = false, save = true } = {}) {
    const values = readForm();
    const state = compute(values, { quiet });
    if (!state) return false;
    current = state;
    if (save && !isExample) storage.set(STORE_FORM, values);
    renderReport(state);
    renderPlan();
    return true;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    isExample = false;
    if (run()) {
      if (window.matchMedia('(max-width: 1080px)').matches) {
        $('#report').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  // Live updates once the person starts editing.
  let timer;
  form.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      isExample = false;
      run({ quiet: true });
    }, 250);
  });
  form.addEventListener('change', () => {
    isExample = false;
    run({ quiet: true });
  });
  form.addEventListener('focusout', (e) => {
    if (['age', 'weight', 'heightCm', 'heightFt'].includes(e.target.id) && e.target.value !== '') {
      compute(readForm());
    }
  });

  // Wipe the saved details so the next person starts fresh. The unlock code stays on this phone,
  // still tied to the person it was entered for.
  $('#resetForm').addEventListener('click', () => {
    storage.remove(STORE_FORM);
    fillForm({ ...EXAMPLE, name: '', age: '', weight: '', heightCm: '', heightFt: '', heightIn: '' });
    showErrors({});
    // Empty form, example report: the report fills in as soon as the new details are valid.
    isExample = true;
    renderReport(compute(EXAMPLE, { quiet: true }));
    current = null;
    renderPlan();
    const note = $('#resetNote');
    note.textContent = 'Details cleared. Fill in the new person’s details.';
    setTimeout(() => { note.textContent = ''; }, 4000);
    $('#name').focus();
  });

  $('#waPaid').addEventListener('click', () => { $('#waPaid').href = waLink(paidMessage()); });
  $('#waPaid').href = waLink(paidMessage());

  $('#copyUpi').addEventListener('click', async () => {
    const btn = $('#copyUpi');
    try {
      await navigator.clipboard.writeText(CFG.upiId);
      btn.textContent = 'Copied';
    } catch (e) {
      const range = document.createRange();
      range.selectNodeContents($('#upiId'));
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      btn.textContent = 'Selected';
    }
    setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
  });

  // First paint: saved details if this phone has them, otherwise an example.
  const saved = storage.get(STORE_FORM);
  if (saved && typeof saved === 'object') {
    isExample = false;
    fillForm({ ...EXAMPLE, ...saved });
  } else {
    fillForm(EXAMPLE);
  }
  run({ quiet: true, save: false });
})();
