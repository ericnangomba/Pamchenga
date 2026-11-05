"""Single-operator Whisper service. Put authenticated TLS ingress in front of public deployments."""
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import threading
from typing import Annotated
from uuid import UUID

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

MODELS = {"large-v3", "turbo"}
MAX_AUDIO_BYTES = 100 * 1024 * 1024
# Known Whisper language codes used by the UI; unsupported languages must not be mislabeled.
LANGUAGES = {"auto", "sw", "ha", "yo", "sn", "en", "af", "am", "so"}
PROMPTS = {
    "Southern Africa": "Pamchenga! Padangokhala! Kwaphela Cosi! Pamberi ne ngano! Tilitonse! Ndaba! Dzake!",
    "East Africa": "Hadithi Hadithi! Hadithi Njoo!",
    "West Africa": "Tatsuniyarku ta zo! Alo o! Iro nwanụ! Leebon! Ta zo mu ji! Olo o! Iha! Leebona!",
}

def transcribe_audio(path: Path, model_name: str, language: str, prompt: str) -> dict:
    """Use genuine OpenAI Whisper weights via CTranslate2; do not trim chants or translate."""
    from faster_whisper import WhisperModel
    local_path = os.environ.get("WHISPER_TURBO_PATH" if model_name == "turbo" else "WHISPER_LARGE_V3_PATH")
    model = WhisperModel(
        local_path or model_name,
        device=os.environ.get("WHISPER_DEVICE", "cpu"),
        compute_type=os.environ.get("WHISPER_COMPUTE_TYPE", "int8"),
        cpu_threads=min(4, os.cpu_count() or 1),
        download_root=os.environ.get("WHISPER_CACHE_DIR"),
        local_files_only=os.environ.get("WHISPER_ALLOW_DOWNLOAD", "0") != "1",
    )
    segments, info = model.transcribe(
        str(path), task="transcribe", language=None if language == "auto" else language,
        vad_filter=False, initial_prompt=prompt or None, beam_size=5,
        condition_on_previous_text=True,
    )
    output = [{"start": s.start, "end": s.end, "text": s.text} for s in segments]
    return {"text": "".join(s["text"] for s in output).strip(), "segments": output, "language": info.language}

class JobStore:
    def __init__(self, root: Path):
        self.root = root
        root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.database = root / "jobs.sqlite3"
        with self.connect() as db:
            db.execute("CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, digest TEXT, model TEXT, language TEXT, prompt TEXT, status TEXT, result TEXT, error TEXT)")
            db.execute("UPDATE jobs SET status='queued' WHERE status='running'")

    def connect(self):
        db = sqlite3.connect(self.database, timeout=30)
        db.row_factory = sqlite3.Row
        return db

    def get(self, job_id: str):
        with self.connect() as db:
            row = db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
            return dict(row) if row else None

    def run_one(self, inference=transcribe_audio):
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT * FROM jobs WHERE status='queued' ORDER BY rowid LIMIT 1").fetchone()
            if not row:
                return False
            job = dict(row)
            db.execute("UPDATE jobs SET status='running' WHERE id=?", (job["id"],))
        path = self.root / f'{job["id"]}.audio'
        try:
            if hashlib.sha256(path.read_bytes()).hexdigest() != job["digest"]:
                raise ValueError("Stored audio integrity mismatch")
            result = inference(path, job["model"], job["language"], job["prompt"])
            result.update({"id": job["id"], "model": job["model"], "audioSha256": job["digest"], "createdAt": datetime.now(timezone.utc).isoformat()})
            with self.connect() as db:
                db.execute("UPDATE jobs SET status='completed', result=? WHERE id=?", (json.dumps(result, ensure_ascii=False), job["id"]))
        except Exception:
            # Never expose model download URLs, credentials, raw audio, or internal tracebacks.
            with self.connect() as db:
                db.execute("UPDATE jobs SET status='failed', error=? WHERE id=?", ("Transcription failed. Check audio format, installed model weights and server logs/configuration; no transcript was produced.", job["id"]))
        finally:
            # Uploads are temporary; the original stays in the client's IndexedDB.
            path.unlink(missing_ok=True)
        return True


