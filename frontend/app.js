/* ==========================================================================
   ALITE VCF Manager - Mobile App Experience
   ========================================================================== */

const API_BASE = '/api';

// State
let currentSessionId = null;
let currentPage = 1;
let allContacts = [];
const PAGE_LIMIT = 50;
let activeTab = 'preview';

// Screen Management
const screens = {
    home: document.getElementById('homeScreen'),
    processing: document.getElementById('processingScreen'),
    results: document.getElementById('resultsScreen')
};

let currentScreen = 'home';

// DOM Elements - Home
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const fileActions = document.getElementById('fileActions');
const addFilesBtn = document.getElementById('addFilesBtn');
const clearBtn = document.getElementById('clearBtn');
const processBtn = document.getElementById('processBtn');
const optionsCard = document.getElementById('optionsCard');
const namingFormatGroup = document.getElementById('namingFormatGroup');
const prefixInput = document.getElementById('prefixInput');
const prefixPreview = document.getElementById('prefixPreview');
const renameContacts = document.getElementById('renameContacts');
const renameDuplicatesOnly = document.getElementById('renameDuplicatesOnly');
const detectDuplicates = document.getElementById('detectDuplicates');
const removeDuplicates = document.getElementById('removeDuplicates');

// DOM Elements - Processing
const progressPercent = document.getElementById('progressPercent');
const progressRingFill = document.querySelector('.progress-ring-fill');
const processingTitle = document.getElementById('processingTitle');
const processingSubtitle = document.getElementById('processingSubtitle');
const processingSteps = document.querySelectorAll('.step');

// DOM Elements - Results
const statsGrid = document.getElementById('statsGrid');
const resultsSubtitle = document.getElementById('resultsSubtitle');
const tableBody = document.getElementById('tableBody');
const pagination = document.getElementById('pagination');
const duplicatesList = document.getElementById('duplicatesList');
const noDuplicates = document.getElementById('noDuplicates');
const duplicatesBadge = document.getElementById('duplicatesBadge');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
const backBtn = document.getElementById('backBtn');

// Download buttons
const downloadAll = document.getElementById('downloadAll');
const downloadUnique = document.getElementById('downloadUnique');
const downloadDuplicates = document.getElementById('downloadDuplicates');
const downloadReport = document.getElementById('downloadReport');

// Toast & Modal
const toastContainer = document.getElementById('toastContainer');
const successModal = document.getElementById('successModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalOk = document.getElementById('modalOk');

// File state
let selectedFiles = [];

// ==========================================================================
// Initialization
// ==========================================================================

function init() {
    bindEvents();
    updatePrefixPreview();
    setupIntersectionObserver();
}

function bindEvents() {
    // Drop zone
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('is-drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('is-drag-over'), false);
    });

    dropZone.addEventListener('drop', handleDrop, false);
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInput.click();
        }
    });

    fileInput.addEventListener('change', handleFiles);
    addFilesBtn.addEventListener('click', () => fileInput.click());
    clearBtn.addEventListener('click', clearFiles);
    processBtn.addEventListener('click', processFiles);

    // Options
    renameContacts.addEventListener('change', toggleNamingFormat);
    prefixInput.addEventListener('input', updatePrefixPreview);

    // Tabs
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Downloads
    [downloadAll, downloadUnique, downloadDuplicates, downloadReport].forEach(btn => {
        btn.addEventListener('click', () => download(btn.dataset.type));
    });

    // Navigation
    backBtn.addEventListener('click', () => navigateTo('home'));

    // Modal
    modalOk.addEventListener('click', () => closeModal());
    successModal.addEventListener('click', (e) => {
        if (e.target === successModal) closeModal();
    });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// ==========================================================================
// Screen Navigation
// ==========================================================================

function navigateTo(screenName) {
    const fromScreen = screens[currentScreen];
    const toScreen = screens[screenName];

    if (!toScreen || fromScreen === toScreen) return;

    // Exit current screen
    fromScreen.classList.add('is-exiting');

    // Enter new screen
    toScreen.hidden = false;
    requestAnimationFrame(() => {
        toScreen.classList.add('is-active');
    });

    // Cleanup after transition
    setTimeout(() => {
        fromScreen.classList.remove('is-active', 'is-exiting');
        fromScreen.hidden = true;
        currentScreen = screenName;
    }, 300);

    // Screen-specific logic
    if (screenName === 'processing') {
        startProcessingAnimation();
    }
}

