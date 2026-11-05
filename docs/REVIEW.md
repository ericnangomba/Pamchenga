# Codex review record

Reviewed 5 November 2026 for the education and workflow-evidence feature. This is a saved development record, not a live test runner or in-browser Codex connection.

## Completed checks

- npm test: 6 tests passed, 0 failed, 0 skipped. Includes SHA-256 against a known vector, ritual timestamp boundaries/native text, unsigned provenance status, real lesson metrics, classroom permission and native text/credit in handouts, and invalid learning content/session counts.
- npm run build: strict TypeScript check and Vite production build passed.
- node tests/browser.mjs against the production preview with Chromium and a fake microphone: passed recording, save/reload persistence, original-audio fingerprint display, native-text notes, passport export, durable failed-sync retries, offline reload, mobile overflow, audio import, regional filters and search.
- Education browser checks: passed offline lesson preparation, separate classroom permission, unsaved-change export protection, credited handout download, lesson persistence, accurate local lesson/session counts and native text preservation.
- Storage regression: overlapping notes and lesson saves preserved both after reload. Editable metadata now merges in a single IndexedDB transaction rather than replacing a stale story object.
- Codex workflow browser checks: all five artifact tabs opened offline and the engineering handoff downloaded. The test verified repository instructions are included and fixture private story text/storyteller identity are absent.

## Review findings and decisions

Recording consent is not reused as classroom permission. Draft lesson cards can be saved without that permission, but handout export is blocked until permission is recorded and saved. Permission is a facilitator attestation, not independently verified legal clearance. Exports credit the storyteller and retain the selected license.

Existing story records without learning metadata stay valid; no IndexedDB schema migration or audio rewrite is required. All lesson edits are local. The Codex handoff contains bundled project documentation only; it neither reads recordings nor sends anything to an AI service. Runtime edits are escaped in HTML; documentation is rendered as text.

The education panel reports only device-local lesson cards, lesson languages and facilitator-entered sessions. It does not count unique learners or imply demonstrated education outcomes. The intended Malawi/Chichewa use case is specific, but no school pilot, partnership or measured learning improvement is claimed.

## Integration limits and remaining evaluation

No localized transcription model, live Codex agent, audio-storage-mcp, c2pa-signer-mcp, C2PA/device signer, sync backend or IPFS/Arweave service is configured. Original hashes and unsigned JSON-LD passports must not be presented as certified C2PA provenance. Classroom handouts are teacher-authored, not AI-generated cultural judgments.

Browser automation used Chromium and synthetic microphone audio. Field testing with actual teachers, storytellers and languages; real-device microphone quality; browser-specific installation/background scheduling; and measured learner comprehension remain unverified. Storage eviction is possible; exports are needed for backup.

## Netlify deployment preparation

- `npm test`: passed, 6 tests.
- `npm run build`: passed; TypeScript check and Vite production build completed.
- Production preview on port 4173: `/` and `/sw.js` both returned HTTP 200. The integrated browser opened the production app and confirmed its main screen and local education metrics rendered.
- `node tests/browser.mjs`: passed with the installed Windows Chromium selected using `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; recording, hash, IndexedDB persistence, notes, exports, retry queue, offline reload, mobile layout, import, lessons, consent, metrics and Codex handoff checks all passed. The test verifies offline reload and persisted data rather than asserting the browser-managed `navigator.onLine` label after navigation.
- `pamchenga-preview.zip` was regenerated from `dist` and checked to contain `index.html` at its root.
- Netlify configuration targets `npm ci && npm run build` and `dist`; `public/_headers` supplies revalidation and security headers in both repository-connected and ZIP deployments. Netlify CLI and authentication were not available, so no live site was linked or published. Static hosting does not configure `/api/stories` or change the device-local storage model.
