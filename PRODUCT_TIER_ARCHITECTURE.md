# 💎 Budget Master — Product Tiering Architecture & Feature Classification Matrix

> **Document Version**: `1.2.0`  
> **Last Updated**: `October 2026`  
> **Status**: Approved Blueprint for Monetization & Expansion Planning  
> **Scope**: Classification of existing features (`[FEAT-01]` through `[FEAT-67]`) and strategic roadmap for future features (`[FEAT-68+]`).

---

## 🧭 Executive Summary & Core Product Philosophy

Budget Master follows a **Value-First, Non-Predatory Freemium Architecture**. The core application must be 100% usable and genuinely helpful without requiring a credit card, while premium tiers monetize **time-saving automation**, **deep wealth intelligence**, and **multi-entity/business isolation**.

### The 4 Golden Rules of This Tiering Model:

1. **The "Core Intent" Rule (Never Cripple Free)**:
   A user must be able to solve their fundamental problem (*"Am I spending within my means this month?"*) without hitting a paywall. If an app limits basic custom categories or hides remaining balances, users churn immediately. Trust and organic word-of-mouth are earned in the Free tier.
2. **The "Prerequisite Integrity" Rule (Never Invert Dependencies)**:
   If a feature is gated in a premium tier, its prerequisite foundations **MUST NEVER be gated in an equal or higher tier**. For example, Cloud Authentication (`[FEAT-18]`) and Single-Workspace Cloud Sync (`[FEAT-20]`) are part of **Free Core** because users cannot subscribe, login, or access multi-workspace features (`[FEAT-27 v2]`) without authenticated cloud accounts.
3. **The "Time vs. Money" Rule (Pro Tier Monetizes Friction)**:
   Free users spend *manual time* logging and categorizing. Pro users pay to save hours through bank statement importers, Gmail alert scrapers, merchant memory, bulk actions, and automated recurring bills.
4. **The "Stake & Scale" Rule (Executive Tier Monetizes Complexity & Capital)**:
   Users managing multiple income streams (Personal vs. Business/LLC vs. Freelance), sinking funds, compound interest runways, and multi-device cloud backups have higher financial stakes and gladly pay a premium for a dedicated command center.

---

## 📊 High-Level Tier Comparison Matrix

| Dimension | 🟢 Tier 1: Free Core | 🔵 Tier 2: Budget Master Pro | 🟣 Tier 3: Budget Master Executive |
| :--- | :--- | :--- | :--- |
| **Target Persona** | Everyday budgeters, students, beginners | Busy professionals, household CFOs | Freelancers, business owners, FIRE seekers |
| **Value Proposition** | Complete, reliable personal expense tracking | Zero-effort automation & spending discipline | Multi-workspace command center & wealth intelligence |
| **Workspaces** | 1 Active Workspace ("Personal") | Up to 5 Workspaces (Personal + Side Hustles) | Unlimited Isolated Workspaces (99,999 Books) |
| **Data Storage** | LocalStorage + Cloud Auth & Single-Workspace Sync | 5 Cloud Workspaces + Full CSV/JSON Portability | Real-time Cloud Sync (Unlimited Workspaces + VIP Priority) |
| **Bills & Liabilities** | Manual entry in expense ledger | Automated Recurring Bills Calendar & Auto-Poster | Automated Bills + Sinking Funds & Multi-Goal Projection Hub |
| **Analytics** | Monthly Variance & Top Categories | Pacing Meters, Scorecard & Transaction Drilldowns | Savings Analyst Waterfall, 50/30/20 Diagnostic, Runway Simulator |
| **AI Copilot (Gemini)** | Full BYOK Assistant + Batch Natural Language Entry | BYOK Assistant + Batch Entry + Gmail Alert Scanner | BYOK Assistant + Batch Entry + Executive Briefings |
| **UI Customization** | Light/Dark Theme, Fixed Grid | Minimalist Zen / Mobile Pocket / Executive Presets | Multi-Page Custom UI Studio (Reorder & Hide across 6 pages) |
| **Competitive Pricing** | **₱0 / $0 Free Forever** | **₱199/mo** (or **$3.99/mo**; ₱1,790/yr) | **₱599/mo** (or **$9.99/mo**; ₱5,390/yr) |

