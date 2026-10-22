# Directive: Run Full Feature Audit & Regression Test Suite

Standard Operating Procedure for auditing NirvTrack's features, financial calculations, DOM bindings, and offline workstation integrity.

## Goal
Verify 100% functionality and arithmetic integrity of NirvTrack 2.0 with zero regressions across all core features.

## Inputs
- Application files: `index.html`, `styles.css`, `app.js`, `patch-notes-data.js`, `ai-copilot-engine.js`, `manifest.json`, `sw.js`
- Test runner: `execution/run_full_audit.js`

## Execution Tools
Run the deterministic Node.js test script:
```powershell
& "C:\Program Files\nodejs\node.exe" "execution/run_full_audit.js"
```

## Verification Criteria
1. **Pass Rate**: 100% of the 80+ automated assertions must pass.
2. **Arithmetic Invariant**: 50/30/20 sum must equal 100% of income; Surplus Sweeper must conserve balance equations.
3. **DOM Safety**: Zero missing IDs among critical render containers.
4. **Security**: Zero unescaped HTML interpolation, zero executable `eval()`.
5. **PWA**: 100% of precache assets physically present on disk.

## Edge Cases & Remediation
- **If an asset is missing**: Add the file or update `sw.js` `PRECACHE_ASSETS`.
- **If floating-point drift occurs**: Apply `Math.round((val + Number.EPSILON) * 100) / 100`.
- **If a DOM ID fails**: Verify the ID in `index.html` matches the query in `app.js`.
