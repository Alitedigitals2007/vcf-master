/* ==========================================================================
   ALITE VCF Manager - Hybrid Processor (Server + Client-Side)
   Supports 200MB+ files via client-side Web Worker processing
   ========================================================================== */

const API_BASE = '/api';

// Constants
const MAX_UPLOAD_SIZE = 4 * 1024 * 1024; // 4MB safe limit for Vercel serverless

// State
let currentSessionId = null;
let currentPage = 1;
let allContacts = [];
const PAGE_LIMIT = 50;
let activeTab = 'preview';
let selectedFiles = [];
let useLocalProcessing = true;
let worker = null;

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const fileActions = document.getElementById('fileActions');
const fileCount = document.getElementById('fileCount');
const addFilesBtn = document.getElementById('addFilesBtn');
const clearBtn = document.getElementById('clearBtn');
const processBtn = document.getElementById('processBtn');
const mainContent = document.getElementById('mainContent');
const resultsSection = document.getElementById('resultsSection');
const namingFormat = document.getElementById('namingFormat');
const prefixInput = document.getElementById('prefixInput');
const prefixPreview = document.getElementById('prefixPreview');
const renameContacts = document.getElementById('renameContacts');
const renameDuplicatesOnly = document.getElementById('renameDuplicatesOnly');
const detectDuplicates = document.getElementById('detectDuplicates');
const removeDuplicates = document.getElementById('removeDuplicates');
const statsGrid = document.getElementById('statsGrid');
const tableBody = document.getElementById('tableBody');
const pagination = document.getElementById('pagination');
const duplicatesList = document.getElementById('duplicatesList');
const noDuplicates = document.getElementById('noDuplicates');
const duplicatesBadge = document.getElementById('duplicatesBadge');
const tabBtns = document.querySelectorAll('.tab');
const tabPanels = document.querySelectorAll('.tab-panel');
const backBtn = document.getElementById('backBtn');
const downloadAll = document.getElementById('downloadAll');
const downloadUnique = document.getElementById('downloadUnique');
const downloadDuplicates = document.getElementById('downloadDuplicates');
const downloadReport = document.getElementById('downloadReport');
const toastContainer = document.getElementById('toastContainer');
const processingMode = document.getElementById('processingMode');
const localOption = document.getElementById('localOption');
const serverOption = document.getElementById('serverOption');
const progressSection = document.getElementById('progressSection');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const progressStage = document.getElementById('progressStage');

// Init
function init() {
    bindEvents();
    updatePrefixPreview();
    // Set default mode to local
    setProcessingMode('local');
    checkWorkerSupport();
}

function checkWorkerSupport() {
    if (typeof Worker !== 'undefined') {
        try {
            // Cache-bust with version parameter
            worker = new Worker('minimal-worker.js?v=1');
            worker.onmessage = handleWorkerMessage;
            worker.onerror = handleWorkerError;
            console.log('Worker initialized successfully');
            
            // Test worker with ping
            worker.postMessage({ type: 'ping' });
        } catch (e) {
            console.error('Worker creation failed:', e);
            showToast('Worker init failed: ' + e.message, 'error');
            if (localOption) localOption.style.display = 'none';
            if (processingMode) processingMode.style.display = 'none';
        }
    } else {
        // Hide local option if no worker support
        if (localOption) localOption.style.display = 'none';
        if (processingMode) processingMode.style.display = 'none';
    }
}

function handleWorkerMessage(e) {
    const { type, data, error } = e.data;
    if (type === 'progress') {
        updateProgress(data);
    } else if (type === 'complete') {
        finishLocalProcessing(data);
    } else if (type === 'error') {
        showToast('Local processing failed: ' + error, 'error');
        setLoading(false);
    }
}

function handleWorkerError(err) {
    console.error('Worker error event:', err);
    // ErrorEvent has: message, filename, lineno, colno, error
    const msg = err?.message || err?.error?.message || (err?.filename ? err.filename + ':' + err.lineno : '') || (err?.type ? 'Worker ' + err.type : '') || 'Unknown error';
    showToast('Worker error: ' + msg, 'error');
    setLoading(false);
    showProgress(false);
}