---

## 🔍 Master Feature Audit & Classification Table (`[FEAT-01]` to `[FEAT-67]`)

| Feature Tag | Feature Name | Tier | Category | Strategic Rationale & Justification |
| :--- | :--- | :---: | :---: | :--- |
| **`[FEAT-01]`** | Monthly Budget Cycle Navigation | **Free Core** | Core Budget | Essential monthly cycle navigation (month picker, prev/next). |
| **`[FEAT-02]`** | Income Planning (15th & 30th + Bonus) | **Free Core** | Core Budget | Essential cashflow baseline. Unique advantage over generic trackers. |
| **`[FEAT-03]`** | Custom Category Creation (Icons & Colors) | **Free Core** | Categorization | Users must be able to model their unique personal lives. |
| **`[FEAT-04]`** | Category Editing & Deletion | **Free Core** | Categorization | Baseline data maintenance. |
| **`[FEAT-05]`** | Daily Expense Logging & Transaction Ledger | **Free Core** | Transactions | Fundamental function of the entire application. |
| **`[FEAT-06]`** | Budget vs. Actual Variance Summary | **Free Core** | Analytics | Answers the core question: *Am I over or under budget?* |
| **`[FEAT-07]`** | Dashboard Overview (KPIs, Donut & Bar Charts) | **Free Core** | Dashboard | Instant visual awareness of monthly spending health. |
| **`[FEAT-08]`** | Multi-Currency Selector (PHP, USD, EUR, etc.) | **Free Core** | General | Table-stakes for international and local usability. |
| **`[FEAT-09]`** | Sample Demo Dataset Loader | **Free Core** | Onboarding | Helps first-time users explore the app with realistic figures. |
| **`[FEAT-10]`** | Full JSON Backup & CSV Data Export | **Pro** | Data Utility | Data freedom for tax preparation, archiving, or Excel work. |
| **`[FEAT-11]`** | Dark Mode & Light Mode System | **Free Core** | UI/Theme | Modern visual ergonomics expectation. |
| **`[FEAT-12]`** | Multi-Month Aggregation (3M, 6M, YTD, Full Year) | **Executive** | Analytics | High-level financial reporting for wealth and annual tax analysis. |
| **`[FEAT-13]`** | LocalStorage Persistence Engine | **Free Core** | Data/Storage | 100% private, offline-first reliability out of the box. |
| **`[FEAT-14]`** | Clear Month Expenses Utility | **Free Core** | Maintenance | Basic data management tool. |
| **`[FEAT-15]`** | Inline Category Card Budget Editing | **Free Core** | Core Budget | Core UX ergonomics for setting envelopes directly in grid. |
| **`[FEAT-16]`** | Reset All Amounts to Zero | **Free Core** | Maintenance | Clean slate utility. |
| **`[FEAT-17]`** | Responsive Mobile / Tablet Layout | **Free Core** | Accessibility | Baseline cross-device usability. |
| **`[FEAT-18]`** | Firebase Cloud Authentication (Google/Email) | **Free Core** | Cloud/Sync | **Prerequisite Foundation**: All users can securely sign in and link sessions. |
| **`[FEAT-19]`** | Built-in App Guide & FAQ Knowledge Base | **Free Core** | Help | In-app self-service education. |
| **`[FEAT-20]`** | Cloud Firestore Real-Time Database Sync | **Free Core** | Cloud/Sync | **Prerequisite Foundation**: Single-workspace cloud sync for all users. |
| **`[FEAT-21]`** | Category Multi-Select & Bulk Month Copy | **Pro** | Productivity | Bulk operations save repetitive monthly setup time. |
| **`[FEAT-22]`** | Standard Payment Methods (Cash, Card, Transfer) | **Free Core** | Transactions | Basic transaction classification. |
| **`[FEAT-23]`** | Click-to-Edit Budget Target Pills | **Free Core** | Core Budget | Fast 1-click envelope allocation updates. |
| **`[FEAT-24]`** | Digital E-Wallets (GCash, Maya, PayPal) | **Free Core** | Transactions | Modern digital wallet support for daily life. |
| **`[FEAT-25]`** | Detailed Variance Scorecard Table & Sorting | **Pro** | Analytics | Deep analytical table for thorough spending audits. |
| **`[FEAT-26]`** | Highest Spending Top Categories Widget | **Free Core** | Dashboard | Immediate awareness of top spending drains. |
| **`[FEAT-27 v2]`** | Isolated Multi-Workspaces (Business / Personal) | **Executive** | Architecture | **#1 Monetization Trigger**: Separate business from personal books (99,999). |
| **`[FEAT-28]`** | Month-Scoped Category Scoping & 1-Click Restore | **Pro** | Core Budget | Seasonal/one-off category isolation without corrupting past data. |
| **`[FEAT-29]`** | Category Drilldown Accordions in Scorecard | **Pro** | Analytics | Inspect exact itemized transactions inside any category row. |
| **`[FEAT-30]`** | Safe-to-Spend Daily Allowance Calculator | **Pro** | Discipline | **High Emotional Value**: Real-time dynamic daily spending cap. |
| **`[FEAT-31]`** | Single-Key Fast Navigation (`N`, `D`, `B`, `E`, `A`) | **Free Core** | Ergonomics | Fast keyboard shortcuts for power users. |
| **`[FEAT-32]`** | Recurring Bills & Subscriptions Calendar Hub | **Pro** | Liabilities | Tracks recurring commitments and due dates. |
| **`[FEAT-33]`** | Proactive Bill Due & Overspend Alerts | **Pro** | Discipline | Prevents late fees and mid-month budget overruns. |
| **`[FEAT-34]`** | Auto-Post Recurring Bills to Expense Ledger | **Pro** | Automation | Eliminates manual entry for recurring monthly bills. |
| **`[FEAT-35]`** | Collapsible Keyboard Shortcuts Guide HUD | **Pro** | Ergonomics | Sleek floating visual HUD for desktop power users. |
| **`[FEAT-36]`** | Multi-Layout UI Presets (Executive / Minimalist) | **Pro** | UI/Theme | Tailored interfaces for different working styles. |
| **`[FEAT-37]`** | Bills Interactive Column Sorting & Status Filters | **Pro** | Liabilities | Paid / Pending / Overdue pipeline management. |
| **`[FEAT-38]`** | Savings Analyst 7-Metric Cashflow Waterfall | **Executive** | Wealth | C-Suite cashflow diagnostic from gross income to true surplus. |
| **`[FEAT-39]`** | 50/30/20 Rule Classification & Lifestyle Benchmark | **Executive** | Wealth | Evaluates living standards against healthy wealth benchmarks. |
| **`[FEAT-40]`** | Smart Unified Filter Popover | **Pro** | Productivity | Multi-attribute search (keyword, category, date, method). |
| **`[FEAT-41]`** | CSV Batch Upload & Intelligent Importer | **Pro** | Automation | Huge time saver: import 100+ transactions in seconds. |
| **`[FEAT-42]`** | Budget Classification Filter Tabs (Needs / Wants) | **Executive** | Wealth | Seamless alignment with 50/30/20 envelope structures. |
| **`[FEAT-43]`** | Emergency Runway & Compound Wealth Simulator | **Executive** | Wealth | FIRE planning: calculates runway months and 10-year growth. |
| **`[FEAT-44]`** | Executive Privacy Stealth Mode (Quick Blur `H`) | **Executive** | Privacy | One-click blur of financial figures in coffee shops and planes. |
| **`[FEAT-45]`** | Zero-Based Budgeting & 50/30/20 Auto-Optimizer | **Executive** | Optimization | Algorithmic "every dollar has a job" buffer distributor. |
| **`[FEAT-46]`** | Expense Batch Multi-Select & Bulk Actions | **Pro** | Productivity | Mass category reassignment and batch cleanup. |
| **`[FEAT-47]`** | Merchant Memory & Smart Quick-Fill Engine | **Pro** | Automation | Autocomplete learns descriptions, amounts, and categories. |
| **`[FEAT-48]`** | Universal Spotlight Command Palette (`Ctrl+K`) | **Pro** | Productivity | Superhuman-style global search and action launcher. |
| **`[FEAT-49]`** | 1-Click Month-End Surplus Sweeper | **Executive** | Wealth | Locks unspent surplus directly into savings reserves. |
| **`[FEAT-50]`** | Pacing Indicators (Pro) & Timeline Banner (Exec) | **Pro / Exec** | Discipline/Wealth | Real-time burn badges (Pro) & Multi-month sweep banner (Exec). |
| **`[FEAT-51]`** | Sinking Funds & Savings Goals Hub | **Executive** | Wealth | Milestone savings pots, deposit slips, and transaction history. |
| **`[FEAT-52]`** | Workspace Custom UI Layout & Widget Studio | **Executive** | Customization | Reorder widgets and toggle visibility across all 6 pages. |
| **`[FEAT-53]`** | Slide-Over System & Data Tools Drawer | **Free Core** | System/Tools | Dedicated zero-clutter slide-over drawer for database backups, reset utilities, and workspace tools. |
| **`[FEAT-54]`** | Admin Command Center & Customer Directory | **Executive** | Governance | Verified Admin directory listing registered users, auth providers, creation date, and last login date. |
| **`[FEAT-55]`** | Administrative User Removal & Directory CSV Export | **Executive** | Governance | Secure Firestore user purge with cascaded subcollection cleanup and 1-click customer roster CSV export. |
| **`[FEAT-56]`** | Tri-Tier Ambient Aura & Dynamic Modal Accents | **Free Core** | UI/Theme | Glowing ambient status aura, dynamic modal header accents, SVG tier badges, and high-contrast Light/Dark themes. |
| **`[FEAT-57]`** | Layering & High-Z Modal Stacking Architecture | **Free Core** | UI/Theme | True viewport layering and z-index hierarchy (`z-index: 20000`) preventing subdialogs from being trapped behind overlays. |
| **`[FEAT-58]`** | Zen Minimalist Sidebar Floating Filter Popover | **Pro** | UI/Theme | Floating popover positioned outside the 76px minimalist slim-rail dock with 3-column action grid and period selector. |
| **`[FEAT-59]`** | Bulk Category CSV Importer & Template Engine | **Free Core** | Core Budget | Bulk CSV parser supporting default fields Category & Amount with smart emoji auto-assignment and sample template download. |
| **`[FEAT-60]`** | Category CSV Target Scope Engine (Current Month vs. Global) | **Free Core** | Core Budget | Interactive CSV import modal with scope selector defaulting to isolated Current Month or Global all-month targets. |
| **`[FEAT-61]`** | AI-Powered FAQ Copilot (BYOK Google Gemini Engine) | **Free Core** | Help & AI | 100% $0 developer cost: users connect their own free Google AI Studio key for conversational FAQ guidance (plus smart local fallback). |
| **`[FEAT-62]`** | AI Feature Recommendation Collector & Admin Wishlist Hub | **Free / Exec** | Product & Governance | Captures missing feature requests from AI chats into a ranked Admin Command Center Wishlist (`Rank #1`–`#5`, status workflow, CSV export). |
| **`[FEAT-63]`** | NirvTrack AI Multi-Entry Commands & Batch Ledger Formats | **Free Core** | Core Budget & AI | Single & multi-line natural language parser for batch categories, expenses, and recurring bills with instant 1-click Master Undo (`↩️ Undo All`). |
| **`[FEAT-64]`** | Gmail Transaction Scanner & Staging Vetting Inbox | **Pro** | Automation | Client-side bank & e-wallet alert parser extracting merchant, amount, date into an interactive staging table for vetting before posting to ledger. |
| **`[FEAT-65]`** | Automated PayMongo Webhook & Instant Subscription Upgrade Engine | **Free / System** | Billing / Infrastructure | Server-side webhook handler updating Cloud Firestore `tierStatus`, `paymentProvider`, and timestamps within 2 seconds. |
| **`[FEAT-66]`** | Dynamic Tier-Matched Celebration Modal with Confetti & Harmonic Chime | **Free Core** | UI/UX Engine | Theme-matched celebratory modal (Gold/Emerald vs. Cyan) with 60fps micro-confetti, Web Audio harmonic chord chime arpeggio, and live receipt strip. |
| **`[FEAT-67]`** | Real-Time Centavo Dynamic Price Recording & Cloud Firestore Sync | **Free / System** | Billing / Infrastructure | Dynamically reads exact centavos paid from PayMongo storefronts, computes live peso amount, and records exact price in Firestore `amountPaid`. |

