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
