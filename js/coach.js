/* Coach desk: PIN gate, unlock-code maker and checker. */
(function () {
  'use strict';

  const L = window.LiftLab;
  const CFG = window.LL_CONFIG;
  const $ = (sel) => document.querySelector(sel);
  const SESSION_KEY = 'liftlab.coach.v1';

  const pinHash = (pin) => L.hash(`pin|${pin}`);

  function openDesk() {
    $('#gate').hidden = true;
    $('#desk').hidden = false;
    try { sessionStorage.setItem(SESSION_KEY, String(CFG.coachPinHash)); } catch (e) { /* ignore */ }
  }

  try {
    if (sessionStorage.getItem(SESSION_KEY) === String(CFG.coachPinHash)) openDesk();
  } catch (e) { /* ignore */ }

  $('#gate').addEventListener('submit', (e) => {
    e.preventDefault();
    if (pinHash($('#pin').value.trim()) === CFG.coachPinHash) {
      $('#pinErr').textContent = '';
      openDesk();
      renderCodes();
    } else {
      $('#pinErr').textContent = 'Wrong PIN. Try again.';
    }
  });

  /* ---------- Make a code ---------- */

  const toInputDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  $('#startDate').value = toInputDate(new Date());
  $('#validDays').value = CFG.validDays;

  function siteLink() {
    try { return new URL('index.html#plan', window.location.href).href; } catch (e) { return 'the Lift Lab website'; }
  }

  /* ---------- Record of codes made on this device ---------- */

  const STORE_CODES = 'liftlab.coach.codes.v1';
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function loadCodes() {
    try { return JSON.parse(localStorage.getItem(STORE_CODES)) || []; } catch (e) { return []; }
  }
  function saveCodes(list) {
    try { localStorage.setItem(STORE_CODES, JSON.stringify(list.slice(0, 1000))); } catch (e) { /* storage blocked */ }
  }
  const fromInputDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const showPhone = (p) => (p ? `+91 ${p.slice(2, 7)} ${p.slice(7)}` : '');

  function renderCodes() {
    const q = $('#codeSearch').value.trim().toLowerCase().replace(/[\s-]/g, '');
    const rows = loadCodes().filter((c) => !q || `${c.name}${c.phone}${c.code}`.toLowerCase().replace(/[\s-]/g, '').includes(q));
    $('#codesBody').innerHTML = rows.map((c) => {
      const active = L.checkCode(c.code, CFG.secret).ok;
      return `<tr>
        <td>${esc(c.name || '—')}</td>
        <td class="num">${esc(showPhone(c.phone))}</td>
        <td class="code">${esc(c.code)}</td>
        <td class="date">${esc(L.fmtDate(fromInputDate(c.paid)))}</td>
        <td class="date">${esc(L.fmtDate(fromInputDate(c.expires)))}</td>
        <td><span class="pill ${active ? 'on' : 'off'}">${active ? 'Active' : 'Expired'}</span></td>
      </tr>`;
    }).join('');
    $('#codesEmpty').hidden = rows.length > 0;
    $('#codesEmpty').textContent = loadCodes().length ? 'No codes match that search.' : 'No codes yet. Every code you make will show up here.';
  }
  $('#codeSearch').addEventListener('input', renderCodes);

  function cleanPhone(raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return digits;
    return null;
  }

  $('#makeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const phone = cleanPhone($('#clientPhone').value);
    $('#phoneErr').textContent = phone === null ? 'Enter a 10-digit Indian mobile number, or leave it empty.' : '';
    if (phone === null) return;

    const [y, m, d] = ($('#startDate').value || toInputDate(new Date())).split('-').map(Number);
    const days = Math.max(1, Math.min(400, Number($('#validDays').value) || CFG.validDays));
    const expiry = new Date(y, m - 1, d + days);
    const name = $('#clientName').value.trim();
    // Every client gets their own code; try again in the rare case it matches one already given out.
    const made = loadCodes();
    let code = L.makeCode(expiry, CFG.secret);
    for (let i = 0; i < 20 && made.some((c) => c.code === code); i++) code = L.makeCode(expiry, CFG.secret);
    made.unshift({ code, name, phone: phone || '', paid: toInputDate(new Date(y, m - 1, d)), expires: toInputDate(expiry), made: new Date().toISOString() });
    saveCodes(made);
    renderCodes();

    const msg = [
      `Hi${name ? ` ${name}` : ''}, thanks for joining Lift Lab! 💪`,
      ``,
      `Your unlock code: ${code}`,
      `Valid till: ${L.fmtDate(expiry)}`,
      ``,
      `Open ${siteLink()}`,
      `Fill in your own details in the calculator first, then go to "Your Plan", type the code and tap Unlock. Your diet and workout plan will open.`,
      `This code is only for you: the plan opens for the details you fill in when you enter it.`,
      ``,
      `– Dwon`,
    ].join('\n');

    $('#codeBig').textContent = code;
    $('#codeExp').textContent = `Valid till ${L.fmtDate(expiry)} (${days} days)`;
    $('#msg').value = msg;
    $('#codeOut').hidden = false;
    updateWa();
  });

  function updateWa() {
    const phone = cleanPhone($('#clientPhone').value);
    const text = encodeURIComponent($('#msg').value);
    $('#sendWa').href = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
  }
  $('#msg').addEventListener('input', updateWa);
  $('#clientPhone').addEventListener('input', updateWa);

  $('#copyMsg').addEventListener('click', async () => {
    const btn = $('#copyMsg');
    try {
      await navigator.clipboard.writeText($('#msg').value);
      btn.textContent = 'Copied';
    } catch (e) {
      $('#msg').select();
      btn.textContent = 'Selected, press Ctrl+C';
    }
    setTimeout(() => { btn.textContent = 'Copy message'; }, 1800);
  });

  /* ---------- Check a code ---------- */

  $('#checkForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const out = $('#checkOut');
    const res = L.checkCode($('#checkCode').value, CFG.secret);
    const rec = res.code && loadCodes().find((c) => c.code === res.code);
    const forWho = rec ? ` Made for ${rec.name || 'a client'}${rec.phone ? ` (${showPhone(rec.phone)})` : ''}, paid on ${L.fmtDate(fromInputDate(rec.paid))}.` : '';
    out.className = res.ok ? 'ok' : 'bad';
    if (res.ok) out.textContent = `Valid. Open till ${L.fmtDate(res.expires)}.${forWho}`;
    else if (res.reason === 'expired') out.textContent = `Real code, but it ran out on ${L.fmtDate(res.expires)}.${forWho}`;
    else out.textContent = 'Not a valid Lift Lab code.';
  });

  /* ---------- Change PIN ---------- */

  $('#pinForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const pin = $('#newPin').value.trim();
    const line = $('#pinLine');
    line.hidden = false;
    if (pin.length < 4) {
      line.textContent = 'Use at least 4 characters.';
      return;
    }
    line.textContent = `coachPinHash: ${pinHash(pin)},`;
  });

  if (!$('#desk').hidden) renderCodes();
})();