---

## 📦 Detailed Tier Profiles & Personas

### 🟢 Tier 1: Free Core ("The Complete Personal Budgeter")
* **Target Audience**: Students, beginners, and everyday users budgeting personal living expenses.
* **Core Value**: Provides a trustworthy, ad-free, 100% complete budgeting tool that never expires.
* **Primary Scope**:
  - Full monthly paycheck income planning (`15th & 30th`).
  - Unlimited custom category envelopes with custom icons and color pickers.
  - Manual daily expense logging with payment method tagging (Cash, Cards, E-Wallets).
  - Executive Financial Dashboard with KPI summary and Top Spending Categories.
  - Budget vs. Actual variance summary.
  - LocalStorage device persistence (offline-first, no account required).
  - Dark and Light themes.
  - Single Workspace (*"Personal Finances"*).

---

### 🔵 Tier 2: Budget Master Pro ("The Productivity & Automation Powerhouse")
* **Target Audience**: Busy professionals and household budgeters who want to stop budget leaks and eliminate manual entry friction.
* **Core Value**: Reclaims 3–5 hours per month through automation and proactive spending discipline.
* **Key Upgrade Hooks**:
  - ⚡ **Safe-to-Spend Daily Allowance**: Answers *"Can I afford dinner tonight without breaking my month?"*
  - 📅 **Recurring Bills & Auto-Posting**: Eliminates manual bill tracking and prevents late fees.
  - 📂 **Bank CSV Importer**: Upload statements and import 100 transactions in seconds.
  - 🧠 **Merchant Memory Autocomplete**: Learns merchants, amounts, and categories automatically.
  - 📊 **Category Pacing & Burn-Rate Badges**: Shows *Fast Burn* / *Frugal* warnings in real time.
  - 🔎 **Spotlight Command Palette (`Ctrl+K`)**: Universal keyboard launcher for power users.
  - 📑 **Variance Scorecard with Accordion Drilldowns**: Inspect underlying transactions inside category rows.
  - 💾 **CSV / JSON Data Exports**: Full portability for tax prep and spreadsheet backups.