// ==========================================================================
// File Handling
// ==========================================================================

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
    files.forEach(file => {
        if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
            selectedFiles.push(file);
            added++;
        }
    });

    if (added > 0) {
        renderFileList();
        updateProcessButton();
        showFileActions();
        showToast(`Added ${added} file${added > 1 ? 's' : ''}`, 'success');
    }
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderFileList();
    updateProcessButton();
    if (selectedFiles.length === 0) hideFileActions();
}

function clearFiles() {
    selectedFiles = [];
    renderFileList();
    updateProcessButton();
    hideFileActions();
    hideResults();
}

function renderFileList() {
    if (selectedFiles.length === 0) {
        fileList.innerHTML = '';
        return;
    }

    fileList.innerHTML = selectedFiles.map((file, index) => `
        <li class="file-item" style="animation-delay: ${index * 50}ms">
            <div class="file-info">
                <div class="file-icon" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                    </svg>
                </div>
                <div class="file-details">
                    <span class="file-name">${escapeHtml(file.name)}</span>
                    <span class="file-size">${formatFileSize(file.size)}</span>
                </div>
            </div>
            <button class="btn btn--ghost" onclick="removeFile(${index})" aria-label="Remove ${escapeHtml(file.name)}">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </li>
    `).join('');
}

function showFileActions() {
    fileActions.hidden = false;
    requestAnimationFrame(() => {
        fileActions.style.opacity = '1';
        fileActions.style.transform = 'translateY(0)';
    });
}

function hideFileActions() {
    fileActions.style.opacity = '0';
    fileActions.style.transform = 'translateY(10px)';
    setTimeout(() => {
        fileActions.hidden = true;
    }, 200);
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function updateProcessButton() {
    processBtn.disabled = selectedFiles.length === 0;
}

function toggleNamingFormat() {
    const show = renameContacts.checked;
    namingFormatGroup.hidden = !show;
    if (show) {
        requestAnimationFrame(() => {
            namingFormatGroup.style.opacity = '1';
            namingFormatGroup.style.transform = 'translateY(0)';
        });
    } else {
        namingFormatGroup.style.opacity = '0';
        namingFormatGroup.style.transform = 'translateY(-10px)';
    }
}

function updatePrefixPreview() {
    const prefix = prefixInput.value.trim() || 'Contact';
    prefixPreview.textContent = `${prefix} 0001`;
}

// ==========================================================================
// Processing
// ==========================================================================

async function processFiles() {
    if (selectedFiles.length === 0) return;

    navigateTo('processing');

    const formData = new FormData();
    selectedFiles.forEach(file => formData.append('files', file));
    formData.append('format_type', document.getElementById('phoneFormat').value);
    formData.append('naming_prefix', prefixInput.value.trim() || 'Contact');
    formData.append('detect_duplicates', detectDuplicates.checked);
    formData.append('remove_duplicates', removeDuplicates.checked);
    formData.append('rename_contacts', renameContacts.checked);
    formData.append('rename_duplicates_only', renameDuplicatesOnly.checked);
    formData.append('duplicate_strategy', document.getElementById('duplicateStrategy').value);

    try {
        const response = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Processing failed' }));
            throw new Error(error.detail || 'Processing failed');
        }

        const data = await response.json();
        currentSessionId = data.session_id;
        allContacts = data.preview || [];

        // Load full preview
        await loadPreviewPage(1);

        // Show results after a brief delay for UX
        setTimeout(() => {
            showResults(data.stats);
            navigateTo('results');
        }, 500);

    } catch (error) {
        navigateTo('home');
        showToast(error.message, 'error');
    }
}

function startProcessingAnimation() {
    const steps = [
        { title: 'Reading VCF files', subtitle: 'Parsing contact data...', step: 1, progress: 25 },
        { title: 'Normalizing numbers', subtitle: 'Converting phone formats...', step: 2, progress: 50 },
        { title: 'Detecting duplicates', subtitle: 'Finding matching contacts...', step: 3, progress: 75 },
        { title: 'Generating outputs', subtitle: 'Creating VCF files...', step: 4, progress: 100 }
    ];

    let currentStep = 0;

    function animateStep() {
        if (currentStep >= steps.length) return;

        const step = steps[currentStep];
        processingTitle.textContent = step.title;
        processingSubtitle.textContent = step.subtitle;

        // Update progress ring
        const circumference = 339;
        const offset = circumference - (step.progress / 100) * circumference;
        progressRingFill.style.strokeDashoffset = offset;
        progressPercent.textContent = `${step.progress}%`;

        // Update step indicators
        processingSteps.forEach((el, i) => {
            el.classList.remove('is-active', 'is-complete');
            if (i < step.step - 1) el.classList.add('is-complete');
            if (i === step.step - 1) el.classList.add('is-active');
        });

        currentStep++;
        setTimeout(animateStep, 800);
    }

    animateStep();
}

