# Codex implementation plan: education and workflow evidence

## Problem and beneficiaries

Teachers and community facilitators in Chichewa-speaking Malawian communities need reusable mother-tongue listening materials where connectivity is intermittent. Elders carry stories and contextual knowledge that a literal transcript alone cannot preserve. This is the initial intended use case, not a claim of an existing school partnership or measured learning improvement.

## Accepted implementation scope

1. Keep the original offline audio pipeline and regional language support intact.
2. Add teacher-authored lesson cards attached to locally saved stories: audience, learning objective, native proverb, meaning, discussion question, activity, classroom permission and facilitator-reported session count.
3. Store lesson metadata in the existing IndexedDB story record, with backward compatibility for stories without lessons. Never generate cultural interpretations and present them as community-approved wisdom.
4. Export credited lesson handouts only after separate classroom permission is recorded. Do not infer classroom consent from permission to record.
5. Make Codex's planning, building, reviewing and documentation artifacts accessible from the app. Export a reusable engineering brief. No live Codex API or unavailable MCP is implied.
6. Verify the feature offline, including persistence, export permission and metrics derived from actual local records. Re-run existing capture/sync tests.

## Agent boundaries

- opening-agent: preserve ritual boundaries and native text; no claim of acoustic inference without model output.
- folklore-agent: own the teacher-authored learning-card schema and export; preserve native orthography and attribute interpretation to the facilitator.
- provenance-agent: preserve original bytes and hash; unsigned passports remain unsigned.

## Verification and completion

Run npm test, npm run build and node tests/browser.mjs against the production preview. Review storage writes for lost updates and consent checks, and inspect mobile layout. Write actual results in docs/REVIEW.md, update docs/IMPACT.md and README.md, regenerate the deployment ZIP, commit and push to the authorized repository.

This file records repository-based planning. It does not claim that a special Codex UI plan mode or parallel agents were used.

## Netlify static deployment

- **Beneficiaries and journey:** Teachers, community facilitators and storytellers can open the installed PWA from a secure public HTTPS host, then continue using browser-local stories and lessons offline.
- **Scope:** Configure Netlify to install the locked dependencies, run the existing production build and publish `dist`. Keep service-worker updates reliable by preventing stale HTML and service-worker responses, and precache fingerprinted production JavaScript and CSS during service-worker installation so the first controlled visit can reload offline. Do not invent a sync API, move private recordings to a remote service, or imply that a Netlify deployment supplies signing or transcription integrations.
- **Acceptance:** The production build and existing unit/browser checks pass; deployment settings target the root of the production output, and a production preview serves the app and service worker. Document that linking/publishing a live Netlify site requires an authorized Netlify account and site.
- **Data and integration limits:** No application data/schema changes. Stories and lesson cards remain in IndexedDB on each user's browser. Static hosting does not implement `/api/stories`; sync remains unavailable until a separately configured backend exists.

## Whisper Large V3 / Turbo integration plan

Add an explicit, consent-based Whisper action to saved story details, with Turbo and Large V3 model selection and optional supported language hints. Keep handwritten notes separate from machine drafts and require human review before appending a draft. Queue work in IndexedDB before sending the original audio through the service worker; persist retries and timestamps, and never apply VAD, cropping or translation. Tag first-30-second ritual cues using returned timestamped text.

Implement a same-origin Python backend using faster-whisper, durable SQLite jobs, input/hash validation, local CPU/int8 defaults and configurable model directories. Serve the production PWA or proxy the backend from Vite. No API credentials in the browser. The default loopback service is for a single trusted operator; public deployment requires authentication and TLS at the reverse proxy.

Verify browser queue/consent/offline/result review and backend contracts with deterministic model doubles, preserving a clear distinction from genuine model inference. Install dependencies and attempt genuine inference only if model-host access permits it. Hugging Face returned an explicit network-policy denial in this environment; do not bypass it or claim inference passed without model weights. Update network requirements through the supported configuration draft.

## Public backend deployment preparation

Prepare a Docker image for the existing Python backend and persist the verified PyAV 16.1.0 compatibility constraint. Keep model weights and job data on a private persistent volume, and keep the current static Netlify configuration working until a real authenticated backend origin is available. Validate the container on loopback before any public exposure. Hosting provider/account access, RAM/storage budget approval, the actual Netlify URL and authentication/gateway configuration are required before a public deployment. Do not provision paid resources or publish configuration under the earlier pause instruction without new deployment authorization.

## Selected deployment: Netlify + hosted Whisper

The user selected Netlify + a hosted Whisper API for https://pamchenga.netlify.app/. Implement a strictly typed Netlify Function calling Groq's documented Whisper Large V3/Turbo endpoint. Keep the API key only in function-scoped Netlify secrets and protect the paid endpoint with an operator-managed pilot access code. The shared code is pilot access control, not individual user identity; no server job history is exposed. Send audio only after explicit Groq upload consent. Keep access codes in worker memory only, pause durable jobs when authorization is missing, and allow resumption after re-entry. Netlify's documented 6 MB buffered/approximately 4.5 MB binary limit requires a conservative 4 MiB original-audio cap in hosted mode; never truncate an original recording to fit it. Self-hosted mode retains its 100 MiB limit. The synchronous hosted result is committed locally; network retries are at-least-once and can incur repeat provider charges. Verify function routes/auth/configuration, body/hash/model validation, provider mapping/failures, offline queue/resume and human-reviewed draft use with fixtures before any public deployment. Actual hosted inference and live-site checks require securely configured provider credentials and authorized Netlify deployment access.

## Storyteller protections — 10 November 2026

Beneficiaries are storytellers and their claimed representatives returning a recording, and facilitators recording conditions before reuse. This work adds no account, authority verification, remote storage, or automatic upload.

- Add a single downloadable ZIP containing the unchanged original and unsigned passport for return to the storyteller, with an explicit return-only confirmation and a local download-request note. Keep third-party audio exports gated by share.
- Introduce consent v2 with optional attribution, benefit conditions and a specific commercial agreement (parties, date, terms). Read v1 safely without inventing permissions; preserve checked commercial requests but deny effective commercial use until a complete agreement is recorded and flag them for review.
- Show public-license conflicts and require a fresh rights-holder authorization attestation before saving CC BY-NC-SA consent. Describe the community label honestly. Warn before and after withdrawing prior permission that exported copies cannot be recalled and history is editable device data.
- Preserve the existing theme, audio bytes, provenance claims, independent teaching gates, Whisper upload consent and browser cache/offline assertions. Use atomic metadata writes for consent history and own-copy notes so overlapping notes/lesson changes are retained.
- Extend unit and production-browser tests for denial gates, migration, terms/storage round-trip, own-copy ZIP bytes/passport, license acknowledgments, withdrawal, and offline persistence. Run npm ci, npm test, npm run build, browser checks and branch CI. Do not merge or deploy; report results for review.
