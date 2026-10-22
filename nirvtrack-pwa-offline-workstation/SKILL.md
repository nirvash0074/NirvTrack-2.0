---
name: nirvtrack-pwa-offline-workstation
description: Progressive Web App (PWA) offline architecture, Service Worker cache strategies, localStorage multi-workspace schema persistence, JSON/CSV data backup, and local desktop server operations for NirvTrack. Use whenever modifying sw.js, manifest.json, start-app scripts, offline cache management, localStorage storage keys, or import/export data pipelines.
---

# NirvTrack PWA & Offline Workstation

A master guide for managing NirvTrack's offline-first runtime, Progressive Web App (PWA) installation, Service Worker asset caching, and client-side `localStorage` data management.

---

## 1. PWA & Service Worker Cache Lifecycle (`sw.js`)

NirvTrack functions as a standalone Progressive Web App installable on Windows, macOS, Android, and iOS.

### 1.1 Cache Strategy: Network-First with Cache Fallback
- For same-origin application assets (`index.html`, `styles.css`, `app.js`, `patch-notes-data.js`, `ai-copilot-engine.js`), the Service Worker attempts a network fetch first, updates the cache upon a 200 OK response, and falls back to cached copies if offline.
- External Google/Supabase/Firebase authentication endpoints are explicitly bypassed and never cached.

### 1.2 Precache Assets Registry
Whenever a new modular script or static asset is added to the project, register it in `PRECACHE_ASSETS` in [sw.js](file:///c:/Users/John%20Alvin%20Baylon/OneDrive/AI%20Projects/NirvTrack%202.0/sw.js):
```javascript
const CACHE_NAME = 'nirvtrack-v1.20261023.104';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './patch-notes-data.js',
  './ai-copilot-engine.js',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];
```

### 1.3 Cache Invalidation & Version Bumping
Whenever pushing a release:
1. Increment `CACHE_NAME` in `sw.js`.
2. The `activate` event automatically evicts prior stale caches and claims clients immediately via `self.clients.claim()`.

---

## 2. Web App Manifest & App Launch Shortcuts (`manifest.json`)

[manifest.json](file:///c:/Users/John%20Alvin%20Baylon/OneDrive/AI%20Projects/NirvTrack%202.0/manifest.json) configures standalone desktop and mobile display:
- **Display Mode**: `"standalone"` with orientation `"any"`.
- **Theme Color**: `#100e24` (Deep Aurora background).
- **App Shortcuts**: Direct jump to `"/?tab=expenses&quickAdd=1"` and `"/?tab=budget"`.

---

## 3. LocalStorage Schema & Key Namespace

All persistent client data resides in the browser's `localStorage` under strict prefixes to prevent collisions:

### 3.1 Key Registry
| Storage Key | Content Description |
| :--- | :--- |
| `budget_master_app_data_v1` | Legacy default single-workspace application state |
| `budget_master_${uid}_app_data_v1` | Isolated dataset for active profile / guest session |
| `budget_master_${uid}_workspaces_index_v2` | Multi-workspace index registry |
| `budget_master_ws_${workspaceId}_data` | Individual container storage for custom workspaces |
| `budget_master_gemini_api_key` | User BYOK Google Gemini API key |
| `budget_master_gemini_model` | Selected Gemini model (`gemini-3.8-flash`) |
| `budgetMaster_userTier` | Entitlement tier simulation (`free`, `pro`, `executive`) |
| `budgetMasterUIMode` | Layout UI mode (`default`, `minimalist`, `mobile`) |

### 3.2 Data Deserialization & Self-Healing
When `loadData()` executes on `DOMContentLoaded`:
1. It queries `localStorage.getItem(getStorageKey())`.
2. If data exists, it validates structures, merges default categories if missing, and assigns budget types (`needs`, `wants`).
3. If no data exists, it initiates a fresh $0 starting ledger via `applyZeroState()`.

---

## 4. Data Portability: Backup & Restore Pipelines

Because NirvTrack stores data locally, export and import tools provide user data sovereignty:

### 4.1 JSON Full Backup (`exportJSONBackup()`)
- Serializes active workspace settings, category envelopes, expense ledgers, recurring bills, and savings goals into an indented `.json` file.
- Generates timestamped download filename: `NirvTrack-Backup-YYYY-MM-DD.json`.

### 4.2 JSON Restore (`importJSONBackup()`)
- Validates payload structure, checks for valid category and transaction arrays, and writes directly to `appState`.
- Calls `saveData()` and `updateAllViews()` to render the restored state immediately.

### 4.3 CSV Variance Report (`exportCSVReport()`)
- Formats category budget targets vs. actual expenses and variance percentages for export into Excel or Google Sheets.

---

## 5. Local Workstation Runner (`start-app.ps1` & `start-app.bat`)

NirvTrack includes a self-contained local server built on .NET `System.Net.HttpListener`:
- **Port**: Default `http://localhost:7777/` (auto-fallback to port `7788`).
- **Zero Dependencies**: Requires no Node.js, Python, or npm installation.
- **Cache-Busting Headers**: Sends `no-cache, no-store` HTTP headers to prevent browser caching during development and debugging.
