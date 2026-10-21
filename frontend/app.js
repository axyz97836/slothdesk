'use strict';

// DOM element selector helper
const el = (id) => document.getElementById(id);

// Application State
const state = {
  files: [],          // [{ name, size, supported, selected }]
  suggestions: [],    // [{ name, category, suggested_name, summary, reason, selected, invalid }]
  organized: {},      // { CategoryName: count }
  batches: 0,
  history: [],        // recent batches from /api/history
  connected: false,
  installed: [],
  working: false,
  recommended_model: 'qwen2.5:1.5b'
};

const CATEGORIES = ['Study', 'Code', 'Finance', 'Reading', 'Personal', 'Projects', 'Other'];

const TAGS = {
  '.txt': 'TEXT',
  '.md': 'MARKDOWN',
  '.csv': 'CSV',
  '.json': 'JSON',
  '.py': 'PYTHON',
  '.js': 'JAVASCRIPT',
  '.html': 'HTML',
  '.log': 'LOG',
  '.yaml': 'YAML',
  '.yml': 'YAML'
};

let toastTimer = null;

function toast(message, isError = false) {
  const t = el('toast');
  if (!t) return;
  t.textContent = message;
  t.classList.toggle('error', isError);
  t.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    t.hidden = true;
  }, 5000);
}

async function request(url, data) {
  const opts = data === undefined
    ? {}
    : {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      };
  const r = await fetch(url, opts);
  const body = await r.json();
  if (!r.ok) {
    throw new Error(body.error || `Request failed (${r.status})`);
  }
  return body;
}