// Bind Events
function bindEvents() {
    // Drop zone
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => {
        dropZone.addEventListener(e, preventDefaults, false);
        document.body.addEventListener(e, preventDefaults, false);
    });
    ['dragenter', 'dragover'].forEach(e => dropZone.addEventListener(e, () => dropZone.classList.add('drag-over'), false));
    ['dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, () => dropZone.classList.remove('drag-over'), false));
    dropZone.addEventListener('drop', handleDrop, false);
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
    fileInput.addEventListener('change', handleFiles);
    addFilesBtn.addEventListener('click', () => fileInput.click());
    clearBtn.addEventListener('click', clearFiles);
    processBtn.addEventListener('click', processFiles);

    // Processing mode toggle
    if (localOption) localOption.addEventListener('change', () => setProcessingMode('local'));
    if (serverOption) serverOption.addEventListener('change', () => setProcessingMode('server'));

    // Options
    renameContacts.addEventListener('change', toggleNamingFormat);
    prefixInput.addEventListener('input', updatePrefixPreview);

    // Tabs
    tabBtns.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

    // Downloads
    [downloadAll, downloadUnique, downloadDuplicates, downloadReport].forEach(btn => btn.addEventListener('click', () => download(btn.dataset.type)));

    // Back
    backBtn.addEventListener('click', resetToHome);
}

function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

function setProcessingMode(mode) {
    useLocalProcessing = mode === 'local';
    if (localOption) localOption.checked = useLocalProcessing;
    if (serverOption) serverOption.checked = !useLocalProcessing;
    
    // Show/hide file size warning
    const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
    const warning = document.getElementById('sizeWarning');
    if (warning) {
        warning.style.display = (!useLocalProcessing && totalSize > MAX_UPLOAD_SIZE) ? 'block' : 'none';
    }
}

// File Handling
function handleDrop(e) {
    const files = [...e.dataTransfer.files].filter(f => f.name.toLowerCase().endsWith('.vcf'));
    addFiles(files);
}

function handleFiles(e) {
    const files = [...e.target.files].filter(f => f.name.toLowerCase().endsWith('.vcf'));
    addFiles(files);
    fileInput.value = '';
}

function addFiles(files) {
    let added = 0;
    let totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
    
    files.forEach(file => {
        if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
            totalSize += file.size;
            // Local mode: virtually unlimited (browser memory ~1-2GB)
            // Server mode: 4.5MB hard limit
            if (!useLocalProcessing && totalSize > MAX_UPLOAD_SIZE) {
                showToast(`File "${escapeHtml(file.name)}" would exceed 4MB server limit. Enable "Local Processing" for large files (200MB+).`, 'error');
                return;
            }
            selectedFiles.push(file);
            added++;
        }
    });
    if (added > 0) {
        renderFileList();
        updateUI();
        showToast(`Added ${added} file${added > 1 ? 's' : ''}`, 'success');
    }
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderFileList();
    updateUI();
}

function clearFiles() {
    selectedFiles = [];
    renderFileList();
    updateUI();
}

function renderFileList() {
    if (selectedFiles.length === 0) {
        fileList.innerHTML = '';
        fileCount.hidden = true;
        return;
    }
    const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
    fileCount.hidden = false;
    fileCount.textContent = `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} · ${formatFileSize(totalSize)}${useLocalProcessing ? ' (Local: 200MB+)' : totalSize > MAX_UPLOAD_SIZE ? ' ⚠️ >4MB' : ''}`;
    fileList.innerHTML = selectedFiles.map((file, i) => `
        <li class="file-item" style="animation-delay: ${i * 40}ms">
            <div class="file-info">
                <div class="file-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                <div>
                    <div class="file-name">${escapeHtml(file.name)}</div>
                    <div class="file-size">${formatFileSize(file.size)}</div>
                </div>
            </div>
            <button class="btn btn-secondary" onclick="removeFile(${i})" style="height:28px;padding:0 8px;font-size:.7rem;">Remove</button>
        </li>
    `).join('');
}

function updateUI() {
    const hasFiles = selectedFiles.length > 0;
    processBtn.disabled = !hasFiles;
    fileActions.hidden = !hasFiles;
    
    const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
    const warning = document.getElementById('sizeWarning');
    if (warning) {
        warning.style.display = (!useLocalProcessing && totalSize > MAX_UPLOAD_SIZE) ? 'block' : 'none';
    }
}

function formatFileSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

function toggleNamingFormat() {
    namingFormat.hidden = !renameContacts.checked;
}

