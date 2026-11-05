---
name: pamchenga-development
description: Plan, build, review, and document Pamchenga changes with concrete education outcomes, offline tests, and honest integration evidence.
---

# Pamchenga development lifecycle

Use this skill for application features and reviews. Read AGENTS.md and the pamchenga-orchestrator skill. Use the existing checkout; do not create worktrees unless requested.

1. Plan: record beneficiaries, the concrete user journey, acceptance checks, data changes, and integration limits in docs/PLAN.md before implementation. Do not claim Codex UI plan mode or parallel agents were used without evidence.
2. Build: honor the opening-agent, folklore-agent, and provenance-agent module boundaries. Persist locally before any network attempt. Preserve native text and original audio. Teacher-authored interpretation must remain distinct from model output. Recording permission does not imply classroom or publication permission.
3. Review: examine data-loss paths, stale-record updates, consent gates, offline reload, accessibility, and unsupported integrations. Run npm test and npm run build; run node tests/browser.mjs with the production preview on port 4173. Record actual outcomes and limits in docs/REVIEW.md.
4. Document: update README.md and docs/IMPACT.md. Show only counts grounded in local records; do not invent users, school partnerships or learning improvements. The app's Built with Codex panel must match the committed evidence.
5. Package: rebuild and regenerate pamchenga-preview.zip from dist with index.html at its root. Follow the user's existing publication authorization. Never invent live Codex, MCP, C2PA, transcription, or remote storage capabilities.

MCPs: discover tools before use. audio-storage-mcp and c2pa-signer-mcp require actual available services. If absent, state that browser IndexedDB is the fallback and C2PA remains pending. Never send a private recording to Codex or any other service through the engineering handoff export.