function bytes(count) {
  if (count < 1024) return `${count} B`;
  if (count < 1024 * 1024) return `${(count / 1024).toFixed(1)} KB`;
  return `${(count / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoStr;
  }
}

function iconSvg(name) {
  const icons = {
    file: '<svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>',
    folder: '<svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>',
    arrow: '<svg class="icon review-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    alert: '<svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
  };
  return icons[name] || icons.file;
}

function busy(flag) {
  state.working = flag;
  updateButtons();
}

function updateButtons() {
  const selectedFiles = state.files.filter(f => f.supported && f.selected);
  const selectedCount = selectedFiles.length;
  const supportedCount = state.files.filter(f => f.supported).length;

  // Inbox Analyze Button
  const analyzeBtn = el('analyze-button');
  const analyzeLabel = el('analyze-button-label');
  if (analyzeBtn && analyzeLabel) {
    analyzeBtn.disabled = state.working || !state.connected || selectedCount === 0;
    if (state.working) {
      analyzeLabel.textContent = 'Analyzing files...';
    } else {
      analyzeLabel.textContent = `Analyze selected (${selectedCount})`;
    }

    if (!state.connected) {
      analyzeBtn.title = 'Local Ollama model is unavailable. Start Ollama to analyze files.';
    } else if (selectedCount === 0) {
      analyzeBtn.title = 'Select at least 1 file from the inbox to analyze (up to 12 files per batch).';
    } else {
      analyzeBtn.title = `Analyze ${selectedCount} selected file(s) with local AI.`;
    }
  }

  // Inbox selection summary
  const inboxSummary = el('inbox-selection-summary');
  if (inboxSummary) {
    if (supportedCount === 0) {
      inboxSummary.textContent = 'No supported files in inbox';
    } else {
      inboxSummary.textContent = `${selectedCount} of ${supportedCount} file${supportedCount === 1 ? '' : 's'} selected`;
    }
  }

  // Other buttons
  if (el('demo-button')) el('demo-button').disabled = state.working;
  if (el('refresh-button')) el('refresh-button').disabled = state.working;
  if (el('select-all-inbox')) el('select-all-inbox').disabled = state.working || supportedCount === 0;
  if (el('deselect-all-inbox')) el('deselect-all-inbox').disabled = state.working || selectedCount === 0;

  // Suggestions Review Buttons
  const selectedSuggestions = state.suggestions.filter(s => s.selected);
  const hasInvalid = selectedSuggestions.some(s => s.invalid);
  const applyBtn = el('apply-button');
  const applyLabel = el('apply-button-label');
  if (applyBtn && applyLabel) {
    applyBtn.disabled = state.working || selectedSuggestions.length === 0 || hasInvalid;
    applyLabel.textContent = `Approve and organize (${selectedSuggestions.length})`;
    if (hasInvalid) {
      applyBtn.title = 'Please correct invalid filenames before approving.';
    } else if (selectedSuggestions.length === 0) {
      applyBtn.title = 'Select at least 1 suggestion to approve.';
    } else {
      applyBtn.title = `Move ${selectedSuggestions.length} approved file(s) to data/organized/`;
    }
  }

  if (el('export-button')) {
    el('export-button').disabled = state.suggestions.length === 0;
  }
  if (el('select-all-review')) {
    el('select-all-review').disabled = state.working || state.suggestions.length === 0;
  }
  if (el('deselect-all-review')) {
    el('deselect-all-review').disabled = state.working || selectedSuggestions.length === 0;
  }

  // Undo button
  const activeBatch = state.history.find(b => !b.undone);
  if (el('undo-button')) {
    el('undo-button').disabled = state.working || !activeBatch;
  }
}

async function refresh() {
  try {
    const [statusData, filesData, historyData] = await Promise.all([
      request('/api/status'),
      request('/api/files'),
      request('/api/history')
    ]);

    // Preserve previous file selection where applicable
    const prevSelected = new Set(state.files.filter(f => f.selected).map(f => f.name));
    state.files = filesData.files.map(f => ({
      ...f,
      selected: f.supported && (prevSelected.has(f.name) || (prevSelected.size === 0 && filesData.files.length <= 12))
    }));

    state.organized = statusData.organized;
    state.batches = statusData.batches;
    state.history = historyData.batches || [];
    state.recommended_model = statusData.recommended_model || 'qwen2.5:1.5b';

    const info = statusData.ollama;
    state.installed = info.models || [];
    state.connected = info.reachable && state.installed.length > 0;

    // Model Selector dropdown
    const select = el('model-select');
    if (select) {
      const prevVal = select.value;
      select.replaceChildren();
      const options = state.installed.length ? state.installed : [state.recommended_model];
      for (const m of options) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m === state.recommended_model ? `${m} (recommended)` : m;
        select.append(opt);
      }
      select.value = options.includes(prevVal)
        ? prevVal
        : (options.includes(state.recommended_model) ? state.recommended_model : options[0]);
    }

    // Model Status Dot & Label
    const statusWrap = el('model-status');
    if (statusWrap) {
      statusWrap.replaceChildren();
      const dot = document.createElement('span');
      dot.className = 'state-dot';
      const textSpan = document.createElement('span');
      textSpan.className = 'state-text';

      if (!info.reachable) {
        dot.classList.add('error');
        textSpan.textContent = 'Ollama offline';
        statusWrap.title = 'Ollama is not running. Start Ollama to enable AI analysis.';
      } else if (!state.installed.length) {
        dot.classList.add('error');
        textSpan.textContent = 'No local model';
        statusWrap.title = 'No models found. Run: ollama pull qwen2.5:1.5b';
      } else {
        dot.classList.add('ready');
        textSpan.textContent = `Model ready (${state.installed.length})`;
        statusWrap.title = `Ollama connected. ${state.installed.length} local model(s) available.`;
      }
      statusWrap.append(dot, textSpan);
    }

    // Counters
    if (el('inbox-label')) el('inbox-label').textContent = state.files.length;
    if (el('stat-inbox')) el('stat-inbox').textContent = state.files.length;

    const totalOrganized = Object.values(state.organized).reduce((acc, n) => acc + n, 0);
    if (el('stat-organized')) el('stat-organized').textContent = totalOrganized;

    const activeBatchCount = state.history.filter(b => !b.undone).length;
    if (el('stat-batches')) el('stat-batches').textContent = `${activeBatchCount} active`;

    renderFiles();
    renderCategories();
    renderReview();
    renderHistory();
    updateButtons();
  } catch (err) {
    toast(err.message, true);
  }
}

function renderFiles() {
  const root = el('file-list');
  if (!root) return;
  root.replaceChildren();

  if (!state.files.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <p class="empty-state-title">Inbox is empty.</p>
      <p class="empty-state-desc">Place documents into <code>data/inbox/</code> or click "Load sample files" to test.</p>
    `;
    root.append(empty);
    return;
  }

  for (const f of state.files) {
    const row = document.createElement('div');
    row.className = `file-row ${f.selected ? 'selected' : ''} ${!f.supported ? 'unsupported' : ''}`;

    // 1. Checkbox
    const checkCol = document.createElement('div');
    checkCol.className = 'file-row-check';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'file-checkbox';
    cb.checked = !!f.selected;
    cb.disabled = !f.supported || state.working;
    cb.setAttribute('aria-label', `Select ${f.name} for analysis`);

    cb.addEventListener('change', () => {
      const currentlySelected = state.files.filter(x => x.supported && x.selected).length;
      if (cb.checked && currentlySelected >= 12) {
        cb.checked = false;
        toast('Maximum batch limit is 12 files. Deselect another file first.');
        return;
      }
      f.selected = cb.checked;
      row.classList.toggle('selected', f.selected);
      updateButtons();
    });
    checkCol.append(cb);

    // 2. Name with Icon
    const nameCol = document.createElement('div');
    nameCol.className = 'file-row-name';
    nameCol.innerHTML = iconSvg('file');
    const nameText = document.createElement('span');
    nameText.className = 'file-name-text';
    nameText.textContent = f.name;
    nameText.title = f.name;
    nameCol.append(nameText);

    // 3. Format tag
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    const typeCol = document.createElement('div');
    typeCol.className = 'file-row-type';
    typeCol.textContent = TAGS[ext] || ext.replace('.', '').toUpperCase();

    // 4. File size
    const sizeCol = document.createElement('div');
    sizeCol.className = 'file-row-size';
    sizeCol.textContent = bytes(f.size);

    // 5. Status tag
    const statusCol = document.createElement('div');
    statusCol.className = 'file-row-status';
    const tag = document.createElement('span');
    if (!f.supported) {
      tag.className = 'status-tag warn';
      tag.textContent = 'Exceeds 2 MB';
      tag.title = 'File exceeds the 2 MB local processing limit.';
    } else {
      tag.className = 'status-tag ok';
      tag.textContent = 'Supported';
    }
    statusCol.append(tag);

    row.append(checkCol, nameCol, typeCol, sizeCol, statusCol);
    root.append(row);
  }
}

