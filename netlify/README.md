# Activate hosted Whisper on pamchenga.netlify.app

The selected deployment is Netlify Functions + Groq's hosted OpenAI Whisper models. Netlify serves the PWA and the authenticated gateway; Groq runs the model. No Python host or multi-GB model download is needed on Netlify. Hosted API usage can incur charges; review Groq account pricing/quotas and Netlify function usage before enabling it.

## One-time account setup

1. Sign in to [Groq Console](https://console.groq.com/keys) and create an API key in your own account. Do not post it in chat or commit it to Git.
2. In [Netlify](https://app.netlify.com/), open the project serving `pamchenga.netlify.app`, then its environment-variable settings. Add the following runtime values for **Production**, with **Functions** scope (or a scope that includes Functions):
   - `GROQ_API_KEY`: the actual Groq API key.
   - `PAMCHENGA_TRANSCRIPTION_ACCESS_CODE`: a separate long random pilot access code, 16–128 printable ASCII characters; 32+ random letters/numbers is recommended. This is not the provider key. Share it privately only with the facilitators who may use your transcription quota.
3. Keep both values server-side. Do not prefix either with `VITE_`, include them in source, or place the Groq key in the app's access-code field. Preserve existing correct bindings instead of adding duplicates.
4. Link the Netlify project to `ericnangomba/Pamchenga`, production branch `main`, if it currently uses ZIP uploads. `netlify.toml` already selects `npm ci && npm run build`, `dist`, the `netlify/functions` directory and the public non-secret `VITE_WHISPER_PROVIDER=groq` flag. A static ZIP upload does **not** deploy the function.
5. Deploy/redeploy the Git-connected project after saving runtime variables. Check `https://pamchenga.netlify.app/api/transcriptions/health`: it should return JSON with `provider: "groq"` and `configured: true`. This checks configuration presence, not API-key validity or inference success.
6. In the live app, import a permitted small audio file, save it locally, open its story, enter the pilot access code, select a model and grant the explicit Groq upload permission. Queue transcription, review the generated draft against the audio, then append it to notes. Test both models. Confirm the original audio and existing notes stay intact.

No Netlify/Groq account is connected to the agent in the current task, and neither required runtime secret is available here. A live authenticated Groq request must be validated after secure account configuration. Keys must never be supplied in chat.

## What is implemented

- `netlify/functions/transcribe.ts` exposes `/api/transcriptions` and `/api/transcriptions/health` using the Netlify v2 function API. It declares an IP-based limit of 10 requests/minute; the platform applies that limit on deployment. Unit tests do not simulate Netlify's edge limiter.
- `netlify/lib/hosted-whisper.ts` fails closed until a provider key and valid pilot code are configured. It checks same-origin requests, compares access-code digests in constant time, verifies the original audio hash, validates model/language/prompt/size, and calls only Groq's fixed HTTPS audio-transcription endpoint.
- Model mapping is `turbo` → `whisper-large-v3-turbo` and `large-v3` → `whisper-large-v3`. It requests native-language transcription with verbose JSON and segment timestamps; auto-detect does not force a language. The app sends the complete original bytes. The hosted provider controls its own decoding; no guarantee about its internal preprocessing or retention is invented. Review Groq's data-handling terms and obtain appropriate community permission.
- The provider key never enters browser code. The pilot access code is entered by an authorized facilitator and kept only in service-worker memory. It is not stored in IndexedDB, Cache Storage or a saved job; re-entry may be needed when the worker/browser restarts. A missing/wrong code pauses durable requests instead of losing them.
- A changed backend/provider requires new upload permission. Old self-hosted jobs are never silently sent to Groq. Uploaded audio, storyteller identity, location or lesson metadata are not sent merely because a user visits the site. The function receives only the queued audio and transcription cues; it does not expose server job history.
- The hosted function returns the completed result synchronously; the worker stores it locally. It does not depend on ephemeral function memory for a durable server queue. Missing configuration, throttling and temporary connectivity failures leave requests local for retry. Requests are **at-least-once**, so a lost response or timeout can cause repeat provider charges. Invalid returned transcripts fail without automatic paid retries.
- Drafts remain separate from human notes until reviewed. Appending is atomic and preserves the original audio and prior notes. This is a shared-code pilot access model, not per-user accounts. For a large public service, add individual identity, quota accounting and per-user authorization before scaling usage.

## Upload limit

Netlify documents a 6 MB buffered payload limit, with binary/base64 overhead reducing effective uploads to approximately 4.5 MB. This implementation caps original hosted audio at **4 MiB**, leaving room for multipart metadata. Oversized originals remain intact in IndexedDB and are not cropped or uploaded. Longer sessions can still be recorded, played and annotated locally; the separate Python backend supports the existing 100 MiB transcription limit. Supporting larger files through Netlify would require a separately implemented private/chunked object-storage flow; it is not claimed here.

## Verification

```sh
npm test
npm run build
# With the production preview running on port 4173:
node tests/browser.mjs
node tests/whisper-browser.mjs
# Build the selected hosted profile, then test its full browser flow:
VITE_WHISPER_PROVIDER=groq npm run build
node --import tsx tests/netlify-browser.mts
```

The hosted-function tests use mocked Groq responses; they verify permission, limits, byte/hash integrity, model mapping, errors, credential isolation and reviewed draft use, not live Groq recognition. The existing self-hosted engine has separately passed genuine Turbo and Large V3 inference on OpenAI's public English sample; this does not establish accuracy across African languages or live hosted-service readiness.

Official references: [Groq speech-to-text](https://console.groq.com/docs/speech-to-text), [Netlify function limits and routing](https://docs.netlify.com/build/functions/configuration/), [Netlify function API](https://docs.netlify.com/build/functions/api/).
