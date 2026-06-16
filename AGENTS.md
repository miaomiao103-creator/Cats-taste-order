# Repository Guidelines

## Project Structure & Module Organization

This repository is a static Cat's Taste delivery order app. The main app lives in `index.html`, including HTML, CSS, product data, order logic, scanning, WhatsApp text generation, and Google Sheets sync. `Code.gs` is the Google Apps Script backend used by the configured Web App URL. PWA support is split into `app.webmanifest`, `service-worker.js`, and `icon.png`. User-facing documentation is in `README.md`; the generated PDF manual may be kept for sharing but should not be treated as source.

## Build, Test, and Development Commands

There is no build step. Open `index.html` directly for basic local testing, or serve the folder if testing service worker behavior.

Useful checks:

```powershell
& 'C:\Users\Afr Tse\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check service-worker.js
```

For `index.html`, extract the inline `<script>` block to a temp file and run `node --check` before shipping JavaScript changes. When changing PWA files, bump `CACHE_NAME` in `service-worker.js` so phones receive the latest assets.

## Coding Style & Naming Conventions

Keep the app as a single-file HTML application unless there is a strong reason to split it. Follow the existing compact JavaScript style: short helper names, `const`/`let`, two-space visual alignment where already used, and semicolon-free code. Preserve Traditional Chinese UI copy and existing product naming. Do not add payment status, payment method fields, or unrelated workflow changes.

## Testing Guidelines

There is no automated test framework. Manually verify the core flows after changes: create an order, edit customer info, update product prices, generate WhatsApp text, mark statuses, add tracking numbers, and sync/pull from Google Sheets. For mobile-sensitive changes, test iOS Safari and Android Chrome where possible, especially camera scanning and home-screen/PWA behavior.

## Commit & Pull Request Guidelines

This repository currently has no commit history, so use clear imperative commit messages such as `Fix product price sync` or `Update series filters`. Pull requests should describe the user-facing change, list manual tests performed, include screenshots for UI changes, and mention any Apps Script deployment steps if `Code.gs` changes.

## Security & Configuration Tips

Do not commit private customer data, real order exports, or secret credentials. The Apps Script Web App URL may be public, but changes to `Code.gs` require redeploying a new Apps Script version before phones can use the update.