function renderCategories() {
  const root = el('categories');
  if (!root) return;
  root.replaceChildren();

  for (const name of CATEGORIES) {
    const count = state.organized[name] || 0;
    const card = document.createElement('div');
    card.className = 'category-card';
    card.setAttribute('role', 'listitem');

    const top = document.createElement('div');
    top.className = 'category-card-top';
    top.innerHTML = iconSvg('folder');

    const countSpan = document.createElement('span');
    countSpan.className = 'category-count';
    countSpan.textContent = `${count} file${count === 1 ? '' : 's'}`;
    top.append(countSpan);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'category-name';
    nameSpan.textContent = name;

    card.append(top, nameSpan);
    root.append(card);
  }
}

function validateFilename(stem) {
  if (!stem || !stem.trim()) {
    return 'Filename cannot be empty';
  }
  if (/[/\\:]/.test(stem)) {
    return 'Filename cannot contain slashes or colons';
  }
  if (stem.startsWith('.')) {
    return 'Filename cannot start with a dot';
  }
  return null;
}

function renderReview() {
  const root = el('review-list');
  if (!root) return;
  root.replaceChildren();

  if (el('review-label')) el('review-label').textContent = state.suggestions.length;
  if (el('stat-suggestions')) el('stat-suggestions').textContent = state.suggestions.length;
  if (el('nav-count')) el('nav-count').textContent = state.suggestions.length;

  const selectedCount = state.suggestions.filter(s => s.selected).length;
  const reviewSummary = el('review-selection');
  if (reviewSummary) {
    reviewSummary.textContent = state.suggestions.length
      ? `${selectedCount} of ${state.suggestions.length} selected`
      : 'No suggestions yet';
  }

  if (!state.suggestions.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <p class="empty-state-title">No suggestions pending.</p>
      <p class="empty-state-desc">Select inbox files above and click "Analyze selected" to generate organization proposals.</p>
    `;
    root.append(empty);
    updateButtons();
    return;
  }

  for (const s of state.suggestions) {
    const card = document.createElement('article');
    card.className = `review-card ${s.selected ? 'selected' : 'unselected'}`;

    // Checkbox column
    const checkWrap = document.createElement('div');
    checkWrap.className = 'review-card-check';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'file-checkbox';
    cb.checked = !!s.selected;
    cb.setAttribute('aria-label', `Include ${s.name} in organization batch`);
    cb.addEventListener('change', () => {
      s.selected = cb.checked;
      card.className = `review-card ${s.selected ? 'selected' : 'unselected'}`;
      updateButtons();
      const currentSelected = state.suggestions.filter(x => x.selected).length;
      if (reviewSummary) {
        reviewSummary.textContent = `${currentSelected} of ${state.suggestions.length} selected`;
      }
    });
    checkWrap.append(cb);

    // Body
    const body = document.createElement('div');
    body.className = 'review-card-body';

    // Top: Source -> Destination Preview
    const topRow = document.createElement('div');
    topRow.className = 'review-card-top';

    const origFile = document.createElement('span');
    origFile.className = 'review-original-file';
    origFile.innerHTML = iconSvg('file') + `<span>${s.name}</span>`;

    const arrow = document.createElement('span');
    arrow.innerHTML = iconSvg('arrow');

    const destPreview = document.createElement('span');
    destPreview.className = 'review-destination-preview';

    function updatePreview() {
      destPreview.textContent = `data/organized/${s.category}/${s.suggested_name}`;
    }
    updatePreview();

    topRow.append(origFile, arrow, destPreview);

    // Controls Grid (Category select + Filename input)
    const fieldsGrid = document.createElement('div');
    fieldsGrid.className = 'review-fields-grid';

    // Category Selector
    const catGroup = document.createElement('div');
    catGroup.className = 'review-field-group';
    const catLabel = document.createElement('label');
    catLabel.className = 'review-field-label';
    catLabel.textContent = 'Destination Category';
    const catSelect = document.createElement('select');
    catSelect.className = 'review-select';
    catSelect.setAttribute('aria-label', `Destination category for ${s.name}`);
    for (const c of CATEGORIES) {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      catSelect.append(opt);
    }
    catSelect.value = s.category;
    catSelect.addEventListener('change', () => {
      s.category = catSelect.value;
      updatePreview();
    });
    catGroup.append(catLabel, catSelect);

    // Filename Input with Validation
    const nameGroup = document.createElement('div');
    nameGroup.className = 'review-field-group';
    const nameLabel = document.createElement('label');
    nameLabel.className = 'review-field-label';
    nameLabel.textContent = 'Suggested Filename';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'review-input';
    nameInput.value = s.suggested_name;
    nameInput.maxLength = 120;
    nameInput.setAttribute('aria-label', `Destination filename for ${s.name}`);

    const errorMsg = document.createElement('div');
    errorMsg.className = 'field-error-msg';

    nameInput.addEventListener('input', () => {
      s.suggested_name = nameInput.value;
      const err = validateFilename(nameInput.value);
      if (err) {
        s.invalid = true;
        nameInput.classList.add('invalid');
        errorMsg.textContent = err;
      } else {
        s.invalid = false;
        nameInput.classList.remove('invalid');
        errorMsg.textContent = '';
      }
      updatePreview();
      updateButtons();
    });

    nameGroup.append(nameLabel, nameInput, errorMsg);
    fieldsGrid.append(catGroup, nameGroup);

    // Details: Summary & Reasoning
    const details = document.createElement('div');
    details.className = 'review-card-details';
    const sumP = document.createElement('p');
    sumP.className = 'review-summary-text';
    sumP.textContent = s.summary || 'No summary available.';
    const whyP = document.createElement('p');
    whyP.className = 'review-reason-text';
    whyP.textContent = s.reason ? `Reason: ${s.reason}` : 'No AI reasoning provided.';
    details.append(sumP, whyP);

    body.append(topRow, fieldsGrid, details);
    card.append(checkWrap, body);
    root.append(card);
  }

  updateButtons();
}

function renderHistory() {
  const activeBatch = state.history.find(b => !b.undone);
  const card = el('latest-batch-card');
  if (card) {
    card.replaceChildren();
    if (!activeBatch) {
      card.innerHTML = '<div class="batch-empty">No active batches available to undo.</div>';
    } else {
      const activeDiv = document.createElement('div');
      activeDiv.className = 'batch-card-active';

      const header = document.createElement('div');
      header.className = 'batch-card-header';
      header.innerHTML = `
        <span class="batch-id-badge">Batch #${activeBatch.id}</span>
        <span class="batch-time">${formatDate(activeBatch.at)}</span>
      `;

      const info = document.createElement('div');
      info.className = 'batch-info-text';
      info.textContent = `${activeBatch.count} file${activeBatch.count === 1 ? '' : 's'} organized. Undoing restores them back to data/inbox/.`;

      activeDiv.append(header, info);
      card.append(activeDiv);
    }
  }

  const logRoot = el('history-log');
  if (logRoot) {
    logRoot.replaceChildren();
    if (!state.history.length) {
      logRoot.innerHTML = '<div class="batch-empty">No organization history recorded yet.</div>';
      return;
    }

    for (const b of state.history) {
      const item = document.createElement('div');
      item.className = 'history-item';

      const left = document.createElement('div');
      left.className = 'history-item-left';
      left.innerHTML = `
        <span class="history-item-id">#${b.id}</span>
        <span class="history-item-meta">${b.count} file${b.count === 1 ? '' : 's'} · ${formatDate(b.at)}</span>
      `;

      const tag = document.createElement('span');
      tag.className = `history-tag ${b.undone ? 'undone' : 'active'}`;
      tag.textContent = b.undone ? 'Undone' : 'Active';

      item.append(left, tag);
      logRoot.append(item);
    }
  }
}

// Actions
async function loadSamples() {
  busy(true);
  try {
    const result = await request('/api/demo', {});
    await refresh();
    if (result.created && result.created.length > 0) {
      toast(`Loaded ${result.created.length} sample file(s) into inbox.`);
    } else {
      toast('Sample files are already present in data/inbox/.');
    }
  } catch (err) {
    toast(err.message, true);
  } finally {
    busy(false);
  }
}

async function analyze() {
  const selected = state.files.filter(f => f.supported && f.selected);
  if (!selected.length) {
    toast('Select at least 1 file to analyze.', true);
    return;
  }
  const names = selected.map(f => f.name);
  busy(true);
  const model = el('model-select') ? el('model-select').value : state.recommended_model;
  toast(`Asking ${model} to analyze ${names.length} file(s) locally. Please wait...`);

  try {
    const result = await request('/api/analyze', { files: names, model });
    state.suggestions = (result.suggestions || []).map(s => ({
      ...s,
      selected: true,
      invalid: !s.suggested_name || !s.suggested_name.trim()
    }));
    renderReview();

    const failureMsg = result.errors && result.errors.length
      ? ` (${result.errors.length} file(s) could not be read)`
      : '';
    toast(`AI completed ${state.suggestions.length} proposal(s) in ${result.elapsed_seconds}s.${failureMsg}`, !!(result.errors && result.errors.length));

    const reviewSection = el('review');
    if (reviewSection) {
      reviewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (err) {
    toast(err.message, true);
  } finally {
    busy(false);
  }
}

async function approve() {
  const toMove = state.suggestions.filter(s => s.selected && !s.invalid);
  if (!toMove.length) {
    toast('No valid suggestions selected for approval.', true);
    return;
  }

  const items = toMove.map(s => ({
    name: s.name,
    category: s.category,
    suggested_name: s.suggested_name
  }));

  busy(true);
  try {
    const result = await request('/api/apply', { items });
    const movedSet = new Set((result.moved || []).map(m => m.source));
    state.suggestions = state.suggestions.filter(s => !movedSet.has(s.name));
    await refresh();

    const movedCount = (result.moved || []).length;
    const errorCount = (result.errors || []).length;
    if (errorCount > 0) {
      toast(`${movedCount} file(s) organized. ${errorCount} file(s) encountered conflicts and were kept in inbox.`, true);
    } else {
      toast(`Successfully organized ${movedCount} file(s).`);
    }
  } catch (err) {
    toast(err.message, true);
  } finally {
    busy(false);
  }
}

async function undo() {
  const activeBatch = state.history.find(b => !b.undone);
  if (!activeBatch) {
    toast('No active organization batch to undo.', true);
    return;
  }

  const confirmed = window.confirm(
    `Undo batch #${activeBatch.id} (${activeBatch.count} files)?\n\nFiles will be restored to data/inbox/. Any conflicting files will be preserved safely without overwriting.`
  );
  if (!confirmed) return;

  busy(true);
  try {
    const result = await request('/api/undo', {});
    state.suggestions = [];
    await refresh();

    const restoredCount = (result.restored || []).length;
    const errorCount = (result.errors || []).length;
    if (errorCount > 0) {
      toast(`Restored ${restoredCount} file(s) to inbox. ${errorCount} file(s) could not be restored due to existing files.`, true);
    } else {
      toast(`Batch #${result.batch_id} undone: ${restoredCount} file(s) restored to inbox.`);
    }
  } catch (err) {
    toast(err.message, true);
  } finally {
    busy(false);
  }
}

