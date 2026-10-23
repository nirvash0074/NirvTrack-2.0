# Agent Instructions

> This file is mirrored across CLAUDE.md, AGENTS.md, and GEMINI.md so the same instructions load in any AI environment.

You operate within a 3-layer architecture that separates concerns to maximize reliability. LLMs are probabilistic, whereas most business logic is deterministic and requires consistency. This system fixes that mismatch.

## The 3-Layer Architecture

**Layer 1: Directive (What to do)**  
- Basically just SOPs written in Markdown, live in `directives/`  
- Define the goals, inputs, tools/scripts to use, outputs, and edge cases  
- Natural language instructions, like you'd give a mid-level employee

**Layer 2: Orchestration (Decision making)**  
- This is you. Your job: intelligent routing.  
- Read directives, call execution tools in the right order, handle errors, ask for clarification, update directives with learnings  
- You're the glue between intent and execution.

**Layer 3: Execution (Doing the work)**  
- Deterministic Python or shell scripts in `execution/`  
- Environment variables, API tokens, etc. are stored in `.env`  
- Handle API calls, data processing, file operations, automated testing  
- Reliable, testable, fast. Use scripts instead of manual work. Commented well.

## Operating Principles

**1. Check for tools first**  
Before writing a script, check `execution/` per your directive. Only create new scripts if none exist.

**2. Self-anneal when things break**  
- Read error message and stack trace  
- Fix the script and test it again  
- Update the directive with what you learned (API limits, timing, edge cases)

**3. Update directives as you learn**  
Directives are living documents. When you discover constraints, better approaches, common errors, or timing expectations—update the directive.

## NirvTrack 2.0 Specialized Domain Skills Matrix

Always refer to the specialized skill corresponding to the aspect of NirvTrack being designed or modified:

| Specialized Skill | Scope & Responsibilities |
| :--- | :--- |
| **`nirvtrack-core-architect`** | Central `appState` reactive store, component data flow, multi-workspace container switching (`[FEAT-27 v2]`), and high-Z modal stacking architecture (`[FEAT-57]`). |
| **`nirvtrack-fintech-engine`** | Mathematical & financial logic: 50/30/20 envelope allocation, semi-monthly income schedules (15th & 30th), Month-End Surplus Sweeper (`[FEAT-49]`), Safe-to-Spend pacing, debt amortization, and precision rounding. |
| **`nirvtrack-pwa-offline-workstation`** | PWA offline architecture: Service Worker (`sw.js`) precaching, Web App Manifest (`manifest.json`), `localStorage` key namespacing (`budget_master_*`), quota management, schema migrations, and JSON/CSV backup & restore. |
| **`nirvtrack-ui-design-system`** | Visual styling & design tokens: 5 theme palettes (Aurora, Dark, Midnight, Emerald, Cyber), 3 layout modes (Executive, Minimalist, Mobile Pocket), Chart.js palettes, Power BI KPI cards, and interactive GUI playground widgets. |
| **`nirvtrack-ai-copilot`** | Client-side AI intelligence: BYOK Google Gemini integration, dynamic financial context introspection (`getDynamicFinancialContextPrompt()`), natural-language quick-add, and safe AI mutation with 1-click undo. |
| **`nirvtrack-security-hardening`** | Client-side security: XSS injection defense (`escapeHTML`), DOM property sanitization, zero-eval policy, BYOK Gemini key protection, and safe JSON backup schema validation. |
| **`nirvtrack-feature-auditor-tester`** | Comprehensive feature auditor: coordinates multi-skill regression testing, automated test execution via `execution/run_full_audit.js`, DOM bindings, and arithmetic validation. |
| **`nirvtrack-testing-qa-guardian`** | Quality assurance & regression prevention: Mandatory Gate 1 (Pre-implementation feasibility) and Gate 2 (Post-implementation regression audit), arithmetic sanity checks, and local server smoke testing. |
| **`nirvtrack-release-chronicler`** | Release management & documentation: Mandatory 4-step pipeline updating `APP_PATCH_NOTES` in `app.js` with interactive GUI playground, synchronizing `#faqAccordionList` in `index.html`, and incrementing version cache busters. |
| **`nirvtrack-paymongo-subscription-pipeline`** | End-to-end payment & tier fulfillment: Cloudflare Worker edge webhook (`/api/paymongo-webhook`), edge checkout session proxy (`/api/paymongo-checkout`), client redirect return URL auto-unlock (`?payment=success`), manual verification fallback, and Supabase `public.users` tier synchronization. |

---

## Mandatory Release Synchronization Rule
Whenever ANY changes, new features, UI improvements, or bug fixes are implemented:
1. **Prepend release entry to `APP_PATCH_NOTES` in `app.js`** with title, date, categorized tags (`feature`, `improvement`, `fix`), and an interactive `gui` sandbox descriptor.
2. **Update Visual FAQ in `index.html`** (`#faqAccordionList`) if new workflows or controls were added or altered.
3. **Bump Version Displays & Cache Busters**:
   - Update `#brandPatchBadge` and `<title>` in `index.html`.
   - Increment script query parameters (`app.js?v=...`, `patch-notes-data.js?v=...`, `styles.css?v=...`).
4. **Zero Regression Guarantee**: Preserve 100% mathematical integrity across 50/30/20 allocations, Surplus Sweeper balance equations, and local storage workspace containers.
