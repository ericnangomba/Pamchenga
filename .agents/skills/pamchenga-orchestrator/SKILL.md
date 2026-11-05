---
name: pamchenga-orchestrator
description: Complete agentic workflow and skill rules for ingesting, processing, transcribing, and cryptographically signing African oral storytelling sessions within the Pamchenga PWA platform.
version: 2.0.0
---

# Skill: Pamchenga Audio Pipeline Orchestrator

## Purpose
This skill governs how Codex, Cursor, and sub-agents ingest raw audio recorded in the **Pa Mchenga** sand circle, process opening call-and-response rituals across African regions, extract cultural wisdom, and generate verifiable C2PA story manifests.

---

## Processing Execution Workflow

### Step 1: Acoustic Opening Ritual Tagging (`opening-agent`)
Inspect the first 30 seconds of the ingested audio buffer against the multi-regional call-and-response registry:

- **Southern Africa (Chichewa/isiZulu/Shona):**
  - Calls: `"Pamchenga!"`, `"Padangokhala!"`, `"Kwaphela Cosi!"`, `"Pamberi ne ngano!"`
  - Responses: `"Tilitonse!"`, `"Ndaba!"`, `"Dzake!"`
- **East Africa (Kiswahili):**
  - Calls: `"Hadithi Hadithi!"` → Response: `"Hadithi Njoo!"`
- **West Africa (Hausa/Yoruba/Igbo/Wolof):**
  - Calls: `"Tatsuniyarku ta zo!"`, `"Alo o!"`, `"Iro nwanụ!"`, `"Leebon!"`
  - Responses: `"Ta zo mu ji!"`, `"Olo o!"`, `"Iha!"`, `"Leebona!"`

**Action:** Tag matching timestamps as `interactive_ritual_opening`. Do NOT crop, flatten, or noise-filter these chants.

---

### Step 2: Dialect & Cultural Wisdom Extraction (`folklore-agent`)
Route raw audio to localized Whisper models using sidecar prompt cues. Perform a secondary analysis pass with structured LLM outputs to generate JSON containing:

1. **`moral_lesson` (*Phunziro / Ubuntu*):** Core ethical guidance (e.g., community solidarity, honesty, respect for elders).
2. **`proverbs` (*Miyambo / Mithali / Ilu*):** Native proverbs cited, accompanied by literal translations and cultural context.
3. **`embedded_songs` (*Nyimbo za m'nthano*):** Timestamps marking call-and-response musical segments embedded in the narrative.

---

### Step 3: Cryptographic Provenance Manifest Signing (`provenance-agent`)
Invoke `c2pa-signer-mcp` to generate and embed an immutable digital story passport:

```typescript
export interface PamchengaC2PAManifest {
  storyId: string;
  audioSha256: string;
  storyteller: {
    name: string;
    location: string; // e.g., "Kawale, Lilongwe, Malawi"
  };
  language: {
    name: string;
    region: 'Southern Africa' | 'East Africa' | 'West Africa';
  };
  license: 'CC BY-NC-SA 4.0' | 'Community Tribal Copyright';
  c2paTimestamp: string;
  signatureScheme: 'ed25519';
}
```
