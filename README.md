# Pamchenga · The Digital Sand Circle

An offline-first TypeScript PWA for preserving African oral stories. Record or import audio, retain its original bytes, store metadata in IndexedDB, listen locally, add native-language notes, and export audio and unsigned JSON-LD passports.

## Deploy to Netlify

Connect this repository to a Netlify site and use the settings in `netlify.toml`: Netlify installs dependencies with `npm ci`, runs `npm run build`, and publishes `dist`. The `public/_headers` file sets security and service-worker revalidation headers and is included in the production output for both Git-connected and manual deployments. The site is a static PWA; its service worker and microphone capture require HTTPS, which Netlify provides. Netlify does not provide the app's optional `/api/stories` sync backend, transcription, C2PA signing or remote storage. Story audio and lesson records remain in each browser's IndexedDB.

The repository also includes `pamchenga-preview.zip` for manual deployment: extract it and drag the extracted contents (with `index.html` at the root) to https://app.netlify.com/drop. Regenerate the ZIP from `dist` after application changes.

GitHub **Code → Download ZIP** downloads the source repository, including this deployment ZIP. To develop the source, follow the steps below.

## Develop

Use Node.js 22.12+ (validated with Node 24), then:

```sh
npm ci
npm run dev
```

Microphone, Web Crypto and service workers require HTTPS or localhost. Allow microphone access when recording. The browser captures with noise suppression, echo cancellation and automatic gain disabled. Device hardware may still apply processing. Obtain storyteller permission and choose appropriate community licensing. Audio is kept locally until the user explicitly queues it for sync. Browser storage can be evicted: export important originals and passports for backup.

## Validate

```sh
npm test
npm run build
npm run preview
node tests/browser.mjs
```

The browser integration check uses Playwright Chromium and fake microphone input, exercising capture, hashing, reload persistence, notes, export, retry scheduling, offline shell loading and mobile overflow. The preview server must be running. If Chromium is installed at a non-default path, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable before running the test. Service workers cache the application shell and production assets at installation so the first controlled page can reload offline; use the production build when verifying offline behavior. Development HMR is not an offline production workflow.

## Pipeline boundaries

See `AGENTS.md` and `.agents/skills/pamchenga-orchestrator/SKILL.md`.

- `opening-agent`: timestamped transcript ritual tagging in the first 30 seconds. It does not perform acoustic recognition.
- `folklore-agent`: typed contracts for localized transcription and structured wisdom extraction. No automatic transcription model is bundled.
- `provenance-agent`: real browser SHA-256 over original bytes and unsigned JSON-LD origin metadata; typed interfaces for real signing and content-addressable storage.

`audio-storage-mcp` and `c2pa-signer-mcp` were unavailable during implementation. Browser IndexedDB is the storage fallback. C2PA embedding, certificate validation, device signing, Whisper transcription, and IPFS/Arweave publication require configured integrations and are not represented as completed. A SHA-256 fingerprint alone is not a C2PA credential; JSON-LD passports explicitly state unsigned status.

## Optional sync service contract

Only the service worker sends network sync requests. The UI first commits recordings and metadata to IndexedDB, then queues selected stories in a separate durable transaction. Failed requests retain the job with exponential backoff capped at one hour. Background Sync retries where supported; online events and a periodic foreground tick also ask the worker to drain due jobs. Jobs survive reloads. A closed app in a browser without Background Sync retries on the next visit.

Provide a same-origin `POST /api/stories` endpoint accepting multipart `audio` and JSON `metadata`. Honor `Idempotency-Key` to avoid duplicate stories. Return JSON `{ "id": "<story id>", "audioSha256": "<verified audio hash>" }` only after durable storage and verification. Static hosting alone has no sync endpoint: stories stay queued, never falsely marked synced. Add authentication, access controls, consent-aware sharing and server-side validation before exposing this service. C2PA signing must be performed by a real configured signer and verified before showing a signed state.

The install action appears when the browser offers installation; supported browsers also offer installation through their own menu. No remote fonts or assets are required.

Deployment exposes a static build only. It does not configure a custom domain, connect a Netlify account, or provision a sync API.

## Education workflow and Codex evidence

The intended initial use case is teachers and community facilitators working with Chichewa-speaking learners in Malawi where connectivity is intermittent. See [the impact model](docs/IMPACT.md) for beneficiaries, the concrete classroom journey, meaningful activity indicators and limitations. No school partnership or measured learning gain is claimed.

Open a saved story and use **Prepare a learning card** to write an audience, objective, native proverb and meaning, discussion question and activity. Cards remain editable offline and persist in IndexedDB with their source story. Separate classroom permission is required before exporting a credited Markdown handout. Unsaved changes must be saved before export. Recording permission alone does not grant classroom use. The learning panel counts device-local lesson cards, languages with lessons and facilitator-reported sessions; it does not invent learner reach or outcomes.

The app’s **Built with Codex** panel exposes the actual [plan](docs/PLAN.md), [architecture rules](AGENTS.md), [review evidence](docs/REVIEW.md), [impact documentation](docs/IMPACT.md) and reusable development skill. Export its engineering handoff to continue work with Codex. The handoff contains public repository context only, no private story or lesson data. This is evidence of Codex’s development workflow; no live Codex agent is embedded in the browser. Repository planning was used; special UI plan mode and parallel agents are not claimed.