---

### 🟣 Tier 3: Budget Master Executive ("The Wealth Intelligence & Multi-Entity Hub")
* **Target Audience**: High-income earners, freelancers, small business owners, investors, and FIRE enthusiasts.
* **Core Value**: Replaces multiple expensive accounting tools (e.g. QuickBooks, YNAB) with a single multi-entity command center.
* **Key Upgrade Hooks**:
  - 🏢 **Isolated Multi-Workspaces**: Separate books for Personal, LLC, Freelance, Rental Property, or Side Hustle with zero cross-leakage.
  - ☁️ **Cloud Firestore Real-Time Sync**: Access across desktop, tablet, and mobile with user accounts.
  - 💎 **Savings Analyst & 50/30/20 Diagnostic**: 7-metric cash flow waterfall and lifestyle benchmark.
  - 🎯 **Sinking Funds & Savings Goals Hub**: Milestone savings pots with quick deposits and goal tracking.
  - 🧹 **1-Click Month-End Surplus Sweeper**: Sweeps unspent budget surpluses into permanent wealth reserves.
  - ⚖️ **Zero-Based Budget Auto-Optimizer**: Algorithmic "every dollar has a job" rebalancing.
  - 🛡️ **Emergency Runway & Compound Interest Growth Simulator**.
  - 🕶️ **Executive Privacy Stealth Mode**: One-click quick-blur (`H`) for public cafes and flights.
  - 📐 **Workspace Custom UI Layout Studio**: Reorder and toggle visibility for all 25 widgets across 6 pages.

