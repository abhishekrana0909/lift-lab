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
    activity: 'moderate', goal: 'lose', diet: 'veg', level: 'beginner', whey: false, place: 'gym', days: '4',
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
    setRadio('place', v.place);
    setRadio('days', String(v.days));
    syncHeightUnit();
    syncActivityHint();
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
      place: getRadio('place'),
      days: getRadio('days'),
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

  function reportMessage({ values, input, report: r }) {
    const lines = [
      `Hi Dwon, here is my Lift Lab report.`,
      ``,
      values.name ? `Name: ${values.name}` : null,
      `Age / sex: ${input.age} / ${input.sex === 'male' ? 'Male' : 'Female'}`,
      `Height: ${fmt(input.height, input.height % 1 ? 1 : 0)} cm · Weight: ${input.weight} kg`,
      `Activity: ${L.ACTIVITY[input.activity].label}`,
      `Goal: ${L.GOALS[input.goal].label}`,
      `Food: ${$('#diet').selectedOptions[0].textContent} · Trains at ${values.place} ${values.days} days/week`,
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

  function activeCode() {
    const saved = storage.get(STORE_CODE);
    if (!saved || !saved.code) return null;
    const res = L.checkCode(saved.code, CFG.secret);
    if (res.ok) return res;
    if (res.reason === 'expired') return { expired: true, expires: res.expires };
    return null;
  }

  const unlockForm = $('#unlockForm');
  const unlockErr = $('#unlockErr');
  unlockForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const res = L.checkCode($('#unlockCode').value, CFG.secret);
    if (res.ok) {
      storage.set(STORE_CODE, { code: res.code });
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
    const locked = !unlock || unlock.expired || !current;

    $('#lockPlace').textContent = current && current.values.place === 'home' ? 'home' : 'the gym';
    $('#lockDays').textContent = `${current ? current.values.days : 4} days`;

    if (!unlock) status.textContent = 'Locked';
    else if (unlock.expired) status.innerHTML = `Expired on ${esc(L.fmtDate(unlock.expires))} · enter a new code`;
    else status.innerHTML = `<b>Unlocked</b> · open till ${esc(L.fmtDate(unlock.expires))}`;

    $('#planLocked').hidden = !locked;
    $('#planOpen').hidden = locked;
    if (locked) {
      if (unlock && !unlock.expired && !current) status.innerHTML = `<b>Unlocked</b> · fill in your details above to build your plan`;
      return;
    }

    const { values, input, report } = current;
    const prefs = {
      name: values.name,
      diet: values.diet,
      whey: values.whey,
      level: values.level,
      place: values.place,
      days: Number(values.days),
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
    const food = $('#diet').selectedOptions[0].textContent;
    const level = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' }[values.level];
    const who = values.name ? `${values.name}'s plan` : 'Your plan';
    $('#planFor').innerHTML = `
      <b>${esc(who)}</b>
      <span>${input.sex === 'male' ? 'Male' : 'Female'}, ${input.age}</span>
      <span>${fmt(input.weight, input.weight % 1 ? 1 : 0)} kg</span>
      <span>${esc(L.GOALS[input.goal].label)}</span>
      <span>${fmt(r.target)} kcal · ${r.protein} g protein</span>
      <span>${esc(food)}</span>
      <span>${level} · ${values.place === 'home' ? 'Home' : 'Gym'} ${values.days} days</span>`;
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
      <span>${day.name} · <span class="day-kind${day.training ? ' is-train' : ''}">${day.training ? `Training · ${esc(day.training)}` : 'Rest day'}</span></span>
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

  // Wipe the saved details so the next person starts fresh. The unlock code stays on this phone.
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
