'use strict';

// DOM element selector helper
const el = (id) => document.getElementById(id);

// Application State
const state = {
  files: [],          // [{ name, size, supported, selected, analyzing, analysisStatus }]
  suggestions: [],    // [{ name, category, suggested_name, summary, reason, selected, invalid, isNew }]
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

function showErrorAlert(title, message, actionText, actionFn) {
  const alertEl = el('error-alert');
  const titleEl = el('error-alert-title');
  const msgEl = el('error-alert-message');
  const actionBtn = el('error-alert-action');
  if (!alertEl || !titleEl || !msgEl) return;

  titleEl.textContent = title || 'System Alert';
  msgEl.textContent = message || '';

  if (actionBtn) {
    if (actionText && typeof actionFn === 'function') {
      actionBtn.textContent = actionText;
      actionBtn.hidden = false;
      actionBtn.onclick = () => {
        hideErrorAlert();
        actionFn();
      };
    } else {
      actionBtn.hidden = true;
      actionBtn.onclick = null;
    }
  }

  alertEl.hidden = false;
}

function hideErrorAlert() {
  const alertEl = el('error-alert');
  if (alertEl) alertEl.hidden = true;
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

// Theme Management: Default Warm Ivory (light) and Emerald Night (dark)
function initTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  updateThemeUI(current);
}

function updateThemeUI(theme) {
  const label = el('theme-toggle-label');
  const icon = el('theme-icon');
  if (label) {
    label.textContent = theme === 'dark' ? 'Warm Ivory' : 'Emerald Night';
  }
  if (icon) {
    if (theme === 'dark') {
      icon.innerHTML = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>';
    } else {
      icon.innerHTML = '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>';
    }
  }
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.content = theme === 'dark' ? '#101C19' : '#F7F3EA';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('slothdesk-theme', next);
  updateThemeUI(next);
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
      analyzeBtn.title = 'Select at least 1 file from the inbox to analyze (Alt+A).';
    } else {
      analyzeBtn.title = `Analyze ${selectedCount} selected file(s) with local AI (Alt+A).`;
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
  if (el('refresh-button')) {
    el('refresh-button').disabled = state.working;
    el('refresh-button').title = 'Refresh inbox and categories (Alt+R)';
  }
  if (el('select-all-inbox')) {
    el('select-all-inbox').disabled = state.working || supportedCount === 0;
    el('select-all-inbox').title = 'Select all supported inbox files (Alt+S)';
  }
  if (el('deselect-all-inbox')) {
    el('deselect-all-inbox').disabled = state.working || selectedCount === 0;
    el('deselect-all-inbox').title = 'Deselect all inbox files (Alt+D)';
  }

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
      applyBtn.title = 'Select at least 1 suggestion to approve (Alt+O).';
    } else {
      applyBtn.title = `Move ${selectedSuggestions.length} approved file(s) to data/organized/ (Alt+O)`;
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
    el('undo-button').title = activeBatch
      ? `Undo batch #${activeBatch.id} (${activeBatch.moves ? activeBatch.moves.length : 0} files) (Alt+Z)`
      : 'No active batches to undo (Alt+Z)';
  }
}

