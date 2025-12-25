const { ipcRenderer } = require('electron');
const path = require('path');

// State
let selectedFiles = [];
let renameHistory = []; // Stack to track rename operations for undo

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileList = document.getElementById('fileList');
const previewTableBody = document.getElementById('previewTableBody');
const fileCount = document.getElementById('fileCount');
const applyRenameBtn = document.getElementById('applyRenameBtn');
const clearBtn = document.getElementById('clearBtn');
const undoBtn = document.getElementById('undoBtn');

// Controls
const replaceUnderscoresCheckbox = document.getElementById('replaceUnderscores');
const underscoreStatus = document.getElementById('underscoreStatus');
const removeKeywordInput = document.getElementById('removeKeyword');
const caseSensitiveCheckbox = document.getElementById('caseSensitive');
const capitalizationSelect = document.getElementById('capitalization');
const themeToggle = document.getElementById('themeToggle');

// Initialize
init();

function init() {
    setupTheme();
    setupEventListeners();
}

function setupTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
    }
}

function setupEventListeners() {
    // Drop zone
    dropZone.addEventListener('click', selectFiles);
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    // Buttons
    applyRenameBtn.addEventListener('click', applyRename);
    clearBtn.addEventListener('click', clearFiles);
    undoBtn.addEventListener('click', undoLastRename);
    themeToggle.addEventListener('click', toggleTheme);

    // Controls - update preview on change
    replaceUnderscoresCheckbox.addEventListener('change', () => {
        underscoreStatus.textContent = replaceUnderscoresCheckbox.checked ? 'Enabled' : 'Disabled';
        updatePreview();
    });
    removeKeywordInput.addEventListener('input', updatePreview);
    caseSensitiveCheckbox.addEventListener('change', updatePreview);
    capitalizationSelect.addEventListener('change', updatePreview);
}

// File Selection
async function selectFiles() {
    const files = await ipcRenderer.invoke('select-files');
    if (files.length > 0) {
        selectedFiles = files;
        showFileList();
        updatePreview();
    }
}

// Drag and Drop
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
}

async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer.files).map(file => ({
        path: file.path,
        name: path.basename(file.path),
        size: file.size,
        directory: path.dirname(file.path)
    }));

    if (files.length > 0) {
        selectedFiles = files;
        showFileList();
        updatePreview();
    }
}

// UI Updates
function showFileList() {
    dropZone.style.display = 'none';
    fileList.style.display = 'flex';
    applyRenameBtn.style.display = 'inline-flex';
    clearBtn.style.display = 'inline-flex';
}

function clearFiles() {
    selectedFiles = [];
    dropZone.style.display = 'flex';
    fileList.style.display = 'none';
    applyRenameBtn.style.display = 'none';
    clearBtn.style.display = 'none';
    previewTableBody.innerHTML = '';
}

// Renaming Logic
function applyRenamingRules(filename) {
    const ext = path.extname(filename);
    let name = path.basename(filename, ext);

    // 1. Replace underscores
    if (replaceUnderscoresCheckbox.checked) {
        name = name.replace(/_/g, ' ');
    }

    // 2. Remove keyword
    const keyword = removeKeywordInput.value.trim();
    if (keyword) {
        const flags = caseSensitiveCheckbox.checked ? 'g' : 'gi';
        const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
        name = name.replace(regex, '');
    }

    // 3. Smart capitalization
    const capMode = capitalizationSelect.value;
    switch (capMode) {
        case 'title':
            name = toTitleCase(name);
            break;
        case 'sentence':
            name = toSentenceCase(name);
            break;
        case 'upper':
            name = name.toUpperCase();
            break;
        case 'lower':
            name = name.toLowerCase();
            break;
    }

    // Clean up extra spaces
    name = name.replace(/\s+/g, ' ').trim();

    return name + ext;
}

