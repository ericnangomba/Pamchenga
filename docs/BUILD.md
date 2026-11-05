# Codex build evidence

The education feature is wired into the existing application, not a separate demonstration screen.

- src/main.ts mounts the education panel, refreshes real local metrics, and attaches the learning editor to each story's detail view.
- src/learning-ui.ts implements the editable lesson form, explicit classroom-permission flow, offline handout export and in-app Codex artifact browser. Public project documentation is bundled for offline access. The engineering handoff exports repository context without reading private story data.
- src/types.ts defines optional LearningCard metadata so existing saved stories remain readable without a database migration.
- src/agents/learning.ts lives in the folklore-agent domain. It validates teacher-authored learning content, calculates real device-local activity counts and exports credited handouts while enforcing separate classroom permission. It never invents a proverb or automated cultural interpretation.
- src/storage.ts merges editable metadata in one IndexedDB transaction. Notes and lesson edits preserve one another and keep original audio bytes and hashes intact.
- tests/learning.test.ts covers meaningful metrics, export permission, native text/attribution and invalid inputs. tests/browser.mjs exercises the product workflow, including concurrent notes/lesson saves, offline persistence, permission and unsaved-edit gates, export and the Codex handoff's privacy boundary.

Codex performed repository planning, implementation, review and documentation. The work uses AGENTS.md, the oral-story pipeline skill and the reusable pamchenga-development lifecycle skill. No special UI plan mode, parallel agents or live in-browser Codex connection is claimed. audio-storage-mcp and c2pa-signer-mcp are unavailable in this session; browser IndexedDB is the storage fallback and C2PA remains unsigned.
