---
name: nirvtrack-security-hardening
description: Client-side application security, XSS injection prevention, local storage privacy, safe JSON backup validation, and zero-leak BYOK credential protection for NirvTrack. Use whenever auditing or writing HTML templates, handling user inputs, importing/exporting backup files, storing local API keys, or validating client-side security boundaries.
---

# NirvTrack Security Hardening

A master client-side application security and defensive programming protocol designed to protect user financial records, prevent Cross-Site Scripting (XSS), guarantee local data integrity, and shield Bring-Your-Own-Key (BYOK) AI credentials.

---

## 1. Zero-Leak Secret & Credential Protection

NirvTrack is an offline-first application with client-side AI integration (Google Gemini).

### 1.1 BYOK (Bring Your Own Key) Storage Rules
- User-provided Gemini API keys (`budget_master_gemini_api_key`) must NEVER be transmitted to any third-party logging or telemetry service.
- Keys must only be used in direct client-to-API calls (`https://generativelanguage.googleapis.com/...`) using secure headers (`x-goog-api-key`).
- Keys must be stored exclusively in `localStorage` under namespaced keys and cleared immediately if the user clicks "Clear Key" or "Reset All".
- Never hardcode private API keys in `app.js`, `ai-copilot-engine.js`, or commit them to source control.

---

## 2. Client-Side XSS & DOM Injection Defenses

Because NirvTrack operates in vanilla JavaScript with dynamic HTML string interpolation and `.innerHTML` updates, every dynamic user input must be sanitized.

### 2.1 Strict String Escaping (`escapeHTML`)
Always wrap user-provided strings before inserting into `.innerHTML` or template literals:

```javascript
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

### 2.2 Unsafe HTML Anti-Patterns
- ❌ **Forbidden**: Direct interpolation of user input:
  ```javascript
  // VULNERABLE
  row.innerHTML = `<span class="desc">${expense.description}</span>`;
  ```
- ✅ **Required**: Escaped interpolation or safe DOM property setting:
  ```javascript
  // SAFE
  row.innerHTML = `<span class="desc">${escapeHTML(expense.description)}</span>`;
  // OR
  const span = document.createElement('span');
  span.textContent = expense.description;
  ```

### 2.3 Zero `eval()` Policy
- Never use `eval()` or `new Function()` to execute dynamic formulas or strings.
- Math inputs (such as inline calculators in expense amounts) must use tokenized, safe math parsers (`parseMathExpression`) that restrict characters strictly to `[0-9+\-*/.()]` with zero script execution risk.

---

## 3. Safe JSON Backup & Restore Validation

Users can export and import JSON backup snapshots. Because backups are unauthenticated files supplied by the user, import operations represent a potential attack surface.

### 3.1 Strict Schema & Type Validation
Before accepting any imported JSON payload:
1. **JSON Parse Guard**: Always wrap `JSON.parse()` in a `try...catch` block.
2. **Root Type Check**: Verify the payload is a plain JavaScript object (not an array or primitive).
3. **Array Structure Validation**: Validate that `categories`, `expenses`, `plannedExpenses`, and `recurringBills` are genuine arrays:
   ```javascript
   if (!Array.isArray(importedData.expenses)) {
     throw new Error("Invalid backup format: expenses must be an array.");
   }
   ```
4. **Sanitize Field Types**:
   - `amount`: Force numeric conversion with `Number(item.amount) || 0`, clamp to `>= 0`.
   - `id`: Validate format and strip invalid characters.
   - `date`: Validate against ISO regex (`/^\d{4}-\d{2}-\d{2}$/`).
   - `description`: Sanitize and clamp length (`<= 120` chars).

---

## 4. LocalStorage Quota & Data Isolation

### 4.1 Storage Key Partitioning
- All local storage entries must use strict prefix namespaces (`budget_master_*`).
- Multi-workspace datasets must never leak into one another:
  * Workspace 1: `budget_master_ws_default_app_data_v1`
  * Workspace 2: `budget_master_ws_custom1_app_data_v1`

### 4.2 LocalStorage Quota Exceeded Safeguard
Wrap all `localStorage.setItem()` calls in error handlers to handle `QuotaExceededError`:
```javascript
try {
  localStorage.setItem(storageKey, serializedData);
} catch (e) {
  if (e.name === 'QuotaExceededError' || e.code === 22) {
    showToast('Local storage full. Please export a JSON backup and archive older transactions.', 'warning', 8000);
  }
}
```