function exportPlan() {
  if (!state.suggestions.length) return;
  const escapeCsv = (val) => '"' + String(val ?? '').replace(/"/g, '""') + '"';
  const rows = [
    ['Original Name', 'Suggested Name', 'Category', 'Summary', 'Reason', 'Approved'],
    ...state.suggestions.map(s => [
      s.name,
      s.suggested_name,
      s.category,
      s.summary,
      s.reason,
      s.selected ? 'Yes' : 'No'
    ])
  ];
  const content = rows.map(r => r.map(escapeCsv).join(',')).join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'slothdesk-plan.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Select All / Deselect All Handlers
function selectAllInbox() {
  const supported = state.files.filter(f => f.supported);
  if (!supported.length) return;

  let count = 0;
  for (const f of supported) {
    if (count < 12) {
      f.selected = true;
      count++;
    } else {
      f.selected = false;
    }
  }
  if (supported.length > 12) {
    toast('Selected the first 12 files (maximum batch size is 12).');
  }
  renderFiles();
  updateButtons();
}

function deselectAllInbox() {
  for (const f of state.files) {
    f.selected = false;
  }
  renderFiles();
  updateButtons();
}

function selectAllReview() {
  for (const s of state.suggestions) {
    s.selected = true;
  }
  renderReview();
}

function deselectAllReview() {
  for (const s of state.suggestions) {
    s.selected = false;
  }
  renderReview();
}

// Event Listeners
if (el('refresh-button')) el('refresh-button').addEventListener('click', refresh);
if (el('demo-button')) el('demo-button').addEventListener('click', loadSamples);
if (el('analyze-button')) el('analyze-button').addEventListener('click', analyze);
if (el('apply-button')) el('apply-button').addEventListener('click', approve);
if (el('undo-button')) el('undo-button').addEventListener('click', undo);
if (el('export-button')) el('export-button').addEventListener('click', exportPlan);
if (el('select-all-inbox')) el('select-all-inbox').addEventListener('click', selectAllInbox);
if (el('deselect-all-inbox')) el('deselect-all-inbox').addEventListener('click', deselectAllInbox);
if (el('select-all-review')) el('select-all-review').addEventListener('click', selectAllReview);
if (el('deselect-all-review')) el('deselect-all-review').addEventListener('click', deselectAllReview);

// Initial Load
refresh();
