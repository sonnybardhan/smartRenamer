const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: '#0f0f1a',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        titleBarStyle: 'hiddenInset',
        show: false
    });

    mainWindow.loadFile('index.html');

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Open DevTools in development
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC Handlers

// Open file dialog
ipcMain.handle('select-files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (result.canceled) {
        return [];
    }

    // Get file info for each selected file
    const fileInfos = await Promise.all(
        result.filePaths.map(async (filePath) => {
            const stats = await fs.stat(filePath);
            return {
                path: filePath,
                name: path.basename(filePath),
                size: stats.size,
                directory: path.dirname(filePath)
            };
        })
    );

    return fileInfos;
});

// Rename files
ipcMain.handle('rename-files', async (event, renameOperations) => {
    const results = [];

    for (const operation of renameOperations) {
        try {
            const oldPath = operation.oldPath;
            const newPath = path.join(operation.directory, operation.newName);

            // Check if target already exists
            try {
                await fs.access(newPath);
                results.push({
                    success: false,
                    oldName: operation.oldName,
                    newName: operation.newName,
                    error: 'File already exists'
                });
                continue;
            } catch {
                // File doesn't exist, we can proceed
            }

            // Perform rename
            await fs.rename(oldPath, newPath);

            results.push({
                success: true,
                oldName: operation.oldName,
                newName: operation.newName
            });
        } catch (error) {
            results.push({
                success: false,
                oldName: operation.oldName,
                newName: operation.newName,
                error: error.message
            });
        }
    }

    return results;
});

// Undo rename operation
ipcMain.handle('undo-rename', async (event, undoOperations) => {
    const results = [];

    for (const operation of undoOperations) {
        try {
            const currentPath = path.join(operation.directory, operation.currentName);
            const originalPath = path.join(operation.directory, operation.originalName);

            // Check if current file exists
            try {
                await fs.access(currentPath);
            } catch {
                results.push({
                    success: false,
                    currentName: operation.currentName,
                    originalName: operation.originalName,
                    error: 'File not found (may have been moved or deleted)'
                });
                continue;
            }

            // Check if original name is already taken
            try {
                await fs.access(originalPath);
                results.push({
                    success: false,
                    currentName: operation.currentName,
                    originalName: operation.originalName,
                    error: 'Original filename already exists'
                });
                continue;
            } catch {
                // Original name is free, we can proceed
            }

            // Perform undo (rename back to original)
            await fs.rename(currentPath, originalPath);

            results.push({
                success: true,
                currentName: operation.currentName,
                originalName: operation.originalName
            });
        } catch (error) {
            results.push({
                success: false,
                currentName: operation.currentName,
                originalName: operation.originalName,
                error: error.message
            });
        }
    }

    return results;
});
