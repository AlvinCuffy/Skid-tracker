/* Skid Tracker — plain JS, no build step. State lives in localStorage under "skidTracker". */
(function () {
  'use strict';

  var KEY = 'skidTracker';
  var app = document.getElementById('app');
  var toastEl = document.getElementById('toast');
  var toastTimer = null;

  /* ---------- Icons (Tabler outline paths, inline SVG) ---------- */
  function svg(path) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  }
  var ICON = {
    check: svg('<path d="M5 12l5 5l10 -10"/>'),
    plus: svg('<path d="M12 5v14"/><path d="M5 12h14"/>'),
    trash: svg('<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>'),
    refresh: svg('<path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>'),
    arrowLeft: svg('<path d="M5 12h14"/><path d="M5 12l6 6"/><path d="M5 12l6 -6"/>'),
    copy: svg('<path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z"/><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1"/>'),
    download: svg('<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 11l5 5l5 -5"/><path d="M12 4l0 12"/>'),
    upload: svg('<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 9l5 -5l5 5"/><path d="M12 4l0 12"/>')
  };

  /* ---------- Utilities ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var t = Date.now().toString(16);
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }) + '-' + t;
  }
  function todayISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }
  function prettyDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return iso || '';
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 1800);
  }

  /* ---------- The math ---------- */
  function skidsFor(line) {
    var per = line.tie * line.tier;
    var full = Math.floor(line.cases / per);
    var rem = line.cases % per;
    var total = full + (rem > 0 ? 1 : 0);
    var skids = [];
    for (var i = 1; i <= total; i++) {
      skids.push({
        index: i,
        key: line.id + '-' + i,
        cases: i <= full ? per : rem,
        partial: i > full
      });
    }
    return { per: per, full: full, rem: rem, total: total, skids: skids };
  }

  function lineStats(load, line) {
    var s = skidsFor(line);
    var done = 0;
    for (var i = 0; i < s.skids.length; i++) if (load.checked[s.skids[i].key]) done++;
    return { done: done, total: s.total, skids: s };
  }

  function loadStats(load) {
    var out = { skidsDone: 0, skidsTotal: 0, casesDone: 0, casesTotal: 0 };
    load.lines.forEach(function (line) {
      var s = skidsFor(line);
      out.skidsTotal += s.total;
      out.casesTotal += line.cases;
      s.skids.forEach(function (k) {
        if (load.checked[k.key]) { out.skidsDone++; out.casesDone += k.cases; }
      });
    });
    out.complete = out.skidsTotal > 0 && out.skidsDone === out.skidsTotal;
    return out;
  }

  /* ---------- Storage ---------- */
  var state = { loads: [] };

  function seedLoad() {
    var l1 = uuid(), l2 = uuid(), l3 = uuid(), l4 = uuid();
    return {
      id: uuid(),
      receipt: 'WRT-000016633',
      customer: 'A1 Cash + Carry',
      door: 'D-2',
      date: '2026-09-03',
      createdAt: Date.now(),
      lines: [
        { id: l1, label: '6-8 yellow strap', cases: 300, tie: 7, tier: 8 },
        { id: l2, label: '8-10 purple strap', cases: 300, tie: 7, tier: 8 },
        { id: l3, label: '10-12 pink strap', cases: 300, tie: 8, tier: 7 },
        { id: l4, label: '18-20 red strap', cases: 900, tie: 7, tier: 8 }
      ],
      checked: {}
    };
  }

  function normalizeLoad(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var lines = Array.isArray(raw.lines) ? raw.lines : [];
    var load = {
      id: String(raw.id || uuid()),
      receipt: String(raw.receipt || ''),
      customer: String(raw.customer || ''),
      door: String(raw.door || ''),
      date: String(raw.date || todayISO()),
      createdAt: Number(raw.createdAt) || Date.now(),
      lines: [],
      checked: {}
    };
    lines.forEach(function (ln) {
      var cases = Math.floor(Number(ln.cases)), tie = Math.floor(Number(ln.tie)), tier = Math.floor(Number(ln.tier));
      if (!(cases > 0 && tie > 0 && tier > 0)) return;
      load.lines.push({ id: String(ln.id || uuid()), label: String(ln.label || ''), cases: cases, tie: tie, tier: tier });
    });
    if (raw.checked && typeof raw.checked === 'object') {
      Object.keys(raw.checked).forEach(function (k) { if (raw.checked[k]) load.checked[k] = true; });
    }
    pruneChecks(load);
    return load;
  }

  /* Drop checks for skids that no longer exist (after editing a line). */
  function pruneChecks(load) {
    var valid = {};
    load.lines.forEach(function (line) {
      skidsFor(line).skids.forEach(function (k) { valid[k.key] = true; });
    });
    Object.keys(load.checked).forEach(function (k) { if (!valid[k]) delete load.checked[k]; });
  }

  function loadState() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (e) { raw = null; }
    if (!raw || !Array.isArray(raw.loads)) {
      state = { loads: [seedLoad()] };
      saveState();
      return;
    }
    state = { loads: raw.loads.map(normalizeLoad).filter(Boolean) };
  }

  function saveState() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      toast('Could not save. Storage may be full.');
    }
  }

  function findLoad(id) {
    for (var i = 0; i < state.loads.length; i++) if (state.loads[i].id === id) return state.loads[i];
    return null;
  }

  /* ---------- Routing ---------- */
  function go(hash) { location.hash = hash; }

  function route() {
    var h = location.hash || '#/';
    var m;
    if ((m = /^#\/load\/([\w-]+)$/.exec(h))) {
      var load = findLoad(m[1]);
      if (load) return renderChecklist(load);
    } else if (h === '#/new') {
      return renderForm(null);
    } else if ((m = /^#\/edit\/([\w-]+)$/.exec(h))) {
      var editing = findLoad(m[1]);
      if (editing) return renderForm(editing);
    }
    if (h !== '#/') history.replaceState(null, '', '#/');
    renderHome();
  }

  /* Delegated navigation: any element with data-nav. */
  app.addEventListener('click', function (e) {
    var t = e.target.closest('[data-nav]');
    if (t) { e.preventDefault(); go(t.getAttribute('data-nav')); }
  });

  /* ---------- Home ---------- */
  function renderHome() {
    var loads = state.loads.slice().map(function (l) { return { load: l, stats: loadStats(l) }; });
    loads.sort(function (a, b) {
      if (a.stats.complete !== b.stats.complete) return a.stats.complete ? 1 : -1;
      return b.load.createdAt - a.load.createdAt;
    });

    var html = '<header class="bar"><h1>Skid Tracker</h1></header>';
    if (!loads.length) {
      html += '<p class="empty">No loads yet. Tap New load to enter a tally sheet.</p>';
    } else {
      html += '<ul class="loads">';
      loads.forEach(function (item) {
        var l = item.load, s = item.stats;
        var sub = [l.customer, prettyDate(l.date)].filter(Boolean).join(' · ');
        html += '<li class="load-row" data-id="' + esc(l.id) + '">' +
          '<button type="button" class="load-main" data-nav="#/load/' + esc(l.id) + '">' +
            '<span class="receipt">' + esc(l.receipt) + '</span>' +
            '<span class="sub">' + esc(sub) + '</span>' +
          '</button>' +
          '<span class="chip' + (s.complete ? ' done' : '') + '">' + (s.complete ? ICON.check : '') + s.skidsDone + '/' + s.skidsTotal + '</span>' +
          '<button type="button" class="icon-btn delete-load" aria-label="Delete load ' + esc(l.receipt) + '">' + ICON.trash + '</button>' +
        '</li>';
      });
      html += '</ul>';
    }
    html += '<button type="button" class="btn primary" data-nav="#/new">' + ICON.plus + 'New load</button>';
    html += '<div class="tools">' +
      '<button type="button" class="btn" id="export-json">' + ICON.download + 'Export JSON</button>' +
      '<button type="button" class="btn" id="import-json">' + ICON.upload + 'Import JSON</button>' +
      '<input type="file" id="import-file" accept="application/json,.json" hidden>' +
    '</div>';
    app.innerHTML = html;

    app.querySelectorAll('.delete-load').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.load-row');
        var load = findLoad(row.getAttribute('data-id'));
        if (!load) return;
        if (!confirm('Delete load ' + load.receipt + '? This cannot be undone.')) return;
        state.loads = state.loads.filter(function (l) { return l.id !== load.id; });
        saveState();
        renderHome();
      });
    });

    document.getElementById('export-json').addEventListener('click', exportJSON);
    var fileInput = document.getElementById('import-file');
    document.getElementById('import-json').addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      var f = fileInput.files && fileInput.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () { importJSON(String(reader.result)); };
      reader.readAsText(f);
    });
  }

  function exportJSON() {
    var text = JSON.stringify(state, null, 2);
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'skid-tracker-' + todayISO() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function importJSON(text) {
    var raw;
    try { raw = JSON.parse(text); } catch (e) { toast('That file is not valid JSON.'); return; }
    var list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.loads) ? raw.loads : null);
    if (!list) { toast('No loads found in that file.'); return; }
    var added = 0, updated = 0;
    list.forEach(function (r) {
      var load = normalizeLoad(r);
      if (!load || !load.lines.length) return;
      var existing = findLoad(load.id);
      if (existing) {
        state.loads[state.loads.indexOf(existing)] = load;
        updated++;
      } else {
        state.loads.push(load);
        added++;
      }
    });
    saveState();
    renderHome();
    toast('Imported ' + added + ' new, ' + updated + ' updated.');
  }

  /* ---------- Form (new / edit) ---------- */
  function renderForm(existing) {
    var isEdit = !!existing;
    var load = existing || { receipt: '', customer: '', door: '', date: todayISO(), lines: [] };

    var html = '<header class="bar">' +
      '<button type="button" class="icon-btn" data-nav="' + (isEdit ? '#/load/' + esc(load.id) : '#/') + '" aria-label="Back">' + ICON.arrowLeft + '</button>' +
      '<h1>' + (isEdit ? 'Edit load' : 'New load') + '</h1>' +
    '</header>';

    html += '<form id="load-form" novalidate>' +
      '<div class="card form-section">' +
        field('receipt', 'Receipt #', 'text', load.receipt, 'WRT-000016633', 'Receipt # is required.') +
        field('customer', 'Customer', 'text', load.customer, 'A1 Cash + Carry') +
        field('door', 'Door / spot', 'text', load.door, 'D-2') +
        field('date', 'Date', 'date', load.date, '') +
      '</div>' +
      '<div id="lines"></div>' +
      '<div class="form-actions">' +
        '<button type="button" class="btn" id="add-line">' + ICON.plus + 'Add line</button>' +
        '<button type="submit" class="btn primary">' + (isEdit ? 'Save changes' : 'Save and start') + '</button>' +
      '</div>' +
    '</form>';
    app.innerHTML = html;

    var linesEl = document.getElementById('lines');
    if (load.lines.length) {
      load.lines.forEach(function (ln) { linesEl.appendChild(lineBlock(ln)); });
    } else {
      linesEl.appendChild(lineBlock(null));
    }
    renumberLines();

    document.getElementById('add-line').addEventListener('click', function () {
      var block = lineBlock(null);
      linesEl.appendChild(block);
      renumberLines();
      block.querySelector('[name="label"]').focus();
      block.scrollIntoView({ block: 'nearest' });
    });

    var form = document.getElementById('load-form');
    form.addEventListener('input', function (e) {
      var f = e.target.closest('.field');
      if (f) f.classList.remove('invalid');
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var result = readForm(form);
      if (!result.ok) {
        var first = form.querySelector('.field.invalid .input');
        if (first) first.focus();
        return;
      }
      var id = isEdit ? load.id : uuid();
      var next = {
        id: id,
        receipt: result.receipt,
        customer: result.customer,
        door: result.door,
        date: result.date,
        createdAt: isEdit ? load.createdAt : Date.now(),
        lines: result.lines,
        checked: isEdit ? Object.assign({}, load.checked) : {}
      };
      pruneChecks(next);
      if (isEdit) {
        state.loads[state.loads.indexOf(load)] = next;
      } else {
        state.loads.push(next);
      }
      saveState();
      go('#/load/' + id);
    });
  }

  function field(name, label, type, value, placeholder, errorText) {
    var inputmode = '';
    if (type === 'number') inputmode = ' inputmode="numeric" pattern="[0-9]*" min="1" step="1"';
    if (name === 'receipt') inputmode = ' autocapitalize="characters" autocomplete="off"';
    return '<label class="field">' +
      '<span class="field-label">' + esc(label) + '</span>' +
      '<input class="input" name="' + esc(name) + '" type="' + esc(type) + '" value="' + esc(value == null ? '' : value) + '"' +
        (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') + inputmode + '>' +
      '<span class="error">' + esc(errorText || '') + '</span>' +
    '</label>';
  }

  function lineBlock(line) {
    var el = document.createElement('section');
    el.className = 'card line-block';
    el.setAttribute('data-line-id', line ? line.id : uuid());
    el.innerHTML =
      '<div class="line-block-head">' +
        '<h2 class="line-number">Line</h2>' +
        '<button type="button" class="icon-btn remove-line" aria-label="Remove line">' + ICON.trash + '</button>' +
      '</div>' +
      field('label', 'Line label', 'text', line ? line.label : '', '6-8 yellow strap') +
      field('cases', 'Cases', 'number', line ? line.cases : '', '300', 'Enter a whole number greater than 0.') +
      '<div class="row-2">' +
        field('tie', 'Tie', 'number', line ? line.tie : 7, '7', 'Whole number above 0.') +
        field('tier', 'Tier', 'number', line ? line.tier : 8, '8', 'Whole number above 0.') +
      '</div>' +
      '<p class="readout"></p>';

    var update = function () { updateReadout(el); };
    el.addEventListener('input', update);
    update();

    el.querySelector('.remove-line').addEventListener('click', function () {
      var all = document.querySelectorAll('.line-block');
      if (all.length <= 1) { toast('A load needs at least one line.'); return; }
      el.parentNode.removeChild(el);
      renumberLines();
    });
    return el;
  }

  function renumberLines() {
    var blocks = document.querySelectorAll('.line-block');
    blocks.forEach(function (b, i) {
      b.querySelector('.line-number').textContent = 'Line ' + (i + 1);
      b.querySelector('.remove-line').hidden = blocks.length <= 1;
    });
  }

  function readNumber(el) {
    var v = String(el.value).trim();
    if (!/^\d+$/.test(v)) return NaN;
    var n = Number(v);
    return n > 0 ? n : NaN;
  }

  function updateReadout(block) {
    var cases = readNumber(block.querySelector('[name="cases"]'));
    var tie = readNumber(block.querySelector('[name="tie"]'));
    var tier = readNumber(block.querySelector('[name="tier"]'));
    var out = block.querySelector('.readout');
    if (!(cases > 0 && tie > 0 && tier > 0)) {
      out.textContent = 'Enter cases, tie, and tier to see the skid count.';
      out.classList.remove('ok');
      return;
    }
    var s = skidsFor({ id: 'x', cases: cases, tie: tie, tier: tier });
    var detail = s.rem > 0
      ? s.full + ' full + 1 partial of ' + s.rem
      : s.full + ' full';
    out.textContent = s.per + ' per skid → ' + s.total + ' skid' + (s.total === 1 ? '' : 's') + ' (' + detail + ')';
    out.classList.add('ok');
  }

  function readForm(form) {
    var ok = true;
    function val(name) { return form.querySelector('.form-section [name="' + name + '"]'); }
    function mark(input) { input.closest('.field').classList.add('invalid'); ok = false; }

    var receiptEl = val('receipt');
    var receipt = receiptEl.value.trim();
    if (!receipt) mark(receiptEl);

    var lines = [];
    form.querySelectorAll('.line-block').forEach(function (b) {
      var casesEl = b.querySelector('[name="cases"]');
      var tieEl = b.querySelector('[name="tie"]');
      var tierEl = b.querySelector('[name="tier"]');
      var cases = readNumber(casesEl), tie = readNumber(tieEl), tier = readNumber(tierEl);
      if (isNaN(cases)) mark(casesEl);
      if (isNaN(tie)) mark(tieEl);
      if (isNaN(tier)) mark(tierEl);
      lines.push({
        id: b.getAttribute('data-line-id'),
        label: b.querySelector('[name="label"]').value.trim(),
        cases: cases, tie: tie, tier: tier
      });
    });

    return {
      ok: ok,
      receipt: receipt,
      customer: val('customer').value.trim(),
      door: val('door').value.trim(),
      date: val('date').value || todayISO(),
      lines: lines
    };
  }

  /* ---------- Checklist ---------- */
  function renderChecklist(load) {
    var html = '<header class="bar">' +
      '<button type="button" class="icon-btn" data-nav="#/" aria-label="Back to loads">' + ICON.arrowLeft + '</button>' +
      '<div class="bar-title">' +
        '<button type="button" class="receipt-btn" data-nav="#/edit/' + esc(load.id) + '" aria-label="Edit load ' + esc(load.receipt) + '">' + esc(load.receipt) + '</button>' +
        (load.door ? '<span class="door">' + esc(load.door) + '</span>' : '') +
      '</div>' +
    '</header>';

    html += '<div class="banner" id="banner" hidden>' + ICON.check + '<span id="banner-text"></span></div>';
    html += '<div class="metrics">' +
      '<div class="card metric"><span class="metric-label">Skids done</span><span class="metric-value" id="m-skids"></span></div>' +
      '<div class="card metric"><span class="metric-label">Cases done</span><span class="metric-value" id="m-cases"></span></div>' +
    '</div>';
    html += '<div class="progress" role="progressbar" aria-label="Skids done" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="progress"><div class="progress-bar" id="progress-bar"></div></div>';

    load.lines.forEach(function (line, i) {
      var s = skidsFor(line);
      var title = 'Line ' + (i + 1) + (line.label ? ' — ' + line.label : '');
      html += '<section class="line" data-line-id="' + esc(line.id) + '">' +
        '<div class="line-head">' +
          '<div>' +
            '<div class="line-title">' + esc(title) + '</div>' +
            '<div class="line-meta">' + fmt(line.cases) + ' cs · ' + line.tie + ' tie / ' + line.tier + ' tier · ' + s.per + '/skid</div>' +
          '</div>' +
          '<div class="line-count" data-count>' + '</div>' +
        '</div>' +
        '<div class="skids">';
      s.skids.forEach(function (k) {
        var done = !!load.checked[k.key];
        html += '<div class="skid' + (done ? ' done' : '') + '" role="checkbox" tabindex="0" aria-checked="' + done + '" data-key="' + esc(k.key) + '">' +
          '<span class="box">' + ICON.check + '</span>' +
          '<span class="skid-label">Skid ' + k.index + ' of ' + s.total + '</span>' +
          '<span class="skid-cases">' + fmt(k.cases) + ' cs' + (k.partial ? ' · partial' : '') + '</span>' +
        '</div>';
      });
      html += '</div></section>';
    });

    html += '<div class="checklist-actions">' +
      '<button type="button" class="btn" id="share">' + ICON.copy + 'Share</button>' +
      '<button type="button" class="btn" id="reset">' + ICON.refresh + 'Reset checks</button>' +
    '</div>';
    app.innerHTML = html;

    refreshTotals(load);

    function toggle(row) {
      var key = row.getAttribute('data-key');
      if (load.checked[key]) delete load.checked[key]; else load.checked[key] = true;
      saveState();
      var done = !!load.checked[key];
      row.classList.toggle('done', done);
      row.setAttribute('aria-checked', String(done));
      refreshTotals(load);
    }

    app.querySelectorAll('.skid').forEach(function (row) {
      row.addEventListener('click', function () { toggle(row); });
      row.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(row); }
      });
    });

    document.getElementById('reset').addEventListener('click', function () {
      if (!confirm('Clear every check on ' + load.receipt + '?')) return;
      load.checked = {};
      saveState();
      renderChecklist(load);
      window.scrollTo(0, 0);
    });

    document.getElementById('share').addEventListener('click', function () {
      var s = loadStats(load);
      var text = load.receipt + ' · ' + s.skidsDone + '/' + s.skidsTotal + ' skids · ' + (s.complete ? 'complete' : fmt(s.casesDone) + '/' + fmt(s.casesTotal) + ' cases');
      copyText(text).then(function () { toast('Copied: ' + text); }, function () { toast('Could not copy.'); });
    });
  }

  function refreshTotals(load) {
    var s = loadStats(load);
    document.getElementById('m-skids').textContent = fmt(s.skidsDone) + ' / ' + fmt(s.skidsTotal);
    document.getElementById('m-cases').textContent = fmt(s.casesDone) + ' / ' + fmt(s.casesTotal);
    var pct = s.skidsTotal ? Math.round(100 * s.skidsDone / s.skidsTotal) : 0;
    document.getElementById('progress-bar').style.width = pct + '%';
    document.getElementById('progress').setAttribute('aria-valuenow', String(pct));

    load.lines.forEach(function (line) {
      var ls = lineStats(load, line);
      var section = app.querySelector('.line[data-line-id="' + line.id + '"]');
      if (!section) return;
      var count = section.querySelector('[data-count]');
      count.textContent = ls.done + '/' + ls.total;
      count.classList.toggle('done', ls.total > 0 && ls.done === ls.total);
    });

    var banner = document.getElementById('banner');
    banner.hidden = !s.complete;
    if (s.complete) {
      document.getElementById('banner-text').textContent =
        'Load complete — ' + fmt(s.skidsTotal) + ' skids, ' + fmt(s.casesTotal) + ' cases';
    }
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? resolve() : reject();
    });
  }

  /* ---------- Boot ---------- */
  loadState();
  route();
  window.addEventListener('hashchange', route);

  /* Re-read storage when returning to the tab in case another tab changed it. */
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) { loadState(); route(); }
  });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline caching unavailable */ });
    });
  }

  /* Exposed for testing in the console. */
  window.SkidTracker = { skidsFor: skidsFor, loadStats: loadStats };
})();
