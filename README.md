# SpeakEase AI

Local therapist-guided English speech-practice prototype:React/Vite frontend, FastAPI uploads, faster-whisper tiny transcription and isolated WhisperX word alignment. Patient/therapist CRUD and attempt metadata use browser demo storage; original recordings use IndexedDB. There is no production authentication, shared database, Supabase or LLM integration. This does not diagnose speech disorders or score pronunciation.

## Tested platform and prerequisites

The existing installation uses Windows, 64-bit Python3.11.9, Node22.20.0/npm10.9.3 and Git2.51.0. The locked Vite8.3.5 package declares Node ^20.19.0 or >=22.12.0; use the tested Node22.20.0 combination for the closest reproduction. Install Python with its Windows `py` launcher, Node/npm and Git before continuing. Google Chrome at its usual Windows installation path is also required by the existing browser test harness. Standalone Chrome is verified for real capture/playback/word seeking; Edge preview was user-tested. VS Code's integrated browser has a known WebM playback failure.

CPU-only operation is intentional; no NVIDIA GPU/CUDA toolkit, Docker, database server or API key is needed. PyAV Windows wheels include FFmpeg libraries; no separate FFmpeg command was required here. Use Windows x64/Python3.11:other platforms and architectures have not been verified. An Intel i5/8-GB laptop has run the application, but model imports/alignment use substantial memory and can page; close unnecessary apps and use one backend worker. Package/model downloads require initial internet access and disk space; weights/environments are not in Git.

Check installed tools:

```powershell
py -3.11 --version
node --version
npm --version
git --version
```

## Clone and create two separate Python environments

In a new parent folder, using the repository URL supplied by its owner:

```powershell
$repositoryUrl = Read-Host "Paste the SpeakEase AI GitHub clone URL"
git clone $repositoryUrl speak-easeAI
Set-Location -LiteralPath .\speak-easeAI
py -3.11 -m venv backend/.venv
& .\backend\.venv\Scripts\python.exe -m pip install --only-binary=:all: -r backend/requirements-lock.txt
& .\backend\.venv\Scripts\python.exe -m pip check
py -3.11 -m venv alignment/.venv
& .\alignment\.venv\Scripts\python.exe -m pip install --only-binary=:all: --extra-index-url https://download.pytorch.org/whl/cpu -r alignment/requirements-lock.txt
& .\alignment\.venv\Scripts\python.exe -m pip check
```

Create these environments only on a fresh clone, not over existing working environments. Activation is optional:all commands address the environment directly. No PowerShell execution-policy change is required for these Python commands. `backend/requirements.txt` and `alignment/requirements.txt` pin direct dependencies; their `requirements-lock.txt` files record the installed Windows snapshots. The alignment CPU index is needed for torch2.8.0+cpu, torchaudio2.8.0+cpu and torchvision0.23.0+cpu. Do NOT install alignment requirements in the backend environment:WhisperX3.8.6 needs huggingface-hub0.36.2/tokenizers0.22.2, whereas the working backend uses newer versions. Installation commands were checked against manifests/current environments; a clean online installation on another laptop was not performed during publication preparation. Do not silently substitute versions if a pinned wheel is unavailable.

Install frontend dependencies from its committed lockfile:

```powershell
npm --prefix ipd_frontend ci
```

## Configuration

Backend defaults already select tiny, CPU/int8/two threads and the separate alignment interpreter. `backend/.env.example` is a documentation template:the backend DOES NOT automatically read `.env`. Set process environment variables in the same PowerShell terminal used to launch it:

```powershell
$env:CORS_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
$env:MAX_UPLOAD_BYTES = "10485760"
$env:MAX_AUDIO_DURATION_SECONDS = "30"
$env:WHISPER_MODEL = "tiny"
$env:WHISPER_CPU_THREADS = "2"
$env:WHISPER_MODEL_DIR = "models"
$env:ALIGNMENT_PYTHON = "alignment/.venv/Scripts/python.exe"
$env:ALIGNMENT_TIMEOUT_SECONDS = "120"
```

Backend relative paths resolve from the project root. For frontend configuration, copy its public example:

```powershell
Copy-Item -LiteralPath ipd_frontend/.env.example -Destination ipd_frontend/.env.local
```

The example sets VITE_API_BASE_URL=http://127.0.0.1:8000 and VITE_SPEECH_TIMEOUT_MS=150000. Vite reads `.env.local` on startup; restart it after edits. VITE_ values are public browser code, never secret storage. Local `.env` files are ignored. No real credentials are required by this prototype.

## Start the application

Terminal1, from the repository root after setting backend variables:

```powershell
& .\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --workers 1
```

Terminal2, also from the repository root:

