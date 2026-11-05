# Whisper Large V3 / Turbo backend

Runs genuine OpenAI Whisper checkpoints using `faster-whisper`/CTranslate2. This is self-hosted inference, not an OpenAI-hosted API or a live Codex service. Neither model weights nor a backend are contained in the static deployment ZIP.

## Install and prepare a model

Use Python 3.12 (validated here), approximately 6+ GB free RAM for Turbo CPU/int8 and more for Large V3, and several GB of free disk. A GPU is optional. Runtime performance depends on audio length and hardware; do not run both models in parallel on a small machine. The worker processes one job at a time and limits CPU threads to four.

From the repository root:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r server/requirements.txt
export WHISPER_CACHE_DIR="$PWD/.whisper-models"
.venv/bin/python -m server.download_model turbo
# Optional, larger download:
.venv/bin/python -m server.download_model large-v3
npm ci
npm run build
WHISPER_DATA_DIR="$PWD/.whisper-data" .venv/bin/python -m uvicorn server.app:create_app --factory --host 127.0.0.1 --port 8000
```

The explicit preparation command downloads and loads the selected model. Inference defaults to cached/local weights only, CPU and int8; startup does not silently download multi-GB files. Keep `WHISPER_CACHE_DIR` identical during preparation and serving. To use already installed CTranslate2 model directories, set `WHISPER_TURBO_PATH` and/or `WHISPER_LARGE_V3_PATH`. For a suitably configured GPU, set `WHISPER_DEVICE=cuda` and a supported `WHISPER_COMPUTE_TYPE` such as `float16`. Operators can explicitly allow runtime downloads with `WHISPER_ALLOW_DOWNLOAD=1`, but prefetching is recommended.

The service serves the built app on the same origin as `/api/transcriptions`. For development, run this server and `npm run dev` separately: `vite.config.ts` proxies `/api/transcriptions` to loopback port 8000. `vite preview` alone is a static preview and intentionally has no backend proxy. A static Netlify deployment requires an authenticated same-origin reverse proxy for this API to a deployed Python service. Model weights cannot execute inside Netlify Drop's static files.

## Model and language behavior

Both aliases are verified in the installed faster-whisper runtime: `large-v3` maps to `Systran/faster-whisper-large-v3`, and `turbo` to `mobiuslabsgmbh/faster-whisper-large-v3-turbo`. The current tokenizer contains 100 language codes, consistent with the UI's “99+ languages” description. Recognition accuracy varies widely. Chichewa (`ny`) and isiZulu (`zu`) are not supported explicit language hints; automatic detection does not guarantee accurate recognition. Manual native-language review remains essential.

The service uses `task="transcribe"`, `vad_filter=False`, full original audio, and regional ritual spelling cues plus optional facilitator cues. No translation, VAD cropping or noise filter is applied. Standard decoding/resampling is required by Whisper but the stored client original and its SHA-256 remain unchanged. Prompt cues can bias recognition: a matching returned text phrase is not proof that a chant occurred acoustically. The UI tags timestamped text matches only, in the first 30 seconds.

## Durable contract and privacy

- `POST /api/transcriptions`: multipart `audio`, `job_id` (UUID), `audio_sha256`, `model` (`turbo` or `large-v3`), `language` (`auto` or a UI-supported code), `region`, optional `prompt` (maximum 1,000 characters). Maximum original audio size: 100 MiB. No storyteller name, location or lesson content is required.
- Returns JSON with the job ID, hash, model and status. HTTP 202 means queued/running; the client polls `GET /api/transcriptions/{job_id}` through its service worker. Completed results include native text, timestamped segments, detected language and creation time. Failed jobs contain no invented transcript.
- SQLite persists jobs and results. On a single-worker restart, interrupted running jobs return to queued. An ID is bound to its hash, model and hints; changed input returns 409. Do not run multiple Uvicorn workers against the same data directory.
- Uploads are deleted after processing, including failures. Job/result metadata remains in `WHISPER_DATA_DIR` until the operator removes it; establish an appropriate retention policy. Use a private, persistent volume and back it up if server job recovery is needed. The client's IndexedDB original remains the authoritative audio copy.
- The unauthenticated default binds to loopback for one trusted operator. Do not expose it directly to the Internet. Public hosting needs TLS and authentication/authorization at the reverse proxy, a 100 MiB or smaller request limit, resource/queue limits, and access controls for job status/results. Preserve correct forwarded origin/host headers. Random UUIDs and origin checks are not user authentication. No credentials belong in browser code or the ZIP.

The browser asks separate permission to send audio, persists a request before networking, and uses a service-worker queue with exponential retry and timestamped polling. Missing backends leave jobs safely queued. Hard access/input rejection and model failures are shown explicitly. Machine drafts stay separate from handwritten notes until the user confirms a review; reviewed drafts append to existing notes. Unsaved notes must be saved first.

## Verification and limits in this cloud environment

```sh
npm test
.venv/bin/python -m unittest server.test_app -v
npm run build
npm run preview -- --port 4173
# In another terminal:
node tests/browser.mjs
node tests/whisper-browser.mjs
```

Backend tests inject model doubles and browser Whisper tests use a local HTTP fixture. These verify real integration code, storage, permissions, validation and runtime arguments; they do not validate speech-recognition accuracy. The real backend's health endpoint reports only service reachability and model readiness as not checked.

In this cloud task, package installation and backend startup succeeded, but neither requested checkpoint was cached and Hugging Face access returned an explicit network-policy 403. Actual Large V3/Turbo inference therefore remains unverified. Required model-host additions (`huggingface.co`, `cas-bridge.xethub.hf.co`) were saved in the environment configuration draft; review and save those settings, then publish the environment. Saving a draft alone does not apply access or download weights. Follow any observed additional download-host requirement rather than bypassing the policy. After access is available, run the explicit model preparation command, restart the service and transcribe a consented recording to validate actual recognition.

Official references: [OpenAI Whisper](https://github.com/openai/whisper), [Whisper announcement](https://openai.com/index/whisper/), [faster-whisper](https://github.com/SYSTRAN/faster-whisper).