---

## ⚖️ Industry Benchmark Comparison

| Feature Capability | YNAB ($14.99/mo ~ ₱850) | Monarch ($14.99/mo ~ ₱850) | PocketGuard ($7.99/mo ~ ₱450) | **NirvTrack (Our Model)** |
| :--- | :---: | :---: | :---: | :---: |
| **Pricing & Cost Barrier** | $14.99/mo (No Free) | $14.99/mo (No Free) | $7.99/mo (Limited) | **🟢 Free ₱0 • 🔵 Pro ₱199 ($3.99) • 👑 Exec ₱599 ($9.99)** |
| **Core Budgeting & Envelopes** | Paid Only | Paid Only | Paid Only | **🟢 100% Free Forever** |
| **Bi-Monthly Paycheck (15th/30th)** | ❌ Manual | ❌ Manual | ❌ Manual | **🟢 Built-in Native Baseline** |
| **Cloud Auth & 1-Workspace Sync** | Paid Only | Paid Only | Paid Only | **🟢 Free Core (Prerequisite Integrity)** |
| **AI Assistant (Gemini BYOK)** | ❌ Unsupported | Limited | ❌ Unsupported | **🟢 100% Free Core ($0 API Cost)** |
| **Batch Natural Language Entry** | ❌ Unsupported | ❌ Unsupported | ❌ Unsupported | **🟢 Free Core [FEAT-63]** |
| **Safe-to-Spend Daily Allowance** | ❌ Unsupported | Limited | Basic | **🔵 Pro Tier [FEAT-30]** |
| **Recurring Bills Auto-Poster** | Paid | Paid | Paid | **🔵 Pro Tier [FEAT-34]** |
| **Bank CSV & Gmail Alert Scanner** | CSV Only | CSV Only | ❌ Unsupported | **🔵 Pro Tier [FEAT-41 & FEAT-64]** |
| **Multi-Workspaces (Isolated Books)** | ❌ Unsupported | ❌ Unsupported | ❌ Unsupported | **👑 Executive Tier (99,999) 💎 *(Market Differentiator)*** |
| **Real-time Multi-Device Sync** | Paid | Paid | Paid | **🟢 Free (1 WS) • 🔵 Pro (5 WS) • 👑 Exec (Priority)** |
| **7-Metric Savings Waterfall** | ❌ Unsupported | ❌ Unsupported | ❌ Unsupported | **👑 Executive Tier [FEAT-38] 💎 *(Market Differentiator)*** |
| **50/30/20 Diagnostic & Optimizer** | ❌ Unsupported | ❌ Unsupported | ❌ Unsupported | **👑 Executive Tier [FEAT-39 & FEAT-45]** |
| **Sinking Funds Hub & Surplus Sweeper** | Limited | Limited | ❌ Unsupported | **👑 Executive Tier [FEAT-49 & FEAT-51]** |
| **Multi-Page Custom UI Studio** | ❌ None | Limited | Limited | **👑 Executive Tier [FEAT-52]** |