```powershell
npm --prefix ipd_frontend run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open http://127.0.0.1:5173 in standalone Chrome. Patient practice:http://127.0.0.1:5173/patient/practice. Therapist review:http://127.0.0.1:5173/therapist/attempts. Choose a demo assignment, record a short English sentence, stop, preview, then submit. Capture needs microphone permission; localhost is the intended development origin. Real results show the recognized text and available actual word times; clicking usable timestamps seeks the original recording. Browser data are separate per browser/profile AND exact origin:localhost and127.0.0.1 do not share history. This repository does not contain existing users' saved browser recordings.

API docs:http://127.0.0.1:8000/docs. Check liveness (does not load a model):

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

Expected result:status `ok`, service `speakease-ai-backend`. Stop servers with Ctrl+C in their own terminals. Avoid multiple Uvicorn workers:request/model locks are per process. Development `--reload` is optional and discards the cached ASR instance when restarted.

## Model acquisition and first request

Models are intentionally excluded from Git. First nonsilent request obtains faster-whisper tiny from Hugging Face under `models/`. The alignment child obtains torchaudio WAV2VEC2_ASR_BASE_960H (377,664,473-byte checkpoint) and NLTK punkt_tab under `models/alignment/`. It only aligns recognized text; it does not run WhisperX transcription. Public models used here require no OpenAI/Hugging Face API key. Do not enable unrelated diarization models.

The following OPTIONAL command explicitly downloads/loads the configured ASR model without transcribing a recording; run it only when ready to obtain weights:

```powershell
& .\backend\.venv\Scripts\python.exe backend/scripts/transcribe_recording.py --download-only
```

There is no existing alignment download-only CLI:the first alignment request initializes its resources. Initial download/loading can exceed the120-second alignment timeout on a slow connection. Transcription remains available if alignment fails. Retry after setup/network issues; if increasing ALIGNMENT_TIMEOUT_SECONDS, also increase VITE_SPEECH_TIMEOUT_MS beyond alignment timeout plus ASR/download overhead, and restart both servers. Cached runs still have substantial subprocess startup overhead. Complete offline operation requires all model and NLTK assets already cached; an empty clone is not offline-ready. Windows symlink-cache warnings can increase disk duplication without preventing caching.

## Lightweight verification (no model inference)

From the root:

```powershell
& .\backend\.venv\Scripts\python.exe -B -m unittest discover -s backend/tests -v
& .\backend\.venv\Scripts\python.exe -m pip check
& .\alignment\.venv\Scripts\python.exe -m pip check
npm --prefix ipd_frontend run build
npm --prefix ipd_frontend run lint
```

Backend tests generate temporary WAV/WebM fixtures, mock recognition/alignment, start temporary localhost servers and test health, cleanup/errors/concurrency. They do not fetch weights. Lint currently reports warnings; see the publication report for actual verification results.

With the frontend dev server already running on127.0.0.1:5173:

```powershell
npm --prefix ipd_frontend test
npm --prefix ipd_frontend run test:media
```

These browser suites use synthetic/controlled media and mocked speech responses. They require installed Chrome at C:/Program Files/Google/Chrome/Application/chrome.exe and Node's built-in WebSocket. `qa/` profiles/reports are ignored. They do not prove a fresh physical microphone or real model works on another laptop. Do NOT use `test:live`, `backend/scripts/check_integrated_http.py`, model comparison or evaluation runners for lightweight checks:those perform real inference and may require private fixtures/caches/datasets absent from Git.

## Limits, data and troubleshooting

- Only validated WAV/WebM, up to10 MiB/30 seconds by default. M4A is not accepted by the upload API. WAV/PCM and WebM/Opus are verified; other codecs depend on actual decoding. Submit the final complete MediaRecorder Blob, not arbitrary chunks.
- Requests are serialized; overlapping speech requests can return429. Validation failures use400/413/415/422; transcription initialization/inference failures use503. Inspect `alignment_status`:HTTP200 can preserve a good transcript with failed/partial alignment. See ARCHITECTURE.md for the contract.
- Expected text remains separate from recognition. ASR errors and alignment timings are not pronunciation accuracy or diagnosis. Demo preview fixtures are labeled separately from live results.
- Backend audio is temporary; frontend demo history and Blobs persist locally in localStorage/IndexedDB. Quota/clearing/site-data loss can remove recordings. There is no cross-device sharing, real authentication or production patient storage; do not expose the development servers publicly or use this as a clinical service.
- Standalone Chrome is the verified playback browser. VS Code integrated browser can capture WebM that its decoder cannot play. Do not change the working pipeline to work around that embedded-browser limitation.
- Existing cached API requests took roughly15-90 seconds in historical tests depending on conditions. Phase4 measured alignment child private commit up to about2.34 GiB on its pilot; simultaneous backend/system demand adds more. An8-GB machine can page or hit evaluation gates. No universal latency/memory guarantee is made.
- DLL import errors require checking64-bit Python/wheels and the relevant Windows runtime; no CUDA package or arbitrary dependency downgrade is a workaround. Check pip's error and `pip check` before changing versions.

## Repository contents and provenance

backend/ contains FastAPI source/tests/scripts; alignment/ contains the isolated runner/manifests; ipd_frontend/ contains ordinary React source files (not a submodule). Evaluation scripts/docs are included, but downloaded data, raw checkpoints, machine-specific metadata and model caches are excluded. [Compact benchmark summaries](evaluation/publication/summary.json) are copied from existing measured outputs, not rerun. Evaluation reproduction needs its approved datasets/cache/local provenance artifacts; running its tests blindly on a fresh app-only clone is not supported. Historical milestone documents may mention this author's old absolute paths and ignored evidence; use THIS README for portable setup.

Read [architecture](ARCHITECTURE.md), [progress history](PROGRESS.md), [frontend handoff](ipd_frontend/MILESTONE_5B.md) and [publication plan](docs/PUBLICATION.md). The original frontend repository/attribution is documented there. Redistribution permission/license must be resolved before making a public repository; no license is invented here.
