# InvoicePro — Local Invoicing App

## Prerequisites

- Node.js 18+
- Python 3.x (required to build better-sqlite3)
- Visual Studio Build Tools (Windows) — see below

### Install build tools (Windows, run as Administrator)

```powershell
npm install --global --production windows-build-tools
```

Or install manually:
1. Download Python from https://python.org — check "Add to PATH"
2. Download VS Build Tools from https://visualstudio.microsoft.com/visual-cpp-build-tools/
   — select "Desktop development with C++"

## Setup

```bash
cd invoice-app
npm install
npm start
```

## Dev mode

Runs Vite dev server on port 5173 + Electron pointed at it.
Hot reload works for React changes.

## Build distributable

```bash
npm run build
```

Output in `out/` folder.
