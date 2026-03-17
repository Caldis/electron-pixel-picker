/**
 * electron-pixel-picker
 *
 * Zero-dependency screen color picker for Electron.
 * Captures the entire screen, displays it in a fullscreen overlay window,
 * and lets the user pick a pixel color with a magnifying glass cursor.
 *
 * Works on Windows, macOS, and Linux.
 * Uses only Electron built-in APIs — no native modules, no extra dependencies.
 *
 * @example
 * ```ts
 * // main.ts
 * import { registerPixelPicker } from 'electron-pixel-picker';
 *
 * app.whenReady().then(() => {
 *   registerPixelPicker();
 * });
 * ```
 *
 * @packageDocumentation
 */

import { BrowserWindow, desktopCapturer, ipcMain, screen } from 'electron';
import * as path from 'path';

/** Result returned by the color picker */
export interface PickColorResult {
  /** Hex color string (e.g. "#FF6600"), or empty string if cancelled */
  hex: string;
}

let overlayWindow: BrowserWindow | null = null;

/**
 * Capture the primary display as a data URL.
 * Uses Electron's desktopCapturer with hi-DPI pixel dimensions.
 * @internal
 */
async function captureScreen(): Promise<string> {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;
  const scaleFactor = primaryDisplay.scaleFactor;

  // Use actual pixel dimensions for hi-DPI accuracy
  const thumbWidth = Math.round(width * scaleFactor);
  const thumbHeight = Math.round(height * scaleFactor);

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: thumbWidth, height: thumbHeight },
  });

  if (!sources.length) throw new Error('No screen source available');

  // Use the primary display source
  const source = sources[0];
  return source.thumbnail.toDataURL();
}

/**
 * Open the color picker overlay and wait for the user to pick a color.
 *
 * This is the direct API — it does NOT require IPC registration.
 * Call this from the main process when you want full control.
 *
 * @returns The picked hex color string (e.g. "#FF6600"), or empty string if cancelled (Esc / right-click).
 *
 * @example
 * ```ts
 * import { pickScreenColor } from 'electron-pixel-picker';
 *
 * const hex = await pickScreenColor();
 * if (hex) console.log('Picked:', hex);
 * ```
 */
export async function pickScreenColor(): Promise<string> {
  if (overlayWindow) {
    overlayWindow.close();
    overlayWindow = null;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;
  const { x, y } = primaryDisplay.bounds;

  // Capture screen BEFORE showing overlay
  let screenshotDataUrl: string;
  try {
    screenshotDataUrl = await captureScreen();
  } catch (err) {
    console.error('[electron-pixel-picker] capture failed:', err);
    return '';
  }

  return new Promise<string>((resolve) => {
    overlayWindow = new BrowserWindow({
      x,
      y,
      width,
      height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      fullscreenable: false,
      hasShadow: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'overlay-preload.js'),
      },
    });

    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    // Fullscreen on all platforms
    overlayWindow.setBounds({ x, y, width, height });

    // Load the overlay HTML (lives in src/ even after npm install)
    const overlayPath = path.join(__dirname, '..', 'src', 'overlay.html');
    overlayWindow.loadFile(overlayPath);

    // Send screenshot data once overlay is ready
    overlayWindow.webContents.once('did-finish-load', () => {
      overlayWindow?.webContents.send('screenshot-data', screenshotDataUrl, width, height);
    });

    // Listen for color pick result
    ipcMain.once('color-picked', (_event, colorHex: string) => {
      overlayWindow?.close();
      overlayWindow = null;
      resolve(colorHex);
    });

    // Handle overlay close (Esc or click outside)
    overlayWindow.once('closed', () => {
      overlayWindow = null;
      ipcMain.removeAllListeners('color-picked');
      resolve(''); // cancelled
    });
  });
}

/**
 * Register the IPC handler `'pick-screen-color'` so renderers can invoke color picking.
 *
 * Call this once in the main process after `app.whenReady()`.
 * Renderers can then call `ipcRenderer.invoke('pick-screen-color')` (or use the
 * provided preload helper) to trigger the picker.
 *
 * @example
 * ```ts
 * // main.ts
 * import { registerPixelPicker } from 'electron-pixel-picker';
 *
 * app.whenReady().then(() => {
 *   registerPixelPicker();
 *   // ... create your windows
 * });
 *
 * // renderer (via preload)
 * const hex = await window.electronAPI.invoke('pick-screen-color');
 * ```
 */
export function registerPixelPicker(): void {
  ipcMain.handle('pick-screen-color', async () => {
    return pickScreenColor();
  });
}
