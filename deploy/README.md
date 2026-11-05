> The user selected **Netlify + hosted Whisper API** for pamchenga.netlify.app. Follow [netlify/README.md](../netlify/README.md) for that route. The Docker package below is a validated optional self-hosted alternative and is not required by Netlify's hosted mode.

# Connect Netlify to a hosted Whisper backend

The frontend already uses relative `/api/transcriptions` URLs through its service worker. The remaining work is a persistent Python service plus an authenticated same-origin gateway from the actual Netlify site. A running server inside a Codex task is not a permanent public deployment.

## Prepared infrastructure

`Dockerfile.whisper` packages the backend with the PyAV 16.1.0 version verified by real Turbo/Large V3 inference. It runs as a non-root user and honors the host's `PORT`. Model weights and SQLite job data live under `/data`; provision a writable persistent volume there, with access for UID/GID 10001. Nothing in `.env`, the development model cache or private job directory is copied into the image. This container exposes only the API; Netlify continues serving the PWA.

Use a Docker-capable host such as Render, Railway, or an existing Linux server. Start with at least 8 GB RAM, 10 GB persistent storage and one worker; benchmark throughput before increasing concurrency. These are provisioning recommendations, not verified cloud plan specifications or a price quote. Model loading, stored jobs and downloads require disk/memory headroom. Paid hosting may be required and must be approved before provisioning.

## Build and validate privately

From the repository root on a normal Docker host:

```sh
docker build -f deploy/Dockerfile.whisper -t pamchenga-whisper .
docker volume create pamchenga-whisper-data
# Explicitly prepare the default model once on the same persistent volume.
docker run --rm --mount source=pamchenga-whisper-data,target=/data pamchenga-whisper python -m server.download_model turbo
# Optional second model:
docker run --rm --mount source=pamchenga-whisper-data,target=/data pamchenga-whisper python -m server.download_model large-v3
# Keep host access on loopback until an authenticated ingress is configured.
docker run --name pamchenga-whisper --mount source=pamchenga-whisper-data,target=/data -p 127.0.0.1:8001:8000 pamchenga-whisper
```

In a managed Codex environment, networked builds require the session proxy and CA trust. Pass a combined CA bundle using `--secret id=proxy_ca,src=/etc/ssl/certs/ca-certificates.crt` when building. Containers that download models also need a read-only combined CA mount and the appropriate `SSL_CERT_FILE`/client trust configuration. Never disable verification or bake session credentials/trust files into an image.

A successful health request proves service reachability only. Check a real transcription job and model cache before calling inference ready. The public OpenAI Whisper `tests/jfk.flac` sample has passed genuine inference in the current cloud runtime: Turbo in 8.1 seconds and Large V3 in 12.1 seconds, and the full browser PWA workflow passed with Turbo. This is an English test, not evidence of accuracy across African languages. Container validation and public-site validation are separate checks.

## Account-specific work still required

1. Select a host and approve its paid resources, if any. Connect the GitHub repository or authorize a deployment through that provider; never send passwords or API tokens in chat.
2. Deploy one backend worker with a persistent volume, prepare the chosen weights, and configure HTTPS and authentication/authorization. The current backend is designed for a single trusted operator. Do not publish it as an anonymous multi-user API: a public service must protect uploads, job/status access, resource usage and data retention. UUID job IDs alone are not user authentication. Choose a pilot/private-site access model or implement user identity and job ownership before a multi-user launch.
3. Configure the actual Netlify site to forward both `/api/transcriptions` and `/api/transcriptions/*` to the protected backend, preserving the intended user identity. Match/allow the real frontend origin explicitly at the backend; its current loopback origin check will reject a foreign-origin POST. Do not simply disable the origin check or embed a service credential in frontend code. The gateway, upload size limits and authentication scheme depend on the selected hosting/account setup, so no placeholder route is activated in `netlify.toml`.
4. Verify the provider's request-body limits against the app's 100 MiB audio cap. If the chosen gateway cannot stream that size, implement authenticated direct/chunked uploads or lower the declared limit consistently before launch. Inference is asynchronous: upload first, then poll the durable job.
5. Run an end-to-end test from the real Netlify HTTPS origin: permission, upload, live transcription, polling, native text/ritual review, notes append, offline retry and access isolation. Check persistent-volume survival after a service restart. Publish only after these checks and the required authorization.

The live Netlify URL and hosting-provider access are not present in this cloud session. No paid resources or public backend were provisioned during preparation.
