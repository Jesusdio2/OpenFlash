const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Detectar si estamos en modo desarrollo o producción
    const isDev = !app.isPackaged;

    if (isDev) {
        // En desarrollo, carga el servidor de Vite
        win.loadURL('http://localhost:5173');
    } else {
        // En producción/empaquetado, carga el index.html generado por Vite en dist
        win.loadFile(path.join(__dirname, 'dist/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});