function updatePrefixPreview() {
    const p = prefixInput.value.trim() || 'Contact';
    prefixPreview.textContent = `${p} 0001`;
}

// Processing
async function processFiles() {
    if (selectedFiles.length === 0) return;

    if (useLocalProcessing) {
        await processFilesLocal();
    } else {
        await processFilesServer();
    }
}

async function processFilesLocal() {
    if (!worker) {
        showToast('Local processing not supported in this browser', 'error');
        return;
    }

    setLoading(true);
    showProgress(true);
    updateProgress({ stage: 'starting', percent: 0 });

    try {
        const options = {
            formatType: document.getElementById('phoneFormat').value,
            namingPrefix: prefixInput.value.trim() || 'Contact',
            detectDuplicates: detectDuplicates.checked,
            removeDuplicates: removeDuplicates.checked,
            renameContacts: renameContacts.checked,
            renameDuplicatesOnly: renameDuplicatesOnly.checked,
            duplicateStrategy: document.getElementById('duplicateStrategy').value
        };

        // Read files in main thread, pass content to worker
        const fileData = [];
        for (const file of selectedFiles) {
            const content = await readFileAsText(file);
            fileData.push({ name: file.name, content, size: file.size });
        }
        
        console.log('Sending to worker:', fileData.length, 'files, total chars:', fileData.reduce((sum, f) => sum + f.content.length, 0));
        
        // Add timeout - 5 minutes for large files
        const timeout = setTimeout(() => {
            showToast('Worker timeout (5min) - file may be too large for browser processing', 'error');
            setLoading(false);
            showProgress(false);
        }, 300000); // 5 minutes

        // Listen for first response
        const handleMessage = (e) => {
            clearTimeout(timeout);
            worker.onmessage = handleWorkerMessage; // restore normal handler
            handleWorkerMessage(e);
        };
        
        worker.onmessage = handleMessage;
        worker.postMessage({ files: fileData, options });
        
    } catch (err) {
        showToast('Local processing error: ' + err.message, 'error');
        setLoading(false);
        showProgress(false);
    }
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

function updateProgress(data) {
    let percent = 0;
    let text = '';
    
    switch (data.stage) {
        case 'reading':
            percent = Math.min(30, (data.file / data.total) * 30);
            text = `Reading file ${data.file} of ${data.total}...`;
            break;
        case 'parsed':
            percent = 40;
            text = `Parsed ${data.count} contacts`;
            break;
        case 'duplicates':
            percent = 70;
            text = `Found ${data.stats.duplicateNumbers} duplicated numbers`;
            break;
        case 'complete':
            percent = 100;
            text = 'Complete!';
            break;
        default:
            percent = data.percent || 0;
            text = data.text || 'Processing...';
    }
    
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${Math.round(percent)}%`;
    progressStage.textContent = text;
}

function finishLocalProcessing(result) {
    // Normalize contacts from camelCase (worker) to snake_case (frontend)
    const normalizeContact = (c) => ({
        name: c.name,
        phones: c.phones,
        emails: c.emails,
        normalized_phones: c.normalizedPhones,
        is_duplicate: c.isDuplicate,
        duplicate_group: c.duplicateGroup
    });
    
    allContacts = result.contacts.map(normalizeContact);
    currentSessionId = 'local-' + Date.now();
    
    // Store results for downloads
    window.localResults = result;
    
    // Normalize stats from camelCase (worker) to snake_case (frontend)
    const stats = result.stats;
    const normalizedStats = {
        files_processed: stats.filesProcessed || 1,
        total_contacts: stats.totalContacts,
        unique_contacts: stats.uniqueContacts,
        duplicate_entries: stats.duplicateEntries,
        duplicate_numbers: stats.duplicateNumbers,
        most_duplicated: stats.mostDuplicated
    };
    
    showResults(normalizedStats);
    showResultsView();
    showProgress(false);
    setLoading(false);
    showToast('Processing complete (local)', 'success');
}

async function processFilesServer() {
    setLoading(true);
    const formData = new FormData();
    selectedFiles.forEach(f => formData.append('files', f));
    formData.append('format_type', document.getElementById('phoneFormat').value);
    formData.append('naming_prefix', prefixInput.value.trim() || 'Contact');
    formData.append('detect_duplicates', detectDuplicates.checked);
    formData.append('remove_duplicates', removeDuplicates.checked);
    formData.append('rename_contacts', renameContacts.checked);
    formData.append('rename_duplicates_only', renameDuplicatesOnly.checked);
    formData.append('duplicate_strategy', document.getElementById('duplicateStrategy').value);

    try {
        const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Processing failed' }));
            let msg = err.detail || 'Processing failed';
            if (msg.includes('PAYLOAD_TOO_LARGE') || res.status === 413) {
                msg = 'File too large for server (max 4.5MB). Enable "Local Processing" for large files.';
            }
            throw new Error(msg);
        }
        const data = await res.json();
        currentSessionId = data.session_id;
        allContacts = data.preview || [];
        await loadPreviewPage(1);
        showResults(data.stats);
        showResultsView();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        setLoading(false);
    }
}

function setLoading(loading) {
    processBtn.setAttribute('aria-busy', loading);
    processBtn.disabled = loading || selectedFiles.length === 0;
}

function showProgress(show) {
    if (progressSection) progressSection.hidden = !show;
}

function showResultsView() {
    mainContent.querySelectorAll('.card:not(#resultsSection)').forEach(c => c.hidden = true);
    resultsSection.hidden = false;
    resultsSection.scrollIntoView({ behavior: 'smooth' });
    setLoading(false);
}

function resetToHome() {
    currentSessionId = null;
    currentPage = 1;
    allContacts = [];
    selectedFiles = [];
    window.localResults = null;
    mainContent.querySelectorAll('.card').forEach(c => c.hidden = false);
    resultsSection.hidden = true;
    renderFileList();
    updateUI();
    switchTab('preview');
    showProgress(false);
}

// Results
function showResults(stats) {
    statsGrid.innerHTML = `
        <div class="stat"><div class="stat-value">${stats.filesProcessed || 1}</div><div class="stat-label">Files</div></div>
        <div class="stat"><div class="stat-value">${stats.totalContacts.toLocaleString()}</div><div class="stat-label">Total</div></div>
        <div class="stat"><div class="stat-value">${stats.uniqueContacts.toLocaleString()}</div><div class="stat-label">Unique</div></div>
        <div class="stat"><div class="stat-value">${stats.duplicateEntries.toLocaleString()}</div><div class="stat-label">Duplicates</div></div>
        <div class="stat"><div class="stat-value">${stats.duplicateNumbers.toLocaleString()}</div><div class="stat-label">Dup. Numbers</div></div>
    `;
}

async function loadPreviewPage(page) {
    if (!currentSessionId) return;
    if (currentSessionId.startsWith('local-')) {
        // For local processing, we have all contacts already
        renderPreview(allContacts, allContacts.length);
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/preview/${currentSessionId}?page=${page}&limit=${PAGE_LIMIT}`);
        if (!res.ok) throw new Error('Failed to load preview');
        const data = await res.json();
        allContacts = data.contacts;
        renderPreview(data.contacts, data.total);
    } catch (e) {
        showToast('Failed to load preview', 'error');
    }
}