def create_app(data_dir: Path | None = None, start_worker: bool = True, serve_frontend: bool = True):
    root = data_dir or Path(os.environ.get("WHISPER_DATA_DIR", "/tmp/pamchenga-whisper"))
    store = JobStore(root)
    stop = threading.Event()

    def work():
        while not stop.is_set():
            if not store.run_one():
                stop.wait(1)

    @asynccontextmanager
    async def lifespan(_app):
        worker = threading.Thread(target=work, daemon=True) if start_worker else None
        if worker:
            worker.start()
        yield
        stop.set()

    app = FastAPI(title="Pamchenga Whisper", lifespan=lifespan)
    app.state.jobs = store

    def check_origin(request: Request):
        # Browser CSRF protection for the unauthenticated loopback deployment.
        origin = request.headers.get("origin")
        if origin and origin != str(request.base_url).rstrip("/"):
            raise HTTPException(403, "Use a same-origin authenticated proxy")

    @app.get("/api/transcriptions/health")
    def health():
        return {"service": "pamchenga-whisper", "models": sorted(MODELS), "weights": "operator-configured", "modelReadiness": "not-checked", "note": "Service reachable; actual inference requires installed weights. Health is not a model-readiness guarantee."}

    @app.post("/api/transcriptions")
    async def enqueue(
        request: Request,
        audio: Annotated[UploadFile, File()],
        job_id: Annotated[str, Form()],
        audio_sha256: Annotated[str, Form()],
        model: Annotated[str, Form()],
        language: Annotated[str, Form()] = "auto",
        region: Annotated[str, Form()] = "Southern Africa",
        prompt: Annotated[str, Form(max_length=1000)] = "",
    ):
        check_origin(request)
        try:
            job_id = str(UUID(job_id))
        except ValueError:
            raise HTTPException(422, "Invalid job ID")
        if model not in MODELS or language not in LANGUAGES or region not in PROMPTS:
            raise HTTPException(422, "Unsupported model, language hint or region")
        if not re.fullmatch(r"[a-f0-9]{64}", audio_sha256):
            raise HTTPException(422, "Invalid audio hash")
        cues = f"{PROMPTS[region]} {prompt}".strip()
        prior = store.get(job_id)
        if prior:
            if (prior["digest"], prior["model"], prior["language"], prior["prompt"]) != (audio_sha256, model, language, cues):
                raise HTTPException(409, "Job ID is already bound to different input")
            return response_for(prior)
        temporary = root / f"{job_id}.{os.urandom(8).hex()}.upload"
        digest = hashlib.sha256()
        size = 0
        try:
            with temporary.open("xb") as target:
                while chunk := await audio.read(1024 * 1024):
                    size += len(chunk)
                    if size > MAX_AUDIO_BYTES:
                        raise HTTPException(413, "Audio exceeds the 100 MiB limit")
                    digest.update(chunk)
                    target.write(chunk)
            if not size or digest.hexdigest() != audio_sha256:
                raise HTTPException(422, "Empty audio or SHA-256 mismatch")
            with store.connect() as db:
                db.execute("BEGIN IMMEDIATE")
                # Concurrent duplicate requests never replace an already accepted upload.
                if db.execute("SELECT id FROM jobs WHERE id=?", (job_id,)).fetchone() is None:
                    temporary.replace(root / f"{job_id}.audio")
                    db.execute("INSERT INTO jobs VALUES (?,?,?,?,?,'queued',NULL,NULL)", (job_id, audio_sha256, model, language, cues))
        finally:
            temporary.unlink(missing_ok=True)
            await audio.close()
        return response_for(store.get(job_id))

    def response_for(job):
        if not job:
            raise HTTPException(404, "Unknown transcription job")
        payload = {"id": job["id"], "status": job["status"], "audioSha256": job["digest"], "model": job["model"]}
        if job["result"]:
            payload["result"] = json.loads(job["result"])
        if job["error"]:
            payload["error"] = job["error"]
        return JSONResponse(payload, status_code=200 if job["status"] in {"completed", "failed"} else 202, headers={"Cache-Control": "no-store"})

    @app.get("/api/transcriptions/{job_id}")
    def status(job_id: str):
        return response_for(store.get(job_id))

    if serve_frontend:
        dist = Path(__file__).resolve().parent.parent / "dist"
        if dist.is_dir():
            app.mount("/", StaticFiles(directory=dist, html=True), name="pwa")
    return app
