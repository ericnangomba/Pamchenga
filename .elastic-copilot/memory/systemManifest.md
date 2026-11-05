# System Manifest

## Project Overview
- Name: Pamchenga
- Description: CRCT-enabled project: Pamchenga
- Created: 2026-11-05T10:31:34.606Z

## Current Status
- Current Phase: Set-up/Maintenance
- Last Updated: 2026-11-05T10:31:34.891Z

## Project Structure

- 7 ts files
- 1 js files


## Dependencies

## Project Directory Structure

- 📂 public/
  - 📄 icon-192.png
  - 📄 icon-512.png
  - 📄 icon.svg
  - 📄 manifest.webmanifest
  - 📄 sw.js
- 📂 src/
  - 📂 agents/
    - 📄 folklore-agent.ts
    - 📄 opening-agent.ts
    - 📄 provenance-agent.ts
  - 📄 main.ts
  - 📄 storage.ts
  - 📄 style.css
  - 📄 types.ts
- 📂 tests/
  - 📄 browser.mjs
  - 📄 pipeline.test.ts
- 📄 index.html
- 📄 pamchenga-preview.zip


## TS Dependencies

### \tests\pipeline.test.ts
Dependencies:
- node:test
- node:assert/strict
- ../src/agents/provenance-agent
- ../src/agents/opening-agent
- ../src/types

### \src\types.ts
No dependencies found

### \src\storage.ts
Dependencies:
- ./types

### \src\main.ts
Dependencies:
- ./style.css
- ./storage
- ./agents/provenance-agent
- ./types
- ,
      );
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        noiseSuppression: false,
        echoCancellation: false,
        autoGainControl: false,
      },
    });
    if (!$<HTMLDialogElement>(

### \src\agents\provenance-agent.ts
Dependencies:
- ../types

## JS Dependencies

### \public\sw.js
No dependencies found



## Key Components
- TBD

## Integration Points
- TBD

## Technical Considerations
- TBD

## Implementation Notes
- TBD