function renderPreview(contacts, total) {
    if (!contacts?.length) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text-muted)">No contacts</td></tr>';
        pagination.hidden = true;
        return;
    }
    tableBody.innerHTML = contacts.map((c, i) => {
        const phone = c.normalized_phones?.[0] || c.phones?.[0] || 'N/A';
        return `<tr><td>${(currentPage-1)*PAGE_LIMIT+i+1}</td><td>${escapeHtml(c.name||'Unknown')}</td><td><code>${escapeHtml(phone)}</code></td><td><span class="status ${c.is_duplicate?'duplicate':'unique'}">${c.is_duplicate?'Duplicate':'Unique'}</span></td></tr>`;
    }).join('');
    renderPagination(total);
}

function renderPagination(total) {
    const pages = Math.ceil(total / PAGE_LIMIT);
    if (pages <= 1) { pagination.hidden = true; return; }
    pagination.hidden = false;
    let html = `<button ${currentPage===1?'disabled':''} onclick="changePage(${currentPage-1})">‹</button>`;
    const start = Math.max(1, currentPage-2), end = Math.min(pages, currentPage+2);
    if (start > 1) { html += `<button onclick="changePage(1)">1</button>`; if (start>2) html += `<span style="padding:0 8px;color:var(--text-muted)">…</span>`; }
    for (let i=start;i<=end;i++) html += `<button class="${i===currentPage?'active':''}" onclick="changePage(${i})">${i}</button>`;
    if (end < pages) { if (end<pages-1) html += `<span style="padding:0 8px;color:var(--text-muted)">…</span>`; html += `<button onclick="changePage(${pages})">${pages}</button>`; }
    html += `<button ${currentPage===pages?'disabled':''} onclick="changePage(${currentPage+1})">›</button>`;
    pagination.innerHTML = html;
}

