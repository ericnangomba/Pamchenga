# Codex review record

Reviewed 5 November 2026 for the education, Codex evidence and Whisper integration features. This is a saved development record, not a live test runner or in-browser Codex connection.

## Completed checks

- npm test: 15 tests passed, 0 failed, 0 skipped. Includes SHA-256 against a known vector, ritual timestamp boundaries/native text, unsigned provenance status, real lesson metrics, classroom permission and native text/credit in handouts, and invalid learning content/session counts.
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

A self-hosted Whisper Large V3/Turbo backend is implemented, but no checkpoint weights are installed in this cloud instance and actual speech recognition remains unverified. No live Codex agent, audio-storage-mcp, c2pa-signer-mcp, C2PA/device signer, remote story-sync backend or IPFS/Arweave service is configured. Original hashes and unsigned JSON-LD passports must not be presented as certified C2PA provenance. Classroom handouts are teacher-authored, not AI-generated cultural judgments.

Browser automation used Chromium and synthetic microphone audio. Field testing with actual teachers, storytellers and languages; real-device microphone quality; browser-specific installation/background scheduling; and measured learner comprehension remain unverified. Storage eviction is possible; exports are needed for backup.

## Netlify deployment preparation

- `npm test`: passed, 6 tests.
- `npm run build`: passed; TypeScript check and Vite production build completed.
- Production preview on port 4173: `/` and `/sw.js` both returned HTTP 200. The integrated browser opened the production app and confirmed its main screen and local education metrics rendered.
- `node tests/browser.mjs`: passed with the installed Windows Chromium selected using `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; recording, hash, IndexedDB persistence, notes, exports, retry queue, offline reload, mobile layout, import, lessons, consent, metrics and Codex handoff checks all passed. The test verifies offline reload and persisted data rather than asserting the browser-managed `navigator.onLine` label after navigation.
- `pamchenga-preview.zip` was regenerated from `dist` and checked to contain `index.html` at its root.
- Netlify configuration targets `npm ci && npm run build` and `dist`; `public/_headers` supplies revalidation and security headers in both repository-connected and ZIP deployments. Netlify CLI and authentication were not available, so no live site was linked or published. Static hosting does not configure `/api/stories` or change the device-local storage model.

## Whisper verification

- Python dependencies installed successfully; pip check reported no broken requirements. The installed faster-whisper runtime recognizes both requested aliases and contains 100 language codes. Chichewa (`ny`) and isiZulu (`zu`) are not explicit hints; the UI warns about variable low-resource-language accuracy.
- `.venv/bin/python -m unittest server.test_app -v`: 5 backend tests passed. They cover durable/idempotent jobs, hash/model/language/origin rejection, upload limits, restart recovery, explicit inference failures, temporary upload deletion and runtime adapter arguments. The adapter test uses a model double and confirms transcription-only behavior, no VAD and local-cache defaults; it is not a recognition-quality test.
- Two additional TypeScript tests validate that Whisper job/model/hash bindings, native text and timestamp structure are checked before a result can be stored. They are included in the 15-test total above.
- `node tests/whisper-browser.mjs`: passed v1→v2 IndexedDB migration without losing existing stories, separate upload permission, first-visit offline reload, durable offline requests, service-worker upload/poll, both model choices, first-30-second ritual text cues, human-review and unsaved-note gates, append/persistence, mismatched-result rejection and preservation of original audio bytes/hash. The backend responses in this suite are deterministic HTTP fixtures, not genuine inference.
- The real Python Uvicorn service started successfully on loopback, returned its health metadata and served the production app. Health deliberately does not assert model readiness. Neither Turbo nor Large V3 loaded in local-only mode: both raised LocalEntryNotFoundError because no weights were cached.
- A read-only request to Hugging Face returned an explicit network-policy 403. Required model-host additions were saved in the environment draft, not applied. No model download or actual Large V3/Turbo transcription is claimed as completed.

## Additional review findings

The service worker caches production JS/CSS on installation, with Vary handling limited to immutable same-origin assets, fixing a first-visit offline miss. IndexedDB v2 adds a transcription-job store without rewriting existing audio or learning records. Jobs are saved before any upload, post/poll retries survive reload, and accepted jobs are bound to their audio hash/model. Invalid results cannot replace a prior draft. Appending a reviewed draft checks the current notes and draft ID in one transaction, preventing lost concurrent edits or duplicate application. No machine draft silently replaces human notes.

The backend uses a single trusted-operator loopback deployment by default; it is not ready for unauthenticated public exposure. Same-origin authenticated TLS ingress, access/resource controls and a retention policy are required for a public deployment. A static Netlify ZIP does not host Python or model weights. Model-host network access and explicit model preparation are prerequisites for live transcription. See server/README.md for exact steps and official references.

## Synchronization with GitHub main

The initial push correctly rejected a non-fast-forward update. The Whisper change was rebased onto the newer Netlify deployment, manual ritual tagging, microphone-error, import-duration and browser-portability commits. Their files and tests were retained. The merged app persists manual ritual tags and updates them when a reviewed Whisper draft is appended; separate timestamped machine-draft ritual cues remain text-only. The refreshed deployment ZIP is regenerated from the combined source, including Netlify headers. Cache version 3 keeps the immutable asset strategy and adds first-offline Vary handling.

## Live runtime follow-up and selected Netlify mode

The newly published environment restored model-host access. Both checkpoints downloaded and loaded. Genuine API inference on OpenAI's public English `tests/jfk.flac` sample passed: Turbo in 8.1 seconds and Large V3 in 12.1 seconds, with segment timestamps, expected speech and unchanged audio hashes. Turbo also passed the real PWA → IndexedDB → explicit permission → service-worker upload/poll → live model → reviewed notes flow. These are actual local-model checks, separate from the earlier doubles; they do not establish performance across African languages. Real decoding exposed PyAV 19 removing the `metadata_errors` argument, so the compatible PyAV 16.1.0 version is now pinned for reproducible installs. The cloud environment was not republished.

The user selected Netlify + a hosted API for https://pamchenga.netlify.app/. Current additional checks:

- Six hosted-function tests passed, bringing the TypeScript total to 15. They cover closed configuration, missing/wrong access and origin, both model mappings, exact original bytes/hash, supported inputs, conservative body limits, auto language handling, sanitized provider failures and invalid returned timestamps. The Groq transport is mocked.
- Both prior browser suites passed in self-hosted mode after the worker changes, including the remote microphone-error, import-duration and ritual-tag additions.
- The Netlify-mode browser suite passed against the real function handler with mocked Groq responses: renewed provider permission for old jobs, offline queuing, missing/wrong/correct pilot access, both model mappings, no persisted credentials, reviewed notes, invalid-provider failure without automatic paid retries and oversized originals preserved without upload.
- Strict application/function TypeScript checks and the hosted production build passed. The function bundled successfully for Node 22, and its bundled entry returned configured=false with missing runtime secrets. Health checks do not establish key validity or recognition readiness.
- The optional Python Docker image built successfully with verified TLS trust, excluded private caches and a non-root runtime. Decoder/faster-whisper imports and backend factory initialization passed. No public container was provisioned or published.

The public Netlify site returned HTTPS 200 before deployment work. Netlify/Groq account access and runtime secrets are not available in this task. Real hosted inference and final public-site deployment remain unverified until the secure account setup is completed. A static ZIP is insufficient for the function; use Git-connected Netlify builds. This is a shared-code community pilot, not a per-user identity system. Provider requests are at-least-once; retries/timeouts can incur repeat charges, so the operator must manage provider quota and access. The 4 MiB hosted cap and provider data-handling boundary are disclosed; originals are never cropped.

## Storyteller benefits review — 10 November 2026

This entry covers the work branch `work/storyteller-benefits-20261110`, starting from `main` at `28b91f1`. It adds storyteller copies and conditions; it does not deploy them or claim field/legal validation.

Local checks completed:

- `npm ci` succeeded with a writable workspace npm cache. `npm test`: 31 passed, 0 failed or skipped. New tests cover no-share own-copy ZIP original-byte/hash integrity and unsigned passport, third-party denial, v1 consent migration without fabricated permissions, commercial agreement validation, CC authorization/conflicts, escaped terms, license/benefit storage round-trips, and concurrent note/history/own-copy writes. Withdrawal removes pending backups atomically. The actual worker flush implementation is exercised with fake IndexedDB and a counted transport: legacy, denied and invalid consent do not upload; permitted v1/v2 records do.
- `npm run build` passed strict application/function TypeScript checks and the production build. The existing storage dynamic/static import warning remains nonfatal.
- `node tests/browser.mjs` passed against the production preview on port 4173. The existing controlling-worker-source cache assertion, built JS/CSS proof, capture, saved-story content, offline reload, teaching/facilitator gates, durable retry queue, mobile layout, import, search, metrics and engineering handoff checks are retained. Added paths run in the existing offline context: exact WAV bytes and passport in the own-copy ZIP while sharing is denied, attribution in lesson credit, benefit/license persistence, unconfirmed CC save denial, commercial checkbox review/partial-agreement denial/completed agreement, withdrawal warnings and old checked-commercial review after reload.
- `node tests/whisper-browser.mjs` passed the existing deterministic self-hosted fixture suite: separate upload permission, offline durable requests, original bytes, both models and reviewed notes.
- `VITE_WHISPER_PROVIDER=groq npm run build` and `node --import tsx tests/netlify-browser.mts` passed the hosted fixture suite: provider consent, pilot access, offline queue, both models, credential isolation, malformed-result rejection and intact oversized originals. Responses are mocked; no paid inference or real recording was uploaded.

Review decisions and limitations:

The own-copy confirmation is an operator claim, not recipient verification. The local note records a request before ZIP preparation, not download completion or handover. Commercial choices without agreements remain checked and explicitly marked for review; effective commercial permission is denied. Terms are attested conditions, not verified legal clearance, payment processing or proof of benefit delivery. Public CC grants on distributed copies cannot be recalled; in-flight uploads also cannot be recalled. Consent/history and request notes are editable device data.

Migration preserves original bytes, license, timestamps, permission choices and older history snapshots. Metadata mutations append from current stored records, avoiding stale-snapshot history loss. Reuse exports re-read current stored consent. New capture still requires record/store; edits can record withdrawal without silently deleting the original. Existing independent classroom gates and per-action Whisper consent stay intact. CSS, fonts, colors and theme assets are unchanged; new controls reuse existing classes. No backend, accounts, live deployment or authority verification is added.

The static preview ZIP is regenerated from the tested default production build, with `index.html` at its root. Static ZIP hosting alone does not deploy Netlify Functions. Branch Actions results are reported separately with the exact pushed commit; review before merging. Real-device/browser diversity, community evaluation, delivery, benefit fulfillment, legal validity and live hosted inference remain unverified.
