# Pamchenga engineering rules

Use the existing checkout; do not create worktrees unless requested.
Use strict TypeScript. Run npm test and npm run build after functional changes.
The pipeline has three boundaries under src/agents: opening-agent detects ritual timestamps from supplied timestamped transcripts; folklore-agent owns transcription adapters and structured cultural extraction; provenance-agent owns raw audio hashes, JSON-LD manifests and signing/indexing adapters.
Preserve original audio bytes, tone marks, click consonants, laughter, chants and ambient cultural markers. Disable browser capture noise suppression, automatic gain control and echo cancellation. Never claim acoustic detection from text alone.
Persist capture and metadata in IndexedDB before enqueueing any network operation. Only the service worker sends sync requests; use durable exponential retries. Do not send personal recordings without explicit user action.
Never label a hash or a device signature as a verified C2PA credential. C2PA requires a real signer, embedded manifest and verification. Never invent transcription, signatures or IPFS/Arweave identifiers.
Use .agents/skills/pamchenga-orchestrator/SKILL.md for the cultural pipeline. MCP adapters require actual configured services; browser fallback storage must be identified as such.

For feature work use .agents/skills/pamchenga-development/SKILL.md across planning, building, review and documentation. Keep docs/PLAN.md, docs/REVIEW.md and docs/IMPACT.md consistent with actual behavior. The Built with Codex app panel is evidence of the development workflow, not a live AI connection. Education metrics must derive from local lesson records; classroom permission is distinct from recording permission. Preserve unrelated metadata when updating a story.

Hosted Netlify transcription is part of the folklore-agent boundary in netlify/functions and netlify/lib. Provider API keys stay in function runtime secrets, never VITE_ variables or browser fields. Pilot access codes stay in worker memory only; persist jobs without credentials and pause/resume on missing authorization. A provider change requires renewed upload permission. Hosted mode limits original audio to 4 MiB; self-hosted mode retains 100 MiB. Never crop originals to fit a gateway. Run the hosted function tests and tests/netlify-browser.mts (with the hosted build) when changing this boundary. Do not claim mocked Groq responses establish live hosted inference.