async function refresh() {
  try {
    const [statusData, filesData, historyData] = await Promise.all([
      request('/api/status'),
      request('/api/files'),
      request('/api/history')
    ]);

    // Preserve previous file selection, analysisStatus, and errorReason where applicable
    const prevMap = new Map(state.files.map(f => [f.name, f]));
    state.files = filesData.files.map(f => {
      const prev = prevMap.get(f.name);
      return {
        ...f,
        selected: f.supported && (prev ? prev.selected : (prevMap.size === 0 && filesData.files.length <= 12)),
        analyzing: false,
        analysisStatus: prev ? prev.analysisStatus : null,
        errorReason: prev ? prev.errorReason : null
      };
    });

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
      const savedModel = localStorage.getItem('slothdesk-model');
      const prevVal = select.value || savedModel;
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
        statusWrap.title = 'Ollama is unreachable on localhost:11434. Run: ollama serve';
        showErrorAlert(
          'Ollama Server Offline',
          'Local Ollama is not running on localhost:11434. Start Ollama with "ollama serve" in your terminal to enable AI suggestions.',
          'Retry connection',
          refresh
        );
      } else if (!state.installed.length) {
        dot.classList.add('error');
        textSpan.textContent = 'No local model';
        statusWrap.title = 'No models found in Ollama. Run: ollama pull qwen2.5:1.5b';
        showErrorAlert(
          'No Model Installed',
          'Ollama is running, but no models were found. Install the recommended model with "ollama pull qwen2.5:1.5b".',
          'Refresh models',
          refresh
        );
      } else {
        dot.classList.add('ready');
        textSpan.textContent = 'Model ready';
        const activeModelName = select ? select.value : state.recommended_model;
        statusWrap.title = `Ollama connected. Active: ${activeModelName} (${state.installed.length} available).`;
        const alertTitle = el('error-alert-title');
        if (alertTitle && (alertTitle.textContent.includes('Ollama') || alertTitle.textContent.includes('Model'))) {
          hideErrorAlert();
        }
      }
      statusWrap.append(dot, textSpan);
    }

    // Counters
    if (el('inbox-label')) el('inbox-label').textContent = state.files.length;
    if (el('stat-inbox')) el('stat-inbox').textContent = state.files.length;

    const totalOrganized = Object.values(state.organized).reduce((acc, n) => acc + n, 0);
    if (el('stat-organized')) el('stat-organized').textContent = totalOrganized;

    const activeBatchCount = state.history.filter(b => !b.undone).length;
    if (el('stat-batches')) {
      el('stat-batches').textContent = `${activeBatchCount} active ${activeBatchCount === 1 ? 'batch' : 'batches'}`;
    }

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

  // Retry failed toolbar toggle
  const failedFiles = state.files.filter(f => f.supported && f.analysisStatus === 'error');
  const retryBtn = el('retry-failed-btn');
  const retrySep = el('retry-failed-sep');
  if (retryBtn) {
    if (failedFiles.length > 0) {
      retryBtn.textContent = `Retry failed (${failedFiles.length})`;
      retryBtn.hidden = false;
      if (retrySep) retrySep.hidden = false;
    } else {
      retryBtn.hidden = true;
      if (retrySep) retrySep.hidden = true;
    }
  }

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
    let rowClasses = 'file-row';
    if (f.selected) rowClasses += ' selected';
    if (!f.supported) rowClasses += ' unsupported';
    if (f.analyzing) rowClasses += ' file-row-analyzing';
    row.className = rowClasses;
    row.id = `file-row-${f.name.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

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

    if (f.analyzing) {
      tag.className = 'status-tag active-scan';
      tag.textContent = 'Analyzing...';
    } else if (f.analysisStatus === 'done') {
      tag.className = 'status-tag ok';
      tag.textContent = 'Analyzed';
    } else if (f.analysisStatus === 'error') {
      tag.className = 'status-tag warn';
      tag.textContent = 'Failed';
      tag.title = f.errorReason || 'Analysis failed. Click Retry failed to run again.';
    } else if (!f.supported) {
      tag.className = 'status-tag warn';
      tag.textContent = 'Exceeds 2 MB';
      tag.title = 'File exceeds the 2 MB local processing limit.';
    } else {
      tag.className = 'status-tag ok';
      tag.textContent = 'Ready';
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

  const totalOrganized = Object.values(state.organized).reduce((acc, n) => acc + n, 0);
  const subTitle = el('organized-subtitle');
  if (subTitle) {
    subTitle.textContent = `7 categories · ${totalOrganized} file${totalOrganized === 1 ? '' : 's'} organized.`;
  }

  for (const name of CATEGORIES) {
    const count = state.organized[name] || 0;
    const card = document.createElement('div');
    card.className = 'category-card';
    card.id = `category-card-${name.toLowerCase()}`;
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

function createSuggestionCard(s) {
  const card = document.createElement('article');
  card.className = `review-card ${s.selected ? 'selected' : 'unselected'} ${s.isNew ? 'entering' : ''}`;

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
    const reviewSummary = el('review-selection');
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
  return card;
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
      <p class="empty-state-desc">Select inbox files on the left and click "Analyze selected" to generate organization proposals.</p>
    `;
    root.append(empty);
    updateButtons();
    return;
  }

  for (const s of state.suggestions) {
    const card = createSuggestionCard(s);
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

// Signature Local AI Analysis: Genuine per-file live progress and smooth card entry
async function analyze() {
  const selected = state.files.filter(f => f.supported && f.selected);
  if (!selected.length) {
    toast('Select at least 1 file to analyze.', true);
    return;
  }

  busy(true);
  const model = el('model-select') ? el('model-select').value : state.recommended_model;

  // Show live analysis banner with reset state
  const banner = el('analysis-banner');
  const bannerTitle = el('analysis-title');
  const bannerSubtext = el('analysis-subtext');
  const bannerFill = el('analysis-progress-fill');

  if (banner) {
    banner.className = 'analysis-banner';
    banner.hidden = false;
    if (bannerTitle) bannerTitle.textContent = 'Local AI Inference in Progress';
    if (bannerSubtext) bannerSubtext.textContent = `Preparing ${selected.length} file(s)...`;
    if (bannerFill) bannerFill.style.width = '0%';
  }

  let completedCount = 0;
  let errorCount = 0;
  const totalCount = selected.length;
  const startTime = Date.now();

  try {
    for (let i = 0; i < totalCount; i++) {
      const file = selected[i];

      // Mark current file as analyzing
      file.analyzing = true;
      file.analysisStatus = 'processing';
      file.errorReason = null;
      renderFiles();

      const remaining = totalCount - i - 1;
      if (bannerSubtext) {
        bannerSubtext.textContent = `Analyzing ${i + 1} of ${totalCount}: ${file.name} (${completedCount} completed, ${errorCount} failed, ${remaining} remaining)`;
      }
      if (bannerFill) {
        bannerFill.style.width = `${Math.round(((completedCount + errorCount) / totalCount) * 100)}%`;
      }

      try {
        // Real Ollama inference request for the single current file
        const result = await request('/api/analyze', { files: [file.name], model });
        if (result.suggestions && result.suggestions.length > 0) {
          const proposal = {
            ...result.suggestions[0],
            selected: true,
            invalid: false,
            isNew: true
          };

          // Upsert suggestion: replace existing card for this file or append
          const existingIdx = state.suggestions.findIndex(s => s.name === file.name);
          if (existingIdx >= 0) {
            state.suggestions[existingIdx] = proposal;
          } else {
            state.suggestions.push(proposal);
          }

          file.analyzing = false;
          file.analysisStatus = 'done';
          file.errorReason = null;
          completedCount++;
        } else if (result.errors && result.errors.length > 0) {
          file.analyzing = false;
          file.analysisStatus = 'error';
          file.errorReason = result.errors[0].message;
          errorCount++;
          toast(`${file.name}: ${result.errors[0].message}`, true);
        }
      } catch (fileErr) {
        file.analyzing = false;
        file.analysisStatus = 'error';
        file.errorReason = fileErr.message;
        errorCount++;
        toast(`${file.name}: ${fileErr.message}`, true);
      }

      if (bannerFill) {
        bannerFill.style.width = `${Math.round(((completedCount + errorCount) / totalCount) * 100)}%`;
      }
      renderFiles();
      renderReview();
      updateButtons();
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (errorCount === 0) {
      if (bannerTitle) bannerTitle.textContent = 'Analysis Complete';
      if (bannerSubtext) {
        bannerSubtext.textContent = `Analysis complete: ${completedCount} proposal(s) generated in ${elapsed}s.`;
      }
      toast(`AI finished ${completedCount} proposal(s) in ${elapsed}s.`);
      setTimeout(() => {
        if (banner) banner.hidden = true;
      }, 1800);
    } else if (completedCount > 0 && errorCount > 0) {
      if (banner) banner.classList.add('warning');
      if (bannerTitle) bannerTitle.textContent = 'Analysis Finished with Warnings';
      if (bannerSubtext) {
        bannerSubtext.textContent = `Partial completion: ${completedCount} succeeded, ${errorCount} failed in ${elapsed}s.`;
      }
      showErrorAlert(
        'Partial Analysis Failure',
        `${errorCount} file(s) failed during analysis. Successful proposals have been preserved in the review list. Click below to retry only the failed files.`,
        'Retry failed files',
        retryFailed
      );
      setTimeout(() => {
        if (banner) banner.hidden = true;
      }, 3500);
    } else {
      if (banner) {
        banner.classList.add('error');
        if (bannerFill) bannerFill.style.width = '0%';
      }
      if (bannerTitle) bannerTitle.textContent = 'Analysis Failed';
      if (bannerSubtext) {
        bannerSubtext.textContent = `Analysis failed: 0 proposals generated, ${errorCount} file(s) failed.`;
      }
      showErrorAlert(
        'Analysis Failed',
        `None of the ${errorCount} selected file(s) could be analyzed. Ensure Ollama is running ('ollama serve') and retry.`,
        'Retry failed files',
        retryFailed
      );
      setTimeout(() => {
        if (banner) banner.hidden = true;
      }, 3500);
    }

  } catch (err) {
    showErrorAlert('Analysis Error', err.message);
    toast(err.message, true);
    if (banner) {
      if (bannerFill) bannerFill.style.width = '0%';
      banner.hidden = true;
    }
  } finally {
    for (const f of state.files) {
      f.analyzing = false;
    }
    renderFiles();
    busy(false);
  }
}

async function retryFailed() {
  const failed = state.files.filter(f => f.supported && f.analysisStatus === 'error');
  if (!failed.length) {
    toast('No failed files to retry.');
    return;
  }
  for (const f of state.files) {
    f.selected = f.supported && f.analysisStatus === 'error';
  }
  renderFiles();
  updateButtons();
  await analyze();
}

// File Organization Approval with Leaving & Bump Animations
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

    // Animate moving rows out of the inbox table
    for (const moved of result.moved || []) {
      const rowId = `file-row-${moved.source.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      const rowEl = el(rowId);
      if (rowEl) {
        rowEl.classList.add('file-row-leaving');
      }

      // Animate category card bump
      const cat = moved.destination.split('/')[0];
      const catCard = el(`category-card-${cat.toLowerCase()}`);
      if (catCard) {
        catCard.classList.remove('category-bump');
        void catCard.offsetWidth; // Trigger reflow for re-animation
        catCard.classList.add('category-bump');
      }
    }

    // Wait 220ms for leaving animation to finish before updating state
    await new Promise(resolve => setTimeout(resolve, 220));

    state.suggestions = state.suggestions.filter(s => !movedSet.has(s.name));
    await refresh();

    const movedCount = (result.moved || []).length;
    const errCount = (result.errors || []).length;
    if (errCount > 0) {
      const firstMsg = result.errors[0]?.message || 'File conflict occurred';
      showErrorAlert(
        'Organization Warning',
        `${movedCount} file(s) organized. ${errCount} file(s) encountered conflicts and were kept in inbox: ${firstMsg}`
      );
      toast(`${movedCount} file(s) organized. ${errCount} file(s) encountered conflicts and were kept in inbox.`, true);
    } else {
      hideErrorAlert();
      toast(`Successfully organized ${movedCount} file(s).`);
    }
  } catch (err) {
    showErrorAlert('Organization Error', err.message);
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

  const fileText = `${activeBatch.count} file${activeBatch.count === 1 ? '' : 's'}`;
  const confirmed = window.confirm(
    `Undo batch #${activeBatch.id} (${fileText})?\n\nFiles will be restored to data/inbox/. Any conflicting files will be preserved safely without overwriting.`
  );
  if (!confirmed) return;

  busy(true);
  try {
    const result = await request('/api/undo', {});
    state.suggestions = [];
    await refresh();

    const restoredCount = (result.restored || []).length;
    const errCount = (result.errors || []).length;
    if (errCount > 0) {
      const firstMsg = result.errors[0]?.message || 'File conflict occurred';
      showErrorAlert(
        'Undo Conflict',
        `Restored ${restoredCount} file(s) to inbox. ${errCount} file(s) could not be restored due to existing files: ${firstMsg}`
      );
      toast(`Restored ${restoredCount} file(s) to inbox. ${errCount} file(s) could not be restored due to existing files.`, true);
    } else {
      hideErrorAlert();
      toast(`Batch #${result.batch_id} undone: ${restoredCount} file(s) restored to inbox.`);
    }
  } catch (err) {
    showErrorAlert('Undo Error', err.message);
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

// Keyboard Shortcuts Modal Management
let lastFocusedBeforeDialog = null;

function openShortcutsDialog() {
  const dialog = el('shortcuts-dialog');
  if (!dialog) return;
  lastFocusedBeforeDialog = document.activeElement;
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
  const closeBtn = el('shortcuts-dialog-close');
  if (closeBtn) closeBtn.focus();
}

function closeShortcutsDialog() {
  const dialog = el('shortcuts-dialog');
  if (!dialog) return;
  if (typeof dialog.close === 'function') {
    dialog.close();
  } else {
    dialog.removeAttribute('open');
  }
  if (lastFocusedBeforeDialog && typeof lastFocusedBeforeDialog.focus === 'function') {
    lastFocusedBeforeDialog.focus();
  }
}

// Global Keyboard Shortcuts
function handleGlobalKeydown(e) {
  const active = document.activeElement;
  const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable);
  const dialog = el('shortcuts-dialog');
  const isDialogOpen = dialog && dialog.open;

  // Never trigger application shortcuts when user is typing in inputs or editing filenames
  if (isInput) return;

  // 'Escape' closes error alert if dialog is not open
  if (e.key === 'Escape' && !isDialogOpen) {
    const errorAlert = el('error-alert');
    if (errorAlert && !errorAlert.hidden) {
      e.preventDefault();
      hideErrorAlert();
      return;
    }
  }

  // '?' or '/' key toggles shortcuts dialog
  if ((e.key === '?' || e.key === '/') && !e.altKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    if (isDialogOpen) {
      closeShortcutsDialog();
    } else {
      openShortcutsDialog();
    }
    return;
  }

  // Do not fire action shortcuts while a modal dialog is active
  if (isDialogOpen) return;

  // Alt + key shortcuts (avoids browser collisions)
  if (e.altKey && !e.ctrlKey && !e.metaKey) {
    const key = e.key.toLowerCase();
    if (key === 'a') {
      e.preventDefault();
      const analyzeBtn = el('analyze-button');
      if (analyzeBtn && !analyzeBtn.disabled) analyze();
    } else if (key === 'o') {
      e.preventDefault();
      const applyBtn = el('apply-button');
      if (applyBtn && !applyBtn.disabled) approve();
    } else if (key === 's') {
      e.preventDefault();
      selectAllInbox();
    } else if (key === 'd') {
      e.preventDefault();
      deselectAllInbox();
    } else if (key === 'r') {
      e.preventDefault();
      refresh();
    } else if (key === 'z') {
      e.preventDefault();
      const undoBtn = el('undo-button');
      if (undoBtn && !undoBtn.disabled) undo();
    } else if (key === 't') {
      e.preventDefault();
      toggleTheme();
    }
  }
}

// Event Listeners
if (el('theme-toggle-btn')) el('theme-toggle-btn').addEventListener('click', toggleTheme);
if (el('refresh-button')) el('refresh-button').addEventListener('click', refresh);
if (el('demo-button')) el('demo-button').addEventListener('click', loadSamples);
if (el('analyze-button')) el('analyze-button').addEventListener('click', analyze);
if (el('apply-button')) el('apply-button').addEventListener('click', approve);
if (el('undo-button')) el('undo-button').addEventListener('click', undo);
if (el('export-button')) el('export-button').addEventListener('click', exportPlan);
if (el('select-all-inbox')) el('select-all-inbox').addEventListener('click', selectAllInbox);
if (el('deselect-all-inbox')) el('deselect-all-inbox').addEventListener('click', deselectAllInbox);
if (el('retry-failed-btn')) el('retry-failed-btn').addEventListener('click', retryFailed);
if (el('error-alert-close')) el('error-alert-close').addEventListener('click', hideErrorAlert);
if (el('select-all-review')) el('select-all-review').addEventListener('click', selectAllReview);
if (el('deselect-all-review')) el('deselect-all-review').addEventListener('click', deselectAllReview);
if (el('shortcuts-btn')) el('shortcuts-btn').addEventListener('click', openShortcutsDialog);
if (el('shortcuts-dialog-close')) el('shortcuts-dialog-close').addEventListener('click', closeShortcutsDialog);
if (el('shortcuts-dialog-dismiss')) el('shortcuts-dialog-dismiss').addEventListener('click', closeShortcutsDialog);

const shortcutsDialog = el('shortcuts-dialog');
if (shortcutsDialog) {
  shortcutsDialog.addEventListener('click', (e) => {
    if (e.target === shortcutsDialog) closeShortcutsDialog();
  });
  shortcutsDialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeShortcutsDialog();
  });
}

window.addEventListener('keydown', handleGlobalKeydown);

if (el('model-select')) {
  el('model-select').addEventListener('change', (e) => {
    localStorage.setItem('slothdesk-model', e.target.value);
    const statusWrap = el('model-status');
    if (statusWrap && state.connected) {
      statusWrap.title = `Ollama connected. Selected model: ${e.target.value} (${state.installed.length} available).`;
    }
  });
}

// Initialization
initTheme();
refresh();