---

## 🛠️ Maintenance & Expansion Guidelines for Future Features (`[FEAT-68+]`)

Whenever a new feature is added, use this 4-question rubric to determine its tier:

1. **Is it a foundational dependency required to access the app or authenticate?**
   - *Yes* ➔ **Free Core** (Prerequisite Integrity: never lock authentication or base single-workspace cloud storage).
2. **Does it enable basic personal budgeting from scratch?**
   - *Yes* ➔ **Free Core** (e.g. basic receipt notes, standard category filter).
3. **Does it save time, reduce manual data entry, or enforce daily discipline?**
   - *Yes* ➔ **Pro Tier** (e.g. statement CSV importer, email scanner, recurring bill auto-poster).
4. **Does it involve multi-entity finances, cloud infrastructure costs, long-term wealth modeling, or executive customization?**
   - *Yes* ➔ **Executive Tier** (e.g. multi-workspace scaling, FIRE compound runway simulator, surplus sweeper, UI layout studio).

---

## 🔒 Soft Limits vs. Hard Locks Strategy

To maintain high user satisfaction without frustrating paywall pop-ups:
* **Workspaces**: Free tier gets 1 full workspace (*Personal*). Clicking `+ New Workspace` opens the Executive upgrade preview.
* **Recurring Bills**: Free tier allows up to 3 active recurring bills; Pro unlocks unlimited bills.
* **Savings Goals**: Free tier allows 1 active milestone goal; Executive unlocks unlimited sinking funds.
* **CSV Imports**: Free tier allows 1 import/month (trial); Pro unlocks unlimited imports.
* **Preview / Stealth Mode**: Executive features remain discoverable with subtle badges (`💎 Exec`), displaying an aspirational walkthrough modal rather than a jarring error.
