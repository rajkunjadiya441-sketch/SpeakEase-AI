# SpeakEase AI architecture

## System overview

SpeakEase AI supports therapist-guided English speech practice, not diagnosis or replacement of a speech-language pathologist. React/Vite/Tailwind patient and therapist portals now integrate with the Python REST speech pipeline. CRUD/demo metadata remain browser-local and recording Blobs use IndexedDB; see the root README for current portable setup.

The therapist portal will manage patients, pronunciation targets, generated/approved exercises, assignments, recordings and progress. The patient portal will present assigned exercises, recording/replay, feedback and history. Targets may include sounds, syllables, words, phrases, sentences and everyday expressions. Planned exercise progression requires therapist approval.

The full planned flow is portals -> practice management -> approved exercises -> recording -> speech intelligence -> validated feedback/adaptation -> progress storage and therapist review. Planned Supabase PostgreSQL entities include users, patients, targets, exercises, attempts and progress; Supabase Storage will hold recordings when that milestone is authorized. LLM exercise generation/feedback and optional phoneme/GOP research are future work, not installed/integrated here.

## Current implemented data flow

Multipart WAV/WebM -> bounded temporary request buffering -> upload validation -> one decode/resample to mono 16 kHz float32 -> faster-whisper tiny CPU/int8 recognition -> isolated WhisperX CPU forced alignment of the recognized transcript -> structured JSON -> temporary cleanup.

The backend environment and alignment environment are separate. WhisperX 3.8.6 requires older Hugging Face dependencies than the backend uses. No backend dependency downgrade was made. Installed snapshots remain unchanged after integration. The existing decoded waveform is passed to alignment as a temporary .npy with allow_pickle=False; no second audio decode or transcription occurs. expected_text remains separate and is never supplied to either model.

## Folder structure

```text
backend/
  app/
    main.py                 # FastAPI, CORS, routes
    config.py               # process environment configuration
    upload_limit.py         # bounded multipart request buffering
    api/health.py           # liveness
    api/speech.py           # serialized speech pipeline and typed response
    services/audio.py       # validation, decoding and mono waveform
    services/transcription.py # shared lazy faster-whisper model
    services/alignment.py   # isolated subprocess adapter and safe fallback
  tests/                    # deterministic model/IPC/HTTP regressions
  scripts/
    transcribe_recording.py # explicit real ASR check
    compare_models.py       # isolated CPU model comparison
    check_integrated_http.py # real end-to-end HTTP, latency and memory checks
  requirements.txt          # existing backend pins
  .env.example
  .venv/                    # ignored backend environment
alignment/
  align_recording.py        # shared alignment function, WAV CLI and JSON IPC
  requirements.txt          # selected WhisperX/CPU dependency pins
  requirements-lock.txt     # installed isolated package snapshot
  backend-packages-before.txt # backend dependency integrity baseline
  README.md
  .venv/                    # ignored separate environment
models/                     # ignored model caches
test_audio/                # ignored private local fixtures/results
```

No Docker, Redis, microservices or model training. The alignment process is a local subprocess, not an HTTP server.

## APIs

GET /health returns HTTP 200 with {"status":"ok","service":"speakease-ai-backend"}. This is liveness, not model readiness. FastAPI provides /docs and /openapi.json.

POST /speech/analyze takes multipart file (required) and expected_text (optional, at most 2,000 characters). Existing audio policies remain: 10 MiB default file limit, 30-second default measured duration, MIME/signature/demuxer/decoding checks, one audio stream/no video, and a total multipart-body cap of file limit plus 64 KiB, including chunked bodies. PyAV decodes once; validation-only callers retain the validate_audio wrapper.

HTTP 200 response includes status completed or no_speech; processing_status completed; sanitized display filename; measured duration_seconds; expected_text or null; actual transcript; typed words with word/start/end; model; language en; alignment_status; alignment_error or null; and unaligned_words.

| Alignment status | Meaning |
| --- | --- |
| completed | All recognized words have validated real alignment timestamps |
| partial | Available actual timestamps returned; unaligned_words lists the remainder |
| failed | Missing runtime, timeout, process/model failure or invalid output; transcript preserved with safe error and empty words |
| skipped | Empty recognition/silence; worker not launched |

Alignment failure preserves successful recognition with HTTP 200 and processing_status completed. Clients must inspect alignment_status separately. Validation/transcription failures retain non-200 errors: 400 empty/malformed input; 413 size; 415 unsupported/mismatched format; 422 invalid/undecodable/over-duration audio or form data; 503 model load/inference failure. Overlapping speech requests return 429 + Retry-After: 2.

## Models and process boundary

