# electron-pixel-picker

> Zero-dependency screen color picker for Electron. Fullscreen overlay with pixel-grid magnifier, scroll-to-zoom, and hex color output.

![Demo](docs/demo.gif)

## Features

- **Zero dependencies** -- uses only Electron built-in APIs (desktopCapturer, BrowserWindow)
- **Pixel-grid magnifier** -- circular magnifying glass with individual pixel grid rendering
- **Scroll-to-zoom** -- mouse wheel adjusts magnification from 28x down to 1:1
- **Hi-DPI aware** -- captures at native resolution for Retina / high-DPI displays
- **Instant feedback** -- magnifier appears immediately, even before screenshot loads
- **Cross-platform** -- works on Windows, macOS, and Linux
- **TypeScript** -- full type definitions included
- **Lightweight** -- ~200 lines of code, single HTML overlay

## Installation

```bash
npm install electron-pixel-picker
```

## Quick Start

**Main process** (5 lines):

```ts
import { app, BrowserWindow } from 'electron';
import { registerPixelPicker } from 'electron-pixel-picker';

app.whenReady().then(() => {
  registerPixelPicker();
  // ... create your windows
});
```

**Renderer process** (via preload):

```ts
// preload.js
const { ipcRenderer } = require('electron');

// In your preload, expose the invoke method:
contextBridge.exposeInMainWorld('electronAPI', {
  pickColor: () => ipcRenderer.invoke('pick-screen-color'),
});

// renderer.js
const hex = await window.electronAPI.pickColor();
if (hex) {
  console.log('Picked color:', hex); // e.g. "#FF6600"
}
```

## API Reference

### `registerPixelPicker()`

Registers the IPC handler `'pick-screen-color'` so renderers can invoke color picking via `ipcRenderer.invoke('pick-screen-color')`.

Call this **once** in the main process after `app.whenReady()`.

```ts
import { registerPixelPicker } from 'electron-pixel-picker';

app.whenReady().then(() => {
  registerPixelPicker();
});
```

### `pickScreenColor(): Promise<string>`

Direct API for main-process usage. Opens the color picker overlay and returns the selected hex color string (e.g. `"#FF6600"`), or an empty string `""` if cancelled.

```ts
import { pickScreenColor } from 'electron-pixel-picker';

const hex = await pickScreenColor();
```

### Preload Setup

The package includes a preload script that exposes `colorPickerAPI` to the overlay window. This is handled internally -- you don't need to configure it.

For your own app's preload, just expose the IPC invoke:

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  pickColor: () => ipcRenderer.invoke('pick-screen-color'),
});
```

### Types

```ts
interface PickColorResult {
  hex: string; // e.g. "#FF6600" or "" if cancelled
}
```

## How It Works

1. **Capture** -- Uses Electron's `desktopCapturer` to take a screenshot of the primary display at native resolution
2. **Overlay** -- Creates a frameless, transparent, always-on-top `BrowserWindow` covering the entire screen
3. **Magnifier** -- Renders a circular magnifying glass that follows the cursor, showing a pixel grid of the surrounding area
4. **Pick** -- Click to select the color under the center pixel; Esc or right-click to cancel
5. **Zoom** -- Scroll wheel adjusts the grid size (5x5 to 141x141 pixels), changing magnification from 28x to 1:1

## Comparison

| Feature | electron-pixel-picker | electron-color-picker | electron-eyedropper |
|---------|----------------------|----------------------|---------------------|
| Dependencies | **0** | 2+ | 1+ |
| Magnifier | **Pixel grid with zoom** | Basic | None |
| Scroll zoom | **5x to 141x** | No | No |
| Hi-DPI | **Native resolution** | Partial | No |
| TypeScript | **Yes** | No | No |
| Maintained | **2026** | 2020 | 2019 |
| Bundle size | **~8 KB** | ~45 KB | ~12 KB |

## Controls

| Action | Result |
|--------|--------|
| **Move mouse** | Magnifier follows cursor |
| **Scroll up** | Zoom in (more magnification) |
| **Scroll down** | Zoom out (less magnification) |
| **Click** | Pick color under center pixel |
| **Esc** | Cancel (returns empty string) |
| **Right-click** | Cancel (returns empty string) |

## Requirements

- Electron >= 20.0.0
- Node.js >= 16

## License

[MIT](LICENSE) -- Caldis
