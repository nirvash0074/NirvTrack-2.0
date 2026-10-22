---
name: nirvtrack-ui-design-system
description: Design system guidelines, CSS custom properties, 5 theme palettes (Aurora, Dark, Midnight, Emerald, Cyber), 3 layout modes (Executive, Minimalist, Mobile Pocket), Power BI-inspired KPI cards, Chart.js palettes, and interactive GUI components for NirvTrack. Use whenever styling UI components, creating new modals or cards, updating styles.css, implementing responsive breakpoints, or adding interactive widgets.
---

# NirvTrack UI Design System

A master visual design and component architecture guide for NirvTrack. NirvTrack is inspired by Microsoft Power BI and modern fintech dashboards, balancing high-density financial data presentation with modern glassmorphic aesthetics.

---

## 1. Visual Philosophy & Token Hierarchy

NirvTrack employs semantic CSS custom variables declared in [styles.css](file:///c:/Users/John%20Alvin%20Baylon/OneDrive/AI%20Projects/NirvTrack%202.0/styles.css). Never use hardcoded hex colors for structural elements.

### 1.1 Core Semantic Color Tokens
```css
:root {
  --font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Surface & Background */
  --bg-primary: #100e24;
  --bg-secondary: #171533;
  --bg-card: rgba(30, 27, 75, 0.45);
  --bg-input: #1e1b4b;

  /* Typography */
  --text-primary: #f8fafc;
  --text-secondary: #cbd5e1;
  --text-muted: #94a3b8;

  /* Accents & Signals */
  --primary: #6366f1;
  --primary-hover: #4f46e5;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --cyan: #06b6d4;
  --border-subtle: rgba(255, 255, 255, 0.08);
}
```

---

## 2. The 5 Core Theme Palettes

NirvTrack supports 5 visual themes applied via `body[data-theme]` and `.theme-*` classes:

| Theme Name | Attribute | Aesthetic Character | Accent Palette |
| :--- | :--- | :--- | :--- |
| **Aurora Glow** (Default) | `data-theme="aurora"` | Deep astral navy with luminous violet/cyan aura | `#6366f1` Indigo, `#06b6d4` Cyan |
| **Dark Slate** | `data-theme="dark"` | Power BI enterprise charcoal dark | `#3b82f6` Blue, `#10b981` Emerald |
| **Midnight OLED** | `data-theme="midnight"` | Pure #000000 true black for OLED contrast | `#818cf8` Neon Violet, `#38bdf8` Sky |
| **Emerald Wealth** | `data-theme="emerald"` | Deep banking green with mint & gold accents | `#059669` Emerald, `#eab308` Gold |
| **Cyber Neon** | `data-theme="cyber"` | High-contrast neon terminal | `#d946ef` Magenta, `#06b6d4` Neon Cyan |

---

## 3. The 3 Responsive Layout Modes

Users can toggle their view layout via `#uiModeSelect` or automatic viewport detection:

### 3.1 Executive Mode (`default`)
- Multi-column dense analytics grid designed for wide screens (`> 1024px`).
- Features side-by-side KPI grid, monthly trend charts, category variance tables, and collapsible sidebar.

### 3.2 Minimalist Mode (`minimalist`)
- Single-column, distraction-free view designed for focused daily expense tracking.
- Collapses dense analytical charts into discrete popovers and hides non-essential peripheral metrics.

### 3.3 Mobile Pocket Mode (`mobile`)
- Auto-triggered when viewport width is `<= 1024px` or on touch devices.
- Replaces left sidebar with top compact header and bottom navigation dock:
  * Bottom Dock: `Home`, `Budget`, `Add (+ FAB)`, `Expenses`, `More`.
  * Floating Action Button (FAB) triggers quick expense logging with thumb-friendly controls.

---

## 4. Power BI Component Archetypes

### 4.1 KPI Summary Cards (`.kpi-card`)
- High-contrast figures formatted with `--font-mono`.
- Includes mini sparkline or utilization progress pill.
- Subtitle reveals comparison against income or monthly variance.

### 4.2 Interactive Budget Allocation Cards (`.budget-cat-card`)
- Category icon badge, category title, and editable target amount.
- Real-time spend progress bar dynamically colored:
  * Green (`< 85%` utilization)
  * Amber (`85% - 99%` near capacity)
  * Crimson (`>= 100%` overspend condition)

### 4.3 Chart.js Theme Synchronization (`getChartThemeColors()`)
Always retrieve Chart.js colors through `getChartThemeColors()` so chart gridlines, labels, and datasets re-render dynamically when switching themes:
```javascript
const colors = getChartThemeColors();
chart.options.scales.x.grid.color = colors.gridLine;
chart.options.scales.x.ticks.color = colors.textMuted;
chart.update();
```

---

## 5. Interactive GUI Playground Descriptors (Patch Notes Rule)

Per [AGENTS.md](file:///c:/Users/John%20Alvin%20Baylon/OneDrive/AI%20Projects/NirvTrack%202.0/AGENTS.md), every new button or interactive workflow must include a GUI playground descriptor:

```javascript
gui: {
  type: 'button', // 'button' | 'badge' | 'widget' | 'input'
  previewHtml: '<button class="btn btn-xs btn-outline-cyan">🚀 Test Component</button>',
  actionLabel: 'Try It Live 🚀',
  actionCode: 'openModal("myModal");'
}
```
This renders a live, interactive test playground directly inside the Patch Notes changelog modal.