function toTitleCase(str) {
    return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

function toSentenceCase(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Preview
function updatePreview() {
    if (selectedFiles.length === 0) return;

    const newNames = selectedFiles.map(file => applyRenamingRules(file.name));

    // Check for conflicts
    const nameCount = {};
    newNames.forEach(name => {
        nameCount[name] = (nameCount[name] || 0) + 1;
    });

    // Update table
    previewTableBody.innerHTML = '';
    selectedFiles.forEach((file, index) => {
        const newName = newNames[index];
        const hasConflict = nameCount[newName] > 1;
        const hasChanged = file.name !== newName;

        const row = document.createElement('tr');
        row.innerHTML = `
      <td>
        ${hasConflict ? '<span class="conflict-icon" title="Duplicate name">⚠️</span>' : ''}
      </td>
      <td>
        <span class="filename">${escapeHtml(file.name)}</span>
      </td>
      <td class="arrow-icon">
        ${hasChanged ? '→' : ''}
      </td>
      <td>
        <span class="filename ${hasChanged ? 'new' : ''} ${hasConflict ? 'conflict' : ''}">
          ${escapeHtml(newName)}
        </span>
      </td>
    `;
        previewTableBody.appendChild(row);
    });

    // Update file count
    fileCount.textContent = `${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}`;

    // Disable apply button if conflicts exist
    const hasAnyConflict = Object.values(nameCount).some(count => count > 1);
    applyRenameBtn.disabled = hasAnyConflict;
}

// Apply Rename
async function applyRename() {
    if (selectedFiles.length === 0) return;

    // Confirm
    const confirmed = confirm(
        `Are you sure you want to rename ${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}?\n\nThis action can be undone using the Undo button.`
    );

    if (!confirmed) return;

    // Prepare rename operations
    const operations = selectedFiles.map(file => ({
        oldPath: file.path,
        oldName: file.name,
        newName: applyRenamingRules(file.name),
        directory: file.directory
    }));

    // Execute rename
    applyRenameBtn.disabled = true;
    applyRenameBtn.textContent = '⏳ Renaming...';

    try {
        const results = await ipcRenderer.invoke('rename-files', operations);

        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        if (failCount > 0) {
            const errors = results
                .filter(r => !r.success)
                .map(r => `${r.oldName}: ${r.error}`)
                .join('\n');

            showNotification(
                `Renamed ${successCount} file(s). ${failCount} failed:\n${errors}`,
                'error'
            );

            // Only save successful operations to history
            const successfulOps = operations.filter((op, i) => results[i].success);
            if (successfulOps.length > 0) {
                renameHistory.push(successfulOps);
                updateUndoButton();
            }
        } else {
            showNotification(`Successfully renamed ${successCount} file(s)!`, 'success');

            // Save to history for undo
            renameHistory.push(operations);
            updateUndoButton();

            clearFiles();
        }
    } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
    } finally {
        applyRenameBtn.disabled = false;
        applyRenameBtn.textContent = '✨ Apply Rename';
    }
}

// Notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Utility
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Undo last rename operation
async function undoLastRename() {
    if (renameHistory.length === 0) return;

    const lastOperation = renameHistory[renameHistory.length - 1];

    const confirmed = confirm(
        `Undo the last rename operation (${lastOperation.length} file${lastOperation.length !== 1 ? 's' : ''})?`
    );

    if (!confirmed) return;

    undoBtn.disabled = true;
    undoBtn.textContent = '⏳ Undoing...';

    try {
        // Prepare undo operations (swap old and new names)
        const undoOps = lastOperation.map(op => ({
            currentName: op.newName,
            originalName: op.oldName,
            directory: op.directory
        }));

        const results = await ipcRenderer.invoke('undo-rename', undoOps);

        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        if (failCount > 0) {
            const errors = results
                .filter(r => !r.success)
                .map(r => `${r.currentName}: ${r.error}`)
                .join('\n');

            showNotification(
                `Undid ${successCount} file(s). ${failCount} failed:\n${errors}`,
                'error'
            );
        } else {
            showNotification(`Successfully undid rename of ${successCount} file(s)!`, 'success');
            renameHistory.pop(); // Remove from history
            updateUndoButton();
        }
    } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
    } finally {
        undoBtn.disabled = false;
        undoBtn.textContent = '↶ Undo';
    }
}

// Update undo button visibility and state
function updateUndoButton() {
    if (renameHistory.length > 0) {
        undoBtn.style.display = 'inline-flex';
        undoBtn.disabled = false;
    } else {
        undoBtn.style.display = 'none';
    }
}

// Theme Toggle
function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
}