function changePage(page) {
    currentPage = page;
    loadPreviewPage(page);
    document.querySelector('.table-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Tabs
function switchTab(tab) {
    activeTab = tab;
    tabBtns.forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
    tabPanels.forEach(p => p.hidden = p.id !== `${tab}Panel`);
    if (tab === 'duplicates') renderDuplicates();
}

function renderDuplicates() {
    const dupes = allContacts.filter(c => c.is_duplicate);
    if (!dupes.length) {
        duplicatesList.innerHTML = '';
        noDuplicates.hidden = false;
        duplicatesBadge.hidden = true;
        return;
    }
    noDuplicates.hidden = true;
    duplicatesBadge.hidden = false;
    duplicatesBadge.textContent = dupes.length;
    const groups = {};
    dupes.forEach(c => { const g = c.duplicate_group||0; (groups[g]=groups[g]||[]).push(c); });
    duplicatesList.innerHTML = Object.entries(groups).map(([_, cs]) => {
        const phone = cs[0].normalized_phones?.[0] || cs[0].phones?.[0] || 'N/A';
        return `<div class="duplicate-group"><div class="duplicate-group-header"><span class="duplicate-group-phone">${escapeHtml(phone)}</span><span class="duplicate-group-count">${cs.length} contacts</span></div>${cs.map(c=>`<div class="duplicate-contact"><div><div class="duplicate-contact-name">${escapeHtml(c.name||'Unknown')}</div><div class="duplicate-contact-original">${c.phones.map(escapeHtml).join(', ')}</div></div></div>`).join('')}</div>`;
    }).join('');
}

// Downloads
function download(type) {
    if (currentSessionId?.startsWith('local-')) {
        downloadLocal(type);
    } else {
        downloadServer(type);
    }
}

function downloadLocal(type) {
    const results = window.localResults;
    if (!results) return;
    
    const names = { all: 'ALL_CONTACTS.vcf', unique: 'UNIQUE_CONTACTS.vcf', duplicates: 'DUPLICATES.vcf', report: 'REPORT.txt' };
    const content = results[`${type === 'all' ? 'allVcf' : type === 'unique' ? 'uniqueVcf' : type === 'duplicates' ? 'duplicatesVcf' : 'report'}`];
    const mime = type === 'report' ? 'text/plain' : 'text/vcard';
    
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = names[type];
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`${type} downloaded`, 'success');
}

function downloadServer(type) {
    if (!currentSessionId) return;
    const names = { all: 'ALL_CONTACTS.vcf', unique: 'UNIQUE_CONTACTS.vcf', duplicates: 'DUPLICATES.vcf', report: 'REPORT.txt' };
    const btn = document.getElementById(`download${type.charAt(0).toUpperCase()+type.slice(1)}`);
    const orig = btn.innerHTML;
    btn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px"></span> Downloading...`;
    btn.disabled = true;
    fetch(`${API_BASE}/download/${currentSessionId}/${type}`)
        .then(r => { if (!r.ok) throw new Error('Failed'); return r.blob(); })
        .then(blob => { const u=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=u; a.download=names[type]; a.click(); a.remove(); URL.revokeObjectURL(u); showToast(`${type} downloaded`, 'success'); })
        .catch(() => showToast('Download failed', 'error'))
        .finally(() => { btn.innerHTML = orig; btn.disabled = false; });
}

// Toasts
function showToast(msg, type='info') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<div class="toast-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">${type==='success'?'<polyline points="20 6 9 17 4 12"/>':type==='error'?'<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>':'<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'}</svg></div><span class="toast-message">${escapeHtml(msg)}</span>`;
    toastContainer.appendChild(t);
    setTimeout(() => { t.classList.add('hiding'); t.addEventListener('animationend',()=>t.remove()); }, 4000);
}

// Utils
function escapeHtml(t) { const d=document.createElement('div'); d.textContent=t; return d.innerHTML; }

// Globals for inline handlers
window.removeFile = removeFile;
window.changePage = changePage;

document.addEventListener('DOMContentLoaded', init);