Transcription: faster-whisper 1.2.1, tiny default, CPU/int8, two threads, one lazily loaded model per backend process, English, beam size 1, VAD enabled, no word timestamps. Lazy segment generation is fully consumed. Digital silence returns no_speech without loading the model; VAD may miss very short/quiet speech and ASR can hallucinate on noise.

Alignment: WhisperX 3.8.6 in alignment/.venv with torch/torchaudio 2.8.0+cpu and torchvision 0.23.0+cpu. English model WAV2VEC2_ASR_BASE_960H uses CPU float32/two threads. interpolate_method=ignore prevents filling missing timestamps. Only load_align_model and align are called; WhisperX does not transcribe. The shared run_alignment function serves both standalone and IPC entry points. IPC invokes it once per request.

Parent launches the absolute alignment interpreter and runner with shell=False. Versioned JSON stdin contains recognized transcript, sample rate and absolute temporary waveform path. Successful JSON stdout contains actual words/status and operational diagnostics; library/model output is redirected to stderr. The parent validates contract/version, transcript identity, word inventory/order, finite bounded timestamps and status consistency. It strips model confidence values rather than presenting them as pronunciation scores.

One nonblocking pipeline semaphore per backend process prevents overlapping validation/transcription/alignment. The aligner also limits subprocess execution to one. Run ONE Uvicorn worker: locks are not global across server processes. Synchronous processing runs in FastAPI's thread pool; /health remains responsive. Windows subprocesses run hidden, timeout handling terminates the launcher and descendant process tree, and private temporary IPC files are removed on success/error/timeout. Upload files close in finally. Model weights persist in ignored caches; patient recordings/waveforms are not stored by the API.

## Configuration

Process environment only; .env files are not loaded automatically. Defaults:

| Setting | Default |
| --- | --- |
| CORS_ORIGINS | http://localhost:5173,http://127.0.0.1:5173 |
| MAX_UPLOAD_BYTES | 10485760 |
| MAX_AUDIO_DURATION_SECONDS | 30 |
| WHISPER_MODEL | tiny |
| WHISPER_CPU_THREADS | 2 |
| WHISPER_MODEL_DIR | models |
| ALIGNMENT_PYTHON | alignment/.venv/Scripts/python.exe |
| ALIGNMENT_TIMEOUT_SECONDS | 120 |

Relative paths resolve from project root. Limits must be positive/finite. CORS allows GET/POST for explicit frontend origins, without credentials; CORS is not authentication.

## Actual verification and performance

Two real production HTTP uploads recognized "I have three happens." and aligned I 0.722-0.822, have 0.862-1.002, three 1.042-1.243 and happens. 1.263-1.604 seconds, with no unaligned words. expected_text remained "I have three apples." Source hashes and temporary cleanup were verified. These values are real observed outputs, not API constants.

Full request latencies were 21.46 s and 15.48 s despite cached weights. Peak resident working sets measured separately were about 1.13 GiB for an alignment worker and 271 MiB for the backend process; simultaneous aggregate peak was not measured. /health remained responsive. All 43 tests pass, including actual Windows descendant termination on timeout, and pip check passes in both unchanged environments. See PROGRESS.md for exact measurements and repeat commands.

Fresh alignment subprocess imports/model setup dominate latency. A persistent local worker or HTTP service could amortize startup and reuse a loaded model across requests, but would retain roughly a GiB or more of RAM and need lifecycle/error handling. No persistent worker or second alignment server is implemented; that requires separate approval. Current demonstration must allow a visible processing state and suitable request timeout.

## Scientific and compatibility limits

Forced alignment estimates where supplied recognized words fit audio; it does not establish correct pronunciation. Never replace recognition with expected exercise text or infer phoneme errors, pronunciation scores or diagnosis from timing/text mismatch. Isolated sounds and syllables may transcribe unreliably. No clinical assessment, target-text comparison or expected-text alignment is implemented.

WAV PCM and WebM/Opus are verified; other codecs depend on actual PyAV decoding. M4A was converted locally for a test and is not accepted by the upload API. RF64 is outside scope. WAV RIFF size is checked; recoverable WebM truncations may be indistinguishable from intentionally finalized streaming media. Submit completed browser recordings, not arbitrary MediaRecorder chunks.

## Milestones

1. Foundation/health: complete.
2. Validated audio upload: complete.
3. Real faster-whisper transcription: complete; tiny remains default.
4. Isolated WhisperX real alignment and API integration: complete.
5. Frontend live speech integration (Milestone5B): implemented, with standalone Chrome playback/word seeking verified; browser-local demo storage remains.
6. Quantitative evaluation (Milestone5C): measured ASR/alignment performance artifacts exist; independent boundary-accuracy annotation remains separate. Publication preparation does not run or alter benchmarks.