// ==========================================================================
// Results
// ==========================================================================

function showResults(stats) {
    renderStats(stats);
    resultsSubtitle.textContent = `${stats.total_contacts.toLocaleString()} contacts processed`;
}

function renderStats(stats) {
    statsGrid.innerHTML = `
        <article class="stat-card">
            <div class="stat-value">${stats.files_processed || 0}</div>
            <div class="stat-label">Files</div>
        </article>
        <article class="stat-card">
            <div class="stat-value">${stats.total_contacts.toLocaleString()}</div>
            <div class="stat-label">Total Contacts</div>
        </article>
        <article class="stat-card">
            <div class="stat-value">${stats.unique_contacts.toLocaleString()}</div>
            <div class="stat-label">Unique</div>
        </article>
        <article class="stat-card">
            <div class="stat-value">${stats.duplicate_entries.toLocaleString()}</div>
            <div class="stat-label">Duplicates</div>
        </article>
        <article class="stat-card">
            <div class="stat-value">${stats.duplicate_numbers.toLocaleString()}</div>
            <div class="stat-label">Duplicated Numbers</div>
        </article>
    `;
}

async function loadPreviewPage(page) {
    if (!currentSessionId) return;

    try {
        const response = await fetch(`${API_BASE}/preview/${currentSessionId}?page=${page}&limit=${PAGE_LIMIT}`);
        if (!response.ok) throw new Error('Failed to load preview');

        const data = await response.json();
        allContacts = data.contacts;
        renderPreview(data.contacts, data.total);
    } catch (error) {
        console.error('Failed to load preview:', error);
        showToast('Failed to load preview', 'error');
    }
}

function renderPreview(contacts, total) {
    if (!contacts || contacts.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center; padding: var(--space-10); color: var(--color-text-muted);">
                    No contacts to display
                </td>
            </tr>
        `;
        pagination.hidden = true;
        return;
    }

    tableBody.innerHTML = contacts.map((contact, index) => {
        const phone = contact.normalized_phones?.[0] || contact.phones?.[0] || 'N/A';
        const isDuplicate = contact.is_duplicate;
        return `
            <tr style="animation-delay: ${index * 30}ms">
                <td>${(currentPage - 1) * PAGE_LIMIT + index + 1}</td>
                <td>${escapeHtml(contact.name || 'Unknown')}</td>
                <td><code style="font-size: 0.8125rem;">${escapeHtml(phone)}</code></td>
                <td>
                    <span class="status-badge ${isDuplicate ? 'status-badge--duplicate' : 'status-badge--unique'}">
                        ${isDuplicate ? 'Duplicate' : 'Unique'}
                    </span>
                </td>
            </tr>
        `;
    }).join('');

    renderPagination(total);
}

function renderPagination(total) {
    const totalPages = Math.ceil(total / PAGE_LIMIT);
    if (totalPages <= 1) {
        pagination.hidden = true;
        return;
    }

    pagination.hidden = false;

    let html = '';
    html += `<button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})" aria-label="Previous page">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
    </button>`;

    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);

    if (start > 1) {
        html += `<button class="pagination-btn" onclick="changePage(1)">1</button>`;
        if (start > 2) html += `<span class="pagination-btn" style="cursor:default; border-color:transparent; background:none; color:var(--color-text-muted);">…</span>`;
    }

    for (let i = start; i <= end; i++) {
        html += `<button class="pagination-btn" ${i === currentPage ? 'aria-current="page"' : ''} onclick="changePage(${i})">${i}</button>`;
    }

    if (end < totalPages) {
        if (end < totalPages - 1) html += `<span class="pagination-btn" style="cursor:default; border-color:transparent; background:none; color:var(--color-text-muted);">…</span>`;
        html += `<button class="pagination-btn" onclick="changePage(${totalPages})">${totalPages}</button>`;
    }

    html += `<button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})" aria-label="Next page">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </button>`;

    pagination.innerHTML = html;
}

