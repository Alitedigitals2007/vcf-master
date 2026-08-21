const API_BASE = '/api';

let currentSessionId = null;
let currentPage = 1;
const PAGE_LIMIT = 50;

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const addFilesBtn = document.getElementById('addFilesBtn');
const clearBtn = document.getElementById('clearBtn');
const processBtn = document.getElementById('processBtn');
const resultsSection = document.getElementById('resultsSection');
const statsGrid = document.getElementById('statsGrid');
const previewBody = document.getElementById('previewBody');
const pagination = document.getElementById('pagination');
const namingFormat = document.getElementById('namingFormat');
const renameContacts = document.getElementById('renameContacts');
const prefixInput = document.getElementById('prefixInput');

let selectedFiles = [];

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
});

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, unhighlight, false);
});

dropZone.addEventListener('drop', handleDrop, false);
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFiles);
addFilesBtn.addEventListener('click', () => fileInput.click());
clearBtn.addEventListener('click', clearFiles);
processBtn.addEventListener('click', processFiles);
renameContacts.addEventListener('change', toggleNamingFormat);

document.getElementById('downloadAll').addEventListener('click', () => download('all'));
document.getElementById('downloadUnique').addEventListener('click', () => download('unique'));
document.getElementById('downloadDuplicates').addEventListener('click', () => download('duplicates'));
document.getElementById('downloadReport').addEventListener('click', () => download('report'));

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight() {
    dropZone.classList.add('drag-over');
}

function unhighlight() {
    dropZone.classList.remove('drag-over');
}

function handleDrop(e) {
    const files = [...e.dataTransfer.files].filter(f => f.name.endsWith('.vcf'));
    addFiles(files);
}

function handleFiles(e) {
    const files = [...e.target.files].filter(f => f.name.endsWith('.vcf'));
    addFiles(files);
    fileInput.value = '';
}

function addFiles(files) {
    files.forEach(file => {
        if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
            selectedFiles.push(file);
        }
    });
    renderFileList();
    updateProcessButton();
}

function clearFiles() {
    selectedFiles = [];
    renderFileList();
    updateProcessButton();
    hideResults();
}

function renderFileList() {
    if (selectedFiles.length === 0) {
        fileList.innerHTML = '';
        return;
    }

    fileList.innerHTML = selectedFiles.map((file, index) => `
        <div class="file-item">
            <div class="file-info">
                <svg class="file-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span class="file-name">${file.name}</span>
                <span class="file-size">(${formatFileSize(file.size)})</span>
            </div>
            <button class="btn btn-secondary" onclick="removeFile(${index})" style="padding: 6px 10px; font-size: 0.8rem;">Remove</button>
        </div>
    `).join('');
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderFileList();
    updateProcessButton();
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
    namingFormat.style.display = renameContacts.checked ? 'block' : 'none';
}

async function processFiles() {
    if (selectedFiles.length === 0) return;

    showLoading(true);

    const formData = new FormData();
    selectedFiles.forEach(file => formData.append('files', file));
    formData.append('format_type', document.querySelector('input[name="format"]:checked').value);
    formData.append('naming_prefix', prefixInput.value || 'Contact');
    formData.append('detect_duplicates', document.getElementById('detectDuplicates').checked);
    formData.append('remove_duplicates', document.getElementById('removeDuplicates').checked);
    formData.append('rename_contacts', renameContacts.checked);
    formData.append('rename_duplicates_only', document.getElementById('renameDuplicatesOnly').checked);
    formData.append('duplicate_strategy', document.getElementById('duplicateStrategy').value);

    try {
        const response = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Processing failed');
        }

        const data = await response.json();
        currentSessionId = data.session_id;
        showResults(data.stats, data.preview);
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        showLoading(false);
    }
}

function showLoading(show) {
    const btnText = processBtn.querySelector('.btn-text');
    const btnLoader = processBtn.querySelector('.btn-loader');
    processBtn.disabled = show;
    btnText.style.display = show ? 'none' : 'inline';
    btnLoader.style.display = show ? 'inline-block' : 'none';
}

function showResults(stats, preview) {
    resultsSection.style.display = 'block';
    renderStats(stats);
    renderPreview(preview);
    currentPage = 1;
    loadPreviewPage(1);
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function hideResults() {
    resultsSection.style.display = 'none';
    currentSessionId = null;
}

function renderStats(stats) {
    statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${stats.files_processed || 0}</div>
            <div class="stat-label">Files Processed</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.total_contacts.toLocaleString()}</div>
            <div class="stat-label">Contacts Found</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.unique_contacts.toLocaleString()}</div>
            <div class="stat-label">Unique Contacts</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.duplicate_entries.toLocaleString()}</div>
            <div class="stat-label">Duplicate Entries</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.duplicate_numbers.toLocaleString()}</div>
            <div class="stat-label">Duplicated Numbers</div>
        </div>
    `;
}

async function loadPreviewPage(page) {
    if (!currentSessionId) return;

    try {
        const response = await fetch(`${API_BASE}/preview/${currentSessionId}?page=${page}&limit=${PAGE_LIMIT}`);
        const data = await response.json();
        renderPreview(data.contacts, data.total);
    } catch (error) {
        console.error('Failed to load preview:', error);
    }
}

function renderPreview(contacts, total = null) {
    if (!contacts || contacts.length === 0) {
        previewBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 40px; color: var(--text-muted);">No contacts to display</td></tr>';
        pagination.innerHTML = '';
        return;
    }

    previewBody.innerHTML = contacts.map((contact, index) => {
        const phone = contact.normalized_phones?.[0] || contact.phones?.[0] || 'N/A';
        const isDuplicate = contact.is_duplicate;
        return `
            <tr>
                <td>${(currentPage - 1) * PAGE_LIMIT + index + 1}</td>
                <td>${escapeHtml(contact.name || 'Unknown')}</td>
                <td>${escapeHtml(phone)}</td>
                <td>
                    <span class="status-badge ${isDuplicate ? 'status-duplicate' : 'status-unique'}">
                        ${isDuplicate ? 'Duplicate' : 'Unique'}
                    </span>
                </td>
            </tr>
        `;
    }).join('');

    if (total !== null) {
        renderPagination(total);
    }
}

function renderPagination(total) {
    const totalPages = Math.ceil(total / PAGE_LIMIT);
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = '';
    html += `<button ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">‹ Prev</button>`;

    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);

    if (start > 1) {
        html += `<button onclick="changePage(1)">1</button>`;
        if (start > 2) html += `<span style="padding: 0 8px; color: var(--text-muted);">...</span>`;
    }

    for (let i = start; i <= end; i++) {
        html += `<button class="${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    }

    if (end < totalPages) {
        if (end < totalPages - 1) html += `<span style="padding: 0 8px; color: var(--text-muted);">...</span>`;
        html += `<button onclick="changePage(${totalPages})">${totalPages}</button>`;
    }

    html += `<button ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">Next ›</button>`;

    pagination.innerHTML = html;
}

function changePage(page) {
    currentPage = page;
    loadPreviewPage(page);
}

function download(type) {
    if (!currentSessionId) return;
    window.location.href = `${API_BASE}/download/${currentSessionId}/${type}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.removeFile = removeFile;
window.changePage = changePage;