function changePage(page) {
    currentPage = page;
    loadPreviewPage(page);
    // Smooth scroll to table top
    document.querySelector('.table-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ==========================================================================
// Tab Switching
// ==========================================================================

function switchTab(tabName) {
    activeTab = tabName;

    tabBtns.forEach(btn => {
        const isActive = btn.dataset.tab === tabName;
        btn.setAttribute('aria-selected', isActive);
    });

    tabPanels.forEach(panel => {
        panel.hidden = panel.id !== `${tabName}Panel`;
    });

    if (tabName === 'duplicates') {
        renderDuplicates();
    }
}

function renderDuplicates() {
    const duplicateContacts = allContacts.filter(c => c.is_duplicate);

    if (duplicateContacts.length === 0) {
        duplicatesList.innerHTML = '';
        noDuplicates.hidden = false;
        duplicatesBadge.hidden = true;
        return;
    }

    noDuplicates.hidden = true;
    duplicatesBadge.hidden = false;
    duplicatesBadge.textContent = duplicateContacts.length;

    // Group by duplicate_group
    const groups = {};
    duplicateContacts.forEach(c => {
        const groupId = c.duplicate_group || 0;
        if (!groups[groupId]) groups[groupId] = [];
        groups[groupId].push(c);
    });

    duplicatesList.innerHTML = Object.entries(groups).map(([groupId, contacts]) => {
        const phone = contacts[0].normalized_phones?.[0] || contacts[0].phones?.[0] || 'N/A';
        return `
            <div class="duplicate-group">
                <div class="duplicate-group-header">
                    <span class="duplicate-group-phone">${escapeHtml(phone)}</span>
                    <span class="duplicate-group-count">${contacts.length} contacts</span>
                </div>
                <div class="duplicate-contacts">
                    ${contacts.map(c => `
                        <div class="duplicate-contact">
                            <div class="duplicate-contact-info">
                                <span class="duplicate-contact-name">${escapeHtml(c.name || 'Unknown')}</span>
                                <span class="duplicate-contact-original">Original: ${c.phones.map(escapeHtml).join(', ')}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================================================
// Downloads
// ==========================================================================

function download(type) {
    if (!currentSessionId) return;

    const filenames = {
        all: 'ALL_CONTACTS.vcf',
        unique: 'UNIQUE_CONTACTS.vcf',
        duplicates: 'DUPLICATES.vcf',
        report: 'REPORT.txt'
    };

    const btn = document.getElementById(`download${type.charAt(0).toUpperCase() + type.slice(1)}`);
    const originalText = btn.innerHTML;

    btn.innerHTML = `
        <svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round" stroke-opacity="1"/>
        </svg>
        <span>Downloading...</span>
    `;
    btn.disabled = true;

    fetch(`${API_BASE}/download/${currentSessionId}/${type}`)
        .then(response => {
            if (!response.ok) throw new Error('Download failed');
            return response.blob();
        })
        .then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filenames[type];
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} downloaded`, 'success');
        })
        .catch(error => {
            showToast('Download failed: ' + error.message, 'error');
        })
        .finally(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        });
}

// ==========================================================================
// Toast System
// ==========================================================================

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    const icons = {
        success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
        error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    toast.innerHTML = `
        <div class="toast-icon" aria-hidden="true">${icons[type]}</div>
        <span class="toast-message">${escapeHtml(message)}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('is-hiding');
        toast.addEventListener('animationend', () => toast.remove());
    }, 4000);
}

// ==========================================================================
// Modal
// ==========================================================================

function showSuccessModal(title, message) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    successModal.showModal();
}

function closeModal() {
    successModal.close();
}

// ==========================================================================
// Utilities
// ==========================================================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function setupIntersectionObserver() {
    // For scroll animations if needed
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.file-item, .stat-card, .step').forEach(el => {
        observer.observe(el);
    });
}

// Global functions for inline handlers
window.removeFile = removeFile;
window.changePage = changePage;

// ==========================================================================
// Start
// ==========================================================================

document.addEventListener('DOMContentLoaded', init);

// Handle back button on mobile
window.addEventListener('popstate', (e) => {
    if (currentScreen !== 'home') {
        e.preventDefault();
        navigateTo('home');
    }
});

// Prevent pull-to-refresh on iOS
document.body.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) e.preventDefault();
}, { passive: false });