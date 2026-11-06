# Development progress

Date: October 27, 2026 (Asia/Calcutta).
Last updated: November 6, 2026 (Asia/Calcutta). Earlier entries below remain historical records.

## Current milestone

Milestone 5C Phase4 performance-only pilot COMPLETED and VERIFIED (3/3;63/63 words with valid times). Resumable25-recording performance-only benchmark PREPARED on November6, 2026; zero full-benchmark recordings processed. All47 Phase4 automated tests passed. Gates remain2 GiB available RAM/3 GiB commit headroom, with one alignment child at a time. All457 annotation rows are unchanged and pending; boundary accuracy remains unavailable. Phase3 results and application/environments are preserved. STOP awaiting explicit approval before full25 inference. Overall Milestone5C remains INCOMPLETE.

## Environment inspected

The existing backend folder was empty. Python 3.11.9 is available; launcher also lists 3.12 and 3.13. No Git repository is configured, so no commit is planned. No frontend files modified.

## Files created

Root: .gitignore, README.md, ARCHITECTURE.md, PROGRESS.md.
Backend: requirements.txt, .env.example, app/__init__.py, app/main.py, app/config.py, app/api/__init__.py, app/api/health.py. Local backend/.venv will be ignored.

## Dependencies

Installed in backend/.venv (Python 3.11.9). Direct dependencies: FastAPI 0.119.1, Uvicorn 0.38.0, Pydantic 2.12.3. No WhisperX, PyTorch, database, storage, or LLM packages.

## Verification

- PASS: live GET /health returns HTTP 200 and exact expected JSON
- PASS: CORS GET preflight allows both local Vite origins
- PASS: unrelated-origin CORS preflight rejected with HTTP 400
- PASS: OpenAPI exposes only /health; /docs responds HTTP 200
- PASS: pip check reported no broken requirements.
- No installation or runtime failures. No Git commit: repository is not configured.
- Verification used a temporary localhost port and stopped its own server afterward.
- Commands executed: py -0p; python --version; git status --short; py -3.11 -m venv backend/.venv; backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt; backend/.venv/Scripts/python.exe -m pip check; a Python standard-library HTTP smoke check launching Uvicorn and checking health, CORS, OpenAPI, and docs.
- Transitive packages: annotated-types 0.8.0, anyio 4.15.1, click 8.5.0, h11 0.16.0, idna 3.20, pydantic-core 2.41.4, starlette 0.48.0, typing-extensions 4.16.0, typing-inspection 0.4.4.
- Physical memory inspection reports 8,299,257,856 bytes; speech-model performance remains untested.

## Exact next steps and resume commands

From project root:

```powershell
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
backend/.venv/Scripts/python.exe -m pip check
cd backend
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In another terminal: `Invoke-RestMethod http://127.0.0.1:8000/health`.

Next: await user approval for Milestone 4, then check WhisperX alignment compatibility before installing anything. Keep the existing faster-whisper transcript and avoid retranscription. Do not recreate the virtual environment.

## Milestone 2 implementation and environment recovery

The interrupted installation had completed: pip show confirmed av 18.1.0 and python-multipart 0.0.32 inside backend/.venv; pip check reported no broken requirements. No packages were reinstalled, no venv recreated, and no additional dependencies installed during this resumed milestone. Both packages are now pinned in requirements.txt. No frontend changes. Git remains unconfigured, so no commit was made.

New files: backend/app/api/speech.py, backend/app/services/__init__.py, backend/app/services/audio.py, backend/app/upload_limit.py, backend/tests/test_upload.py.
Modified files: backend/app/main.py, backend/app/config.py, backend/requirements.txt, backend/.env.example, README.md, ARCHITECTURE.md, PROGRESS.md.

Implemented POST /speech/analyze with required multipart file and optional expected_text, typed response, measured audio duration, null transcript and not_started alignment. Configurable size/duration defaults: 10,485,760 bytes and 30 seconds. MIME/signature/container/decoder validation, single audio stream, bounded multipart bodies including chunked uploads, temporary cleanup, and GET/POST local CORS.

### Actual tests and commands

- Inspected progress, existing backend/config/dependencies; ran pip show av python-multipart and pip check.
- Executed: backend/.venv/Scripts/python.exe -m unittest discover -s backend/tests -v
- Final result: 18 tests PASSED in 2.538 seconds, using a real Uvicorn HTTP server.
- Valid WAV: HTTP 200; measured 1.0 seconds, expected_text preserved, transcript null, alignment not_started.
- Valid WebM/Opus: HTTP 200; measured approximately one second (1.0005 seconds in direct decoding).
- Empty: 400. Corrupt bytes, corrupt WebM and truncated WAV: 422. Unsupported MP3 MIME and mismatched MIME/signature: 415.
- Actual oversized PCM WAV: 413. Oversized multipart and chunked multipart bodies: 413.
- 30.1-second WAV: 422. Exactly 30-second WAV: 200.
- Optional expected_text, excessive expected_text rejection, custom service limits, health JSON, OpenAPI/docs and CORS POST: PASS.
- Tests checked temporary-spool directory cleanup after each upload; fixture files and server removed at teardown.
- Final pip check: No broken requirements found.

### Issues found and resolved

Initial run: 4 failures and 1 error. PyAV inferred write mode from a writable uploaded temporary file; fixed by explicit mode="r". Early rejection based on Content-Length caused a Windows client connection error; limiter now counts actual incoming bytes before rejection. Second run: 16/17 passed; temporary request-buffer cleanup raced response delivery. Fixed by closing the buffer as soon as replay finishes. Final run: all 18 passed.

### Remaining limitations

No unresolved failure in the tested Milestone 2 paths. Browser MediaRecorder integration and human speech recordings remain untested; fixtures are generated real audio tones. Not all WAV/WebM codecs were tested. WebM with valid recoverable samples may conceal truncation; strict completeness cannot be inferred for every streaming container. No standalone ffmpeg executable was installed. PyAV handles decoding via bundled libraries. No transcription, alignment, speech quality assessment, persistent recordings, or model packages.

### Resume

Read this file, README.md and ARCHITECTURE.md. Run the unittest command above and pip check if further changes are made. Start the existing backend with the commands above. Milestone 3 has since been approved and completed; await approval before Milestone 4.

## Milestone 3: real faster-whisper transcription COMPLETE

Approved scope: faster-whisper transcription only. WhisperX belongs to Milestone 4. No frontend, CUDA, PyTorch, Supabase, authentication, LLM, phoneme scoring, model training, or alignment work was added.

### Environment and installation

Existing Python 3.11.9 venv reused. CPU inspected: Intel i5-1135G7, 4 cores / 8 logical processors; reported installed RAM about 8 GB. Initial pip check passed. A pip --dry-run with existing requirements found no conflicts. Installed faster-whisper 1.2.1 and required runtime dependencies using binary wheels; preserved all five existing direct dependency versions including PyAV 18.1.0. Final pip check passed. CTranslate2 reports CPU support for int8, int8_float32, float32 and int16. No GPU packages installed.

Configuration: WHISPER_MODEL=tiny, CPU/int8 fixed, WHISPER_CPU_THREADS=2, WHISPER_MODEL_DIR=models (relative paths resolved from project root). One lazy model per process, one inference at a time, explicit busy HTTP 429; one server worker recommended. Only tiny was downloaded and tested; no base download. Model cache is ignored by Git. Windows symlink and anonymous Hugging Face rate-limit warnings occurred; download/load still succeeded. No Windows settings were changed.

### Files added or changed

Added: backend/app/services/transcription.py; backend/tests/test_transcription.py; backend/tests/upload_test_server.py (test-only dependency overrides); backend/scripts/transcribe_recording.py.
Modified: backend/app/services/audio.py; backend/app/api/speech.py; backend/app/config.py; backend/tests/test_upload.py; backend/requirements.txt; backend/.env.example; .gitignore; README.md; ARCHITECTURE.md; PROGRESS.md.
Created a private local test copy: test_audio/recording_2_test.wav. The original user-provided test_audio/Recording (2).m4a was preserved. test_audio/ is ignored. No Git commit because the directory is not a Git repository.

### Implementation

POST /speech/analyze validates and decodes once, converts to finite mono float32 at 16 kHz, and transcribes with faster-whisper. Original size/MIME/signature/duration restrictions and cleanup remain. A validation-only wrapper remains compatible with old callers. expected_text is returned but never passed into inference. The segment generator is fully consumed. words remains [] and alignment_status stays not_started. A silent waveform or empty recognition result returns no_speech with an empty transcript. Model load and inference failures return 503, while the server remains running. Model reuse and failure recovery are tested. No fake outputs exist in the production service; deterministic mocks are confined to test overrides.

### Deterministic test results

All original 18 validation checks retained, with successful-response assertions updated for the new API contract. Initial Milestone 3 suite: all 30 tests passed; an additional stereo resampling check brought the suite to 31 tests, all passed in 4.299 seconds. Tests cover real generated WAV/WebM decoding, one decode per upload, stereo-to-mono resampling, silence/no segments, mocked success, lazy inference errors, initialization failure/retry, slot release and concurrent rejection, one model load across repeated calls, cleanup, limits, health, OpenAPI/docs and CORS. Expected error logs in failure tests are intentional mocks, not unresolved production failures.

Commands run: pip show faster-whisper numpy ctranslate2; pip check; pip install --dry-run --only-binary=:all: -r backend/requirements.txt faster-whisper; pip install --only-binary=:all: -r backend/requirements.txt faster-whisper==1.2.1; CTranslate2 CPU capability check; unittest discover -s backend/tests -v; real recording script; actual HTTP endpoint checks.

### Actual real recording and results

The initially supplied test_audio/sample.wav did not exist; the first attempted real test stopped with FileNotFoundError after model preparation. No inference was claimed for that attempt. User then supplied test_audio/Recording (2).m4a and explicitly authorized conversion to a separate WAV. PyAV decoded it as AAC, stereo, 48 kHz, 143360 samples per channel. M4A is decodable but remains rejected by the WAV/WebM endpoint policy. Converted using existing PyAV into separate mono 16 kHz PCM WAV; no new conversion dependency installed.

Original M4A SHA256 before/after: f02c65c0bfcab9172a25bea0bb361d0cd9f2b854ab130ee3feed1c7aa8baff16 (unchanged).
Converted WAV SHA256: 7051b9226017fc51e465ca26885e49e1281f1cb194c8e533c57e8dc998f384b9; 95,652 bytes, measured duration 2.986688 seconds. WAV hash also unchanged by inference.

Actual recognized transcript, both real service calls: "I have three happens."
User-stated sentence: "I have three apples."
Model: tiny, CPU, int8, language en; beam size 1, VAD enabled. Transcription completed successfully but misrecognized "apples" as "happens". This is an ASR error, not a pronunciation diagnosis. No prompt was used to steer the result toward the expected text.

Measured model load: 1.2669 seconds (cached model, includes Python runtime import/setup). Audio decode: 0.0175 seconds. Inference: 0.7059 seconds first run, 0.4013 seconds second run using the same loaded model. These are observed single-recording timings, not performance guarantees.

Production HTTP checks (no mocks): WAV returned HTTP 200 with completed/completed, transcript "I have three happens.", expected_text "I have three apples.", words [], tiny/en, alignment not_started; total request 1.3307 seconds including model startup. An in-memory Opus WebM copy of the same real voice recording also returned HTTP 200 and the same transcript; measured duration 2.987188 seconds, total request 0.4302 seconds with model reused. /health during the real request returned expected HTTP 200 JSON in 0.0286 seconds. Test server terminated afterward.

A process-memory query selected the Windows virtual-environment launcher (about 4 MB), not the native inference process; that value is not a valid model RAM measurement and is excluded from performance conclusions. Actual inference peak RAM was not reliably measured. CPU/int8 inference did complete on this 8 GB machine; use one worker/two threads, and assess memory again before trying larger models.

### Known limitations and next steps

Tiny misrecognizes a word in this real recording. Quiet/very short speech may be dropped by RMS screening or VAD; noise can cause hallucinations. No claims about clinical accuracy. M4A conversion is a local test step, not an API format expansion. Existing recoverable-WebM truncation limitation remains. No real alignment or word timestamps exist yet.

Resume real test from project root:

```powershell
backend/.venv/Scripts/python.exe backend/scripts/transcribe_recording.py test_audio/recording_2_test.wav
backend/.venv/Scripts/python.exe -m unittest discover -s backend/tests -v
backend/.venv/Scripts/python.exe -m pip check
```

Start API: cd backend, then .venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000. Swagger /docs exposes the multipart form. Await explicit approval before Milestone 4.

### Installed package snapshot after Milestone 3

```text
annotated-types==0.8.0
anyio==4.15.1
av==18.1.0
click==8.5.0
colorama==0.4.6
ctranslate2==4.8.4
fastapi==0.119.1
faster-whisper==1.2.1
filelock==4.2.4
flatbuffers==25.12.19
fsspec==2026.9.0
h11==0.16.0
hf-xet==1.7.0
httpcore2==2.16.0
httpx2==2.16.0
huggingface_hub==2.3.0
idna==3.20
numpy==2.4.6
onnxruntime==1.31.1
packaging==26.3
protobuf==7.36.2
pydantic==2.12.3
pydantic_core==2.41.4
python-multipart==0.0.32
PyYAML==6.0.3
starlette==0.48.0
tokenizers==0.23.3
tqdm==4.70.1
truststore==0.10.5
typing-inspection==0.4.4
typing_extensions==4.16.0
uvicorn==0.38.0
```

## Post-Milestone 3: tiny versus base English comparison

Date: October 27, 2026 (Asia/Calcutta). User authorized a comparison only; default model remains tiny and Milestone 4 has not started.

Used the exact existing test_audio/recording_2_test.wav (2.986688 seconds). SHA256 remained 7051b9226017fc51e465ca26885e49e1281f1cb194c8e533c57e8dc998f384b9 in both workers; no conversion or modification during comparison. Compared the existing multilingual tiny configured for English against base.en, the English-only base variant requested by the user. Downloaded only base.en to the ignored cache; tiny retained as the working fallback. No dependency or application configuration changes.

Added backend/scripts/compare_models.py for reproducible measurement. Raw results saved under ignored private fixtures at test_audio/model_comparison.json. Commands:

```powershell
backend/.venv/Scripts/python.exe -m pip check
backend/.venv/Scripts/python.exe backend/scripts/compare_models.py test_audio/recording_2_test.wav --output test_audio/model_comparison.json
```

Method: one fresh inference process per model, run sequentially; CPU/int8, two CPU threads, one model worker, English, beam size 1, VAD enabled, no prompt/expected_text, no word timestamps. Decode once per process and reuse the waveform and loaded model for four calls. Warm time is the median of calls 2-4. Model download used a separate preparation process so its overhead is excluded from inference-worker timing/memory. GetProcessMemoryInfo is called inside the actual Python inference process, avoiding the Windows venv launcher measurement error from Milestone 3.

| Model | Actual transcript (all four calls) | First inference s | Warm median s | Peak resident working set MiB | Private commit after inference GiB |
| --- | --- | ---: | ---: | ---: | ---: |
| tiny | I have three happens. | 1.159 | 0.924 | 252.4 | 1.06 |
| base.en | I have three happens. | 1.288 | 0.878 | 330.8 | 1.39 |

Results: both models completed all four real inference calls successfully. Both misrecognized the intended "apples" as "happens". No transcript correction was applied. No accuracy gain demonstrated by base.en on this recording. One recording is insufficient to establish general ASR accuracy.

Detailed timing:
- tiny: cached model loading 1.671 s; decoding 0.095 s; inference calls 1.159, 1.190, 0.716, 0.924 s.
- base.en: cached model loading 2.347 s; decoding 0.013 s; inference calls 1.288, 1.192, 0.812, 0.878 s.

Initial base.en download plus preparation took 50.443 seconds; this is not inference latency. Windows symlink/anonymous-download warnings occurred, but download, loading and inference succeeded. pip check passed with no broken requirements. No packages were installed or replaced. Production code did not change, so the prior complete 31-test passing result remains the latest application test run; it was not rerun solely for this standalone benchmark/documentation change.

Memory interpretation: peak working set is a whole-process physical resident high-water mark including imports, initialization and inference, not model weights alone and not a server-process memory guarantee. Private commit is committed private virtual memory measured after inference, not additional resident RAM to add to the working set and not a measured peak. The OS reported only 581,016 KiB (~567 MiB) free physical memory during preparation on this roughly 8 GB laptop. Paging/working-set trimming and other applications may affect both timings and resident-memory readings. Native inference process IDs were tiny 1724 and base.en 23848, as captured in the JSON. No models were resident simultaneously during the measured runs.

Recommendation: retain tiny for now because it used less resident/committed memory with identical recognition on this clip. The warm medians differ by only ~0.046 seconds and individual call ranges overlap; this is not evidence that the larger model is generally faster. base.en is CPU/int8-compatible on this machine, but there is no demonstrated benefit here to justify switching defaults. Evaluate more real recordings before deciding on a change; keep a single worker and avoid loading both models simultaneously on the 8 GB laptop.

Default remains WHISPER_MODEL=tiny in app/config.py and .env.example. No frontend, API contract, WhisperX alignment, phoneme assessment, or scoring changes. Await user review of the comparison; do not start Milestone 4 without approval.

## Milestone 4 compatibility inspection: STOPPED before installation

Date: October 27, 2026 (Asia/Calcutta). User explicitly instructed stopping and reporting dependency conflicts before making dependency/application changes.

Read README, ARCHITECTURE, progress history, audio/transcription services, upload route, middleware and all existing tests. Existing environment: Python 3.11.9, faster-whisper 1.2.1, PyAV 18.1.0, NumPy 2.4.6, CTranslate2 4.8.4, huggingface-hub 2.3.0, tokenizers 0.23.3. torch, torchaudio and whisperx are not installed. Initial and final pip check passed.

Executed non-installing resolver checks:

```powershell
backend/.venv/Scripts/python.exe -m pip install --dry-run --only-binary=:all: -r backend/requirements.txt whisperx
backend/.venv/Scripts/python.exe -m pip install --dry-run --only-binary=:all: -r backend/requirements.txt whisperx==3.8.6 huggingface-hub==2.3.0 tokenizers==0.23.3 ctranslate2==4.8.4
```

First dry run selected stable whisperx 3.8.6 and proposed replacing huggingface-hub 2.3.0 with 0.36.2 and tokenizers 0.23.3 with 0.22.2, plus installing a large dependency tree (torch/torchaudio 2.8.0, torchvision 0.23.0, torchcodec 0.7.0, transformers, pyannote-audio and others). This is only a proposed resolution, not evidence that those replacements preserve working runtime behavior. No packages were installed or uninstalled; dry runs did fetch package metadata/wheels into pip's cache.

Second dry run preserved the existing Hugging Face/tokenizer/CTranslate2 versions and failed with ResolutionImpossible: whisperx 3.8.6 requires huggingface-hub<1.0.0, which conflicts with installed huggingface-hub==2.3.0. Therefore stopped, rather than downgrading the working transcription environment or bypassing dependency checks. This proves a version requirement conflict for the stable release checked; it does not prove that every other WhisperX version or isolated setup is impossible.

Upstream source inspection identified the English default alignment model as torchaudio WAV2VEC2_ASR_BASE_960H (Hugging Face equivalent facebook/wav2vec2-base-960h). It was NOT downloaded or loaded. Windows/Python wheels exist for the resolved torch/torchaudio versions, but native CPU runtime compatibility and RAM behavior have NOT been tested here. A later approved installation must explicitly select CPU-only PyTorch wheels; no CUDA packages were installed. Development main identifies itself as 3.8.7rc1 and has different dependency declarations; it was not selected or installed as a workaround.

Upstream references:
- https://github.com/m-bain/whisperX/blob/main/pyproject.toml
- https://github.com/m-bain/whisperX/blob/main/whisperx/alignment.py

Verification after the checks:
- Complete existing unittest suite: 31 tests PASSED in 2.397 seconds, including health, upload limits, cleanup and deterministic transcription checks.
- pip check: No broken requirements found.
- pip show confirmed huggingface-hub 2.3.0 and tokenizers 0.23.3 still installed.
- Production endpoint, tiny default, requirements.txt, .env.example, frontend and source recordings unchanged.
- Only project file modified this turn: PROGRESS.md (this compatibility report).
- No real alignment attempt; no word timestamps, timing or alignment RAM results available. Milestone 4 is NOT complete.

Next step requires user review: choose whether to investigate a separately isolated alignment runtime or plan a controlled dependency migration with regression validation. Do not install/downgrade packages, recreate the existing venv, or implement frontend integration until this compatibility decision is resolved.

## Isolated alignment investigation (authorized, in progress)

User approved alignment/.venv in Python 3.11, with backend/.venv unchanged. Created alignment/requirements.txt, alignment/align_recording.py, alignment/README.md and backend package baseline alignment/backend-packages-before.txt; added alignment/.venv/ and installer report to .gitignore. Standalone runner uses the recognized transcript, CPU English WAV2VEC2_ASR_BASE_960H, interpolation disabled and no transcription. Backend integration is not authorized in this step.

Dry run resolved 102 packages with explicit torch==2.8.0+cpu, torchaudio==2.8.0+cpu, torchvision==0.23.0+cpu, whisperx==3.8.6, transformers==4.57.6, huggingface-hub==0.36.2 and tokenizers==0.22.2. Installation is running only in alignment/.venv. Installer report confirmed no NVIDIA/CUDA packages. Initial report inspection hit Windows default encoding UnicodeDecodeError; explicitly reading the UTF-8 JSON corrected it. No dependency conflict in the isolated resolver. CPU wheel download was about 619 MB for torch; installation has been slow but continues progressing.

Backend verification during isolated setup: all 31 tests passed in 3.553 seconds; pip check passed. Real tiny CPU/int8 transcript remained "I have three happens." on both calls (0.8888 and 0.5456 seconds inference), with unchanged WAV SHA256. No backend dependency/source/default changes.

Standalone alignment result is pending; do not claim alignment completed until the next result entry. If resuming an interrupted install, inspect alignment/.venv with pip show/pip check before attempting repairs; never recreate backend/.venv.

## Isolated WhisperX alignment: standalone test COMPLETE

Date: October 27, 2026 (Asia/Calcutta). Isolated environment installation and real CPU alignment succeeded. This resolves the dependency conflict by separation, not by modifying backend/.venv. Full backend API alignment integration is still NOT implemented; user requested stopping after this test and recommendation.

### Exact setup

Created alignment/.venv using Python 3.11.9, kept separate from backend/.venv, and ignored it explicitly in .gitignore. Resolver checked alignment/requirements.txt with CPU wheel index and produced alignment/install-plan.json; verified 102 packages, torch/torchaudio/torchvision +cpu versions, and no NVIDIA/CUDA entries. The report is ignored by Git. A Windows default-encoding error when initially inspecting the report was fixed by reading it as UTF-8; no runtime workaround or backend change was involved.

```powershell
py -3.11 -m venv alignment/.venv
alignment/.venv/Scripts/python.exe -m pip install --dry-run --only-binary=:all: --extra-index-url https://download.pytorch.org/whl/cpu -r alignment/requirements.txt --report alignment/install-plan.json
alignment/.venv/Scripts/python.exe -m pip install --only-binary=:all: --extra-index-url https://download.pytorch.org/whl/cpu -r alignment/requirements.txt
alignment/.venv/Scripts/python.exe -m pip check
```

The venv creation command is for initial setup only: do not recreate either existing venv when resuming. All packages installed solely in alignment/.venv. Key versions: whisperx 3.8.6; torch 2.8.0+cpu; torchaudio 2.8.0+cpu; torchvision 0.23.0+cpu; transformers 4.57.6; huggingface-hub 0.36.2; tokenizers 0.22.2. Exact installed snapshot is alignment/requirements-lock.txt; use the same CPU index if recreating this separate environment elsewhere. WhisperX metadata brings a broad dependency tree including diarization/transcription packages, but no such models or workflows were invoked. Backend requirements and installed versions are untouched.

### Actual model and real recording

WAV: test_audio/recording_2_test.wav; PCM16 mono 16 kHz; measured 2.9866875 seconds. Original SHA256 7051b9226017fc51e465ca26885e49e1281f1cb194c8e533c57e8dc998f384b9 was unchanged after all tests. The supplied recognized transcript was exactly "I have three happens." No expected-text substitution, prompt, WhisperX transcription, or pronunciation scoring.

Alignment model: WAV2VEC2_ASR_BASE_960H via torchaudio.pipelines, CPU float32 with two PyTorch threads and one interop thread. Runtime torch.version.cuda was None. Downloaded the ~360 MiB wav2vec2 checkpoint under ignored models/alignment, plus NLTK punkt_tab data under models/alignment/nltk_data. No standalone FFmpeg required: this runner reads the existing supported WAV using Python wave, converts it to float32 and passes its waveform directly to WhisperX align. The same alignment model was reused for two calls in each process. interpolate_method=ignore prevents filling absent timestamps.

Actual word timestamps (seconds), identical on all four real calls:

| Supplied recognized word | Start | End |
| --- | ---: | ---: |
| I | 0.722 | 0.822 |
| have | 0.862 | 1.002 |
| three | 1.042 | 1.243 |
| happens. | 1.263 | 1.604 |

No unaligned words. These are positions estimated for the supplied recognized transcript, not evidence that "happens" was correctly spoken or that "apples" was mispronounced. Missing/unusable timings are never fabricated by the runner.

### Performance and memory

Initial process: model load including first download 33.672 s; alignment calls 2.355 s and 0.631 s. Whole script 85.216 s including imports, setup, downloads and two calls.
Cached process: model load 2.089 s; alignment calls 1.113 s and 0.767 s. Whole script 19.611 s, including imports, setup and two calls. This is NOT an already-loaded-model API latency measurement; one-shot subprocess requests must budget startup overhead rather than promising subsecond responses.

Windows GetProcessMemoryInfo was called inside the actual inference process. Initial peak resident working set 895.3 MiB; cached peak 1.117 GiB (1144.0 MiB). Cached private committed memory after inference 1.733 GiB. These are whole-process figures including libraries/model/setup, not model weights alone. Private commit is not extra resident RAM to add to working set. Low free system RAM (~586 MiB before setup) and paging can affect timings and observed resident memory. Backend and alignment models were not kept loaded together during these standalone measurements; combined integration memory remains to be checked.

### Verification

- Standalone CPU alignment succeeded in two fresh processes, two model-reusing calls each, with identical valid timestamps and no unaligned words.
- pip check in alignment/.venv: No broken requirements found.
- pip check in backend/.venv: No broken requirements found.
- Backend pip freeze exactly matched alignment/backend-packages-before.txt after the isolated installation.
- All existing 31 backend tests passed (3.553 s) during this investigation, including health, upload validation, cleanup and deterministic transcription checks.
- Real backend tiny inference remained "I have three happens." twice (0.889 s, 0.546 s), confirming faster-whisper still works.
- No actual alignment runtime errors. Installation was lengthy due to large CPU wheels and the full dependency tree. No CUDA packages installed.

### Reproduce standalone alignment

```powershell
alignment/.venv/Scripts/python.exe alignment/align_recording.py test_audio/recording_2_test.wav --transcript "I have three happens." --output test_audio/alignment_cached_result.json
```

Raw results: test_audio/alignment_result.json and test_audio/alignment_cached_result.json (private ignored fixtures). Setup/usage: alignment/README.md. Runner: alignment/align_recording.py. No persistent patient uploads added.

### Integration recommendation, not implemented

For Friday's simplest initial integration, use one on-demand subprocess launched with the absolute alignment/.venv interpreter path and shell=False, serialize alignment requests, predownload weights, set a configurable timeout, and validate its JSON result. This adds no second server/port and releases alignment RAM afterward. However, measured cached full-script cost was about 19.6 s for startup/setup and two calls; do not advertise the 0.77 s warm inference figure as one-shot request latency. Allow a visible processing state and budget roughly tens of seconds pending a real integrated timing check.

A localhost-only HTTP alignment service would preload/reuse its model, giving lower repeated-request latency and more straightforward health checks, but adds another server to start/monitor and keeps about a GiB or more of resident memory in use. Prefer that later if interactive latency is essential and combined memory testing passes. No HTTP alignment service or subprocess adapter has been implemented here.

Future adapter should pass the existing decoded mono 16 kHz waveform (e.g. a temporary .npy with allow_pickle=False) plus the actual recognized transcript, never expected_text; avoid decoding or transcribing again. Temporary IPC files must be cleaned on all outcomes. Timeout handling on Windows must terminate the child process tree to avoid leaving the real Python worker resident. On alignment failure, timeout, invalid JSON or unavailable model, preserve successful transcript and return an explicit alignment failure status with empty or genuinely partial words. A pipeline-level concurrency limit should prevent simultaneous large inference workloads on the 8 GB laptop.

### Files changed in this isolated investigation

Added alignment/requirements.txt, alignment/requirements-lock.txt, alignment/align_recording.py, alignment/README.md, alignment/backend-packages-before.txt. Created ignored alignment/.venv and alignment/install-plan.json, model cache and private JSON result files. Modified .gitignore, PROGRESS.md and ARCHITECTURE.md. No backend source/dependency/default changes, frontend changes, expected-text alignment or API integration. Await user review before implementing integration.

## Milestone 4 integration COMPLETE: FastAPI to isolated WhisperX subprocess

Date: October 27, 2026 (Asia/Calcutta). User approved completing integration through serialized subprocesses. No dependency installation or environment recreation occurred. No second alignment server, frontend, scoring, expected-text alignment, feedback, Supabase or model-default changes.

### Implemented contract and safety

POST /speech/analyze still validates WAV/WebM and uses the shared faster-whisper tiny CPU/int8 model. The existing decoded mono 16 kHz float32 waveform is saved as a temporary .npy, and recognized transcript plus absolute waveform_path/sample_rate/version are sent as JSON on stdin to alignment/.venv/Scripts/python.exe running alignment/align_recording.py --ipc. No audio decoding or WhisperX transcription occurs in the child. The standalone WAV CLI remains available, sharing the same run_alignment function.

Worker stdout is only versioned successful JSON; model/library diagnostics are redirected to stderr. Worker returns actual timestamps, missing words and process timing/memory diagnostics. Parent validates protocol/transcript identity, word inventories/order, finite ordered timestamps within audio duration, and consistency of completed/partial/failed status. No interpolation of missing timestamps, target-text replacement or pronunciation score.

Config: ALIGNMENT_PYTHON defaults to alignment/.venv/Scripts/python.exe relative to project root; ALIGNMENT_TIMEOUT_SECONDS defaults to 120 and must be positive/finite. Runner and interpreter paths are absolute, command is an argument list with shell=False, child working directory is project root. Windows launches are hidden. Timeout uses taskkill /T /F on the worker launcher tree; regression test verifies termination of an actual Python descendant. Private temporary directories close/remove the waveform on success, failure and timeout.

A nonblocking per-process pipeline semaphore serializes validation/transcription/alignment, returning HTTP 429 + Retry-After: 2 for overlapping speech work. The aligner has its own subprocess semaphore. Run ONE Uvicorn worker: these locks are not cross-process global locks. /health remains responsive while speech work runs in FastAPI's thread pool.

Response adds typed words, alignment_status (completed/partial/failed/skipped), alignment_error (safe generic message or null) and unaligned_words. Empty transcript/silence skips alignment. Alignment errors, malformed output, missing environment or timeout retain HTTP 200 with the successful real transcript and processing_status completed, while marking alignment failed and returning empty words plus a safe error. Partial results preserve genuine timestamps and list unaligned words. Transcription/validation errors retain their existing non-200 behavior.

### Actual real end-to-end HTTP results

Used unchanged test_audio/recording_2_test.wav, source SHA256 7051b9226017fc51e465ca26885e49e1281f1cb194c8e533c57e8dc998f384b9. Two actual production HTTP calls, no dependency overrides or fake model outputs. Both HTTP 200; transcript "I have three happens."; expected_text separately "I have three apples."; model tiny/en; status completed; processing_status completed; alignment_status completed; alignment_error null; unaligned_words [].

Actual words, identical in both calls:

| Word | Start seconds | End seconds |
| --- | ---: | ---: |
| I | 0.722 | 0.822 |
| have | 0.862 | 1.002 |
| three | 1.042 | 1.243 |
| happens. | 1.263 | 1.604 |

Total request latency: 21.457 s first request, 15.480 s repeated request. Model weights were cached already. These include validation, transcription, process startup, model loading, alignment and response serialization, not just alignment math. /health during those requests completed in 0.0345 s and 0.0052 s with the original expected health JSON. Temporary IPC directory empty after each response. Original recording hash unchanged.

Alignment child peak resident process working set: maximum 1.129 GiB. Backend process peak resident working set: maximum 270.7 MiB. These are separate per-process high-water marks and should not be presented as a measured simultaneous combined peak. Child process private commit after inference was about 1.73 GiB. Measurements include libraries/model/setup, not weights alone. Subprocesses exited after each request, releasing their memory. The backend test harness used a real Uvicorn HTTP server thread and read worker diagnostics through the in-process adapter solely for measurement; no diagnostics endpoint was added.

Raw report: test_audio/integrated_http_result.json (ignored private fixture). Reproducible check: backend/scripts/check_integrated_http.py, which runs two real HTTP uploads, confirms health and cleanup, stops its temporary server and preserves the recording.

### Verification

Complete final test suite: 43 PASSED in 6.493 s. Original 31 tests retained with response expectations adapted. Added real timestamps/IPC validation, partial result handling, stderr-safe subprocess failure, timeout fallback and slot release, missing environment, empty transcript skipping, invalid JSON/timestamps/word replacement/order rejection, temporary cleanup, concurrent subprocess prevention, real Windows descendant-tree timeout termination, HTTP fallback preserving transcript, HTTP concurrent request rejection and health responsiveness. Mock timestamps exist only in deterministic tests, not production code. Intentional failure-test exception logs are expected.

Both environments: pip check -> No broken requirements found. Backend pip freeze matches alignment/backend-packages-before.txt exactly; alignment pip freeze matches alignment/requirements-lock.txt exactly. No package changes in either environment. No unresolved test or real inference failure. No Git commit because this workspace is not configured as a repository.

### Performance limitation and recommendation

15-21 seconds per short recording is slow for interactive practice; the repeated request still launches/imports/loads a new alignment process. A persistent local alignment worker would amortize imports/model initialization and could bring subsequent requests closer to the warm alignment plus ASR times observed in earlier tests. That integrated latency is NOT yet measured or guaranteed. It would keep roughly a GiB or more resident and require worker lifecycle/timeout handling. A local HTTP alignment service is one possible design, but NO persistent worker or second server was implemented. User approval is required before that change. Current subprocess implementation is functional for a demonstration with an honest visible processing state.

### Files changed

Added backend/app/services/alignment.py, backend/tests/test_alignment.py, backend/scripts/check_integrated_http.py.
Modified backend/app/api/speech.py, backend/app/config.py, backend/.env.example, backend/tests/test_upload.py, backend/tests/upload_test_server.py, alignment/align_recording.py, alignment/README.md, README.md, ARCHITECTURE.md, PROGRESS.md.
Generated ignored test_audio/integrated_http_result.json and test_audio/milestone4-tests.txt. Neither requirements file nor environment installed packages changed. No frontend modifications.

### Resume and repeat commands

```powershell
backend/.venv/Scripts/python.exe -m unittest discover -s backend/tests -v
backend/.venv/Scripts/python.exe -m pip check
alignment/.venv/Scripts/python.exe -m pip check
backend/.venv/Scripts/python.exe backend/scripts/check_integrated_http.py
cd backend
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Swagger: http://127.0.0.1:8000/docs -> POST /speech/analyze -> Try it out -> select audio and optional expected_text -> Execute. Keep frontend request timeout longer than alignment timeout plus transcription/startup overhead. One Uvicorn worker only. STOP awaiting approval before Milestone 5.

## Milestone 5A: frontend completion COMPLETE (historical summary)

Date: October 30, 2026 (Asia/Calcutta). Added to this project log on October 31 from the existing [frontend handoff](ipd_frontend/MILESTONE_5A.md); that original handoff remains unchanged. The root log previously ended at Milestone 4.

Completed the existing React frontend for an offline demonstration: recorder lifecycle/limits/cleanup, native playback and word seeking, labeled results preview, local recording persistence, history/details, manual therapist review, patient-aware navigation and targeted assignment/settings fixes. Existing design, CRUD, generator/approval and assignment flows were preserved. All 5A edits were inside ipd_frontend/ with no new packages or backend changes.

Historical verification: build passed; lint exited 0 with 0 errors and 86 warnings; 36 browser checks passed; reloaded saved audio and 390-px mobile layout passed. Physical microphone hardware was not tested. Live OpenAPI was unavailable during 5A, so real speech submission was deliberately pending at that point; it succeeded in 5B below. Detailed changed-file inventory, issues/fixes and original results remain in [MILESTONE_5A.md](ipd_frontend/MILESTONE_5A.md).

## Milestone 5B — Live Frontend–Backend Integration

Implementation and required verification completed October 30, 2026 (Asia/Calcutta). Project progress synchronized October 31, 2026. Status: COMPLETE for the approved 5B scope. This documentation-only follow-up did not rerun inference, build, lint, browser tests, backend tests or pip checks; results below are the executed 5B results, checked against the saved reports and prior command output.

### Completed features and API integration

- Inspected the live FastAPI /openapi.json and saved its actual schema before finalizing response types. The earlier 5A live-API blocker was no longer present during 5B; no backend/environment repair or dependency changes were made in this milestone.
- Real POST /speech/analyze uses FormData with required file (original WAV/WebM Blob) and optional expected_text (assigned prompt). The browser sets the multipart Content-Type boundary. Base URL is VITE_API_BASE_URL, default http://127.0.0.1:8000; timeout is VITE_SPEECH_TIMEOUT_MS, default 150000 ms.
- The response validator checks required fields and present optional structures. Actual transcript and expected text remain separate. No missing optional fields or word timestamps are synthesized. Only usable supplied start/end values become clickable playback positions.
- Practice submission has the required around-20-seconds message, elapsed timer, keep-waiting/cancel notice after 20 seconds, AbortController cancellation/unmount cleanup, duplicate guards, safe HTTP/network/timeout/response errors and no demo-result fallback.
- Actual response, original audio data URL, patient/assignment/exercise/target IDs, submittedAt and PENDING review status use the existing local attempt/storage service. A stable attempt ID prevents duplicate saves. Quota errors preserve visible results; Retry Save retries persistence without another analysis request.
- Shared patient/therapist results show real transcript and aligned words; word clicks highlight and seek/replay the original audio. Failed/partial alignment keeps the successful transcript and recording. Manual feedback and Reviewed status survive reload. The separately labeled example preview remains separate.

### Files created or modified

All implementation paths below are relative to ipd_frontend/. Some were created during 5A and extended in 5B; the historical 5A inventory remains in its handoff.

- .env.example; package.json (test:live script only, dependencies unchanged).
- src/services/speechService.js; src/services/attemptService.js; src/utils/speech.js.
- src/pages/patient/PracticeSessionPage.jsx; src/components/ui/SpeechAnalysisResults.jsx.
- src/components/layout/PatientLayout.jsx; src/components/layout/TherapistLayout.jsx.
- docs/backend-openapi.json.
- tests/browser.jsx; tests/live.html; tests/live.jsx; tests/run-live.mjs.
- README.md; MILESTONE_5B.md.

This explicitly authorized documentation follow-up updates only root PROGRESS.md and ipd_frontend/MILESTONE_5B.md. No other file outside ipd_frontend/ was modified. No backend/alignment code, Python environments, installed packages, transcription defaults or AI models changed in 5B. No commit, push or merge was made.

### Actual real speech analysis

Used unchanged test_audio/recording_2_test.wav (Milestone 3 human recording). Controlled browser capture supplied the original file bytes through the actual practice UI; the browser HTTP request, backend transcription and alignment were real, not mocked. This is not a physical microphone test. SHA256 before/after: 7051b9226017fc51e465ca26885e49e1281f1cb194c8e533c57e8dc998f384b9.

One HTTP 200 request with fields file and expected_text; expected text "I have three apples."; actual transcript "I have three happens."; model tiny, language en, measured duration 2.986688 seconds; status/processing_status completed; alignment_status completed; alignment_error null; no unaligned words. Expected text was never substituted for recognition.

| Actual word | Start seconds | End seconds |
| --- | ---: | ---: |
| I | 0.722 | 0.822 |
| have | 0.862 | 1.002 |
| three | 1.042 | 1.243 |
| happens. | 1.263 | 1.604 |

Observed request latency: 90.4017 seconds; total UI time through local save: 90.7357 seconds. Required processing message/elapsed timer, exact response persistence, original-audio word seeking, manual feedback/Reviewed state and reloaded patient results/playback passed. The test used an isolated browser profile; it did not add the QA attempt to the user's normal browser profile.

### Verification and build status

- PASS: npm run build (production Vite build).
- PASS: npm run lint, exit 0, 0 errors and 86 warnings (same count as 5A).
- PASS: npm test, 50 passed / 0 failed, retaining the previous 36 checks; no uncaught browser errors.
- PASS: saved original audio available after reload; mobile body/viewport both 390 px, no horizontal overflow.
- PASS: real live browser harness, now exposed as npm run test:live, with actual HTTP 200 and model-generated alignment as above.
- PASS: GET /health HTTP 200 during live verification; CORS preflight HTTP 200 and matching allow-origin for both http://127.0.0.1:5173 and http://localhost:5173. No backend CORS change was required.
- PASS: git diff --check (line-ending notices only).

Deterministic tests cover microphone denial/recorder cleanup, empty/oversized/unsupported recordings, limits, all 18 routes and existing workflows, correct multipart fields/headers, response mapping, loading clock, cancellation/duplicates, backend unreachable, HTTP 413/415/422/429/503, malformed/missing response data, timeout, alignment failure/partial/missing timestamps/unaligned words, seeking, quota recovery, persistence and manual review. Failure paths use mocks, not claims of real model failures. Backend unit tests/pip checks were not rerun in this frontend-only milestone; the 43-test and pip-check results above remain historical Milestone 4 evidence.

Evidence: ipd_frontend/qa/browser-results.json, qa/lint-5b.txt, qa/live-results.json and qa/live-result.png (ignored local artifacts). Detailed run instructions, exact field mapping and file inventory: [MILESTONE_5B.md](ipd_frontend/MILESTONE_5B.md).

### Errors encountered and fixes applied

- Browser checks initially hit asynchronous route/control readiness races. Added explicit waits for loaded controls, restored test state between cases and adjusted readiness polling; the final 50-check run passed.
- The initial live harness queried a stale/uninitialized DOM node before file-input readiness. Explicit page navigation and a ready signal fixed it. That harness failure was not reported as a successful inference; the subsequent actual request passed.
- LocalStorage quota failure after successful analysis is surfaced without discarding the actual result. Stable-ID Retry Save reuses that response; its deterministic test confirmed no second analysis call.
- Network/HTTP/timeout/malformed-response and alignment-failure tests now show safe errors or retained transcripts instead of example results. These intentional test failures are not unresolved live-backend failures.
- The 90.4-second real request is an unresolved performance limitation, not a fixed error. Its cause was not isolated; it completed within the 150-second client timeout. No second server or persistent worker was introduced.

### Partially verified and pending work

Partially verified: microphone/permission behavior is automated with controlled browser fixtures, while physical device capture and native permission dialogs remain untested. Performance has one real 5B request measurement; repeated warm-request timing, individual backend stage timing and RAM were not measured here. No additional completion claim is made for those checks.

Remaining limitations: metadata/history/feedback still live in browser demo storage, without authentication or a database. Data URLs can exhaust quota below the backend's 10-MiB limit; localStorage is not secure clinical storage. Browser encoding support limits capture to supported WAV/Opus WebM. Client cancellation does not guarantee server-side cancellation; retry may receive busy HTTP 429. Missing timestamps are never interpolated. Alignment estimates positions, not pronunciation correctness, and ASR differences are not classified as mispronunciation.

### Next recommended milestone (pending approval)

Proposed Milestone 5C: demonstration readiness and CPU latency profiling. Manually verify real microphone permission/capture on the target browser/laptop, measure repeated full requests and memory/stage timings, then review whether persistent model reuse is justified. A persistent alignment worker or second server requires separate approval and has not been implemented. Do not automatically add scoring, LLM feedback, Supabase, authentication or database integration.

STOP after Milestone 5B. Await explicit user approval before any further implementation.

## Milestone 5B playback and word-seeking follow-up

Date: October 31, 2026 (Asia/Calcutta). Status: verified for the supported standalone Chrome workflow, with the embedded-browser limitation documented explicitly. Previous milestone entries above are historical and preserved. Detailed handoff: [MILESTONE_5B.md](ipd_frontend/MILESTONE_5B.md), final playback section.

### Root cause and investigation

User reported real timestamps but unplayable audio, then confirmed a fresh preview also failed before submission. Diagnostics identified Code/1.143.1, Electron/43.7.7, embedded Chrome/150.0.7871.250 at http://localhost:5173. The recording was audio/webm, with an EBML header, and the browser reported media error 4: PipelineStatus::DEMUXER_ERROR_COULD_NOT_OPEN: FFmpegDemuxer: open context failed. Failure before upload/storage locates this observed problem in the embedded browser's media playback path. It is not evidence that FastAPI or localStorage damaged the recording. The underlying VS Code media-library build was not changed or inspected at DLL level.

The user supplied test_audio/recording.webm and later confirmed a fresh microphone preview plays in standalone Chrome/Edge. PyAV verified mono Opus at 48 kHz. An initial 49,193-byte version decoded for 3.06 seconds (SHA256 04cdd7fbc15dc16921d479517c1f3e1ae2c03b438d376f01fbb8e3195d3d00c5). The file was updated before the real browser run: its tested 55,669-byte version decoded for 3.42 seconds, SHA256 697b027eb9b5144c0e269ee556f6064046e2078de89dede80deeeaa9b0b5dd8b. That version stayed unchanged during the test and matched the subsequent PyAV check. Neither is asserted to be the separate 80,011-byte diagnostic clip. No audio file was converted or modified by the implementation/tests.

Word seeking failed as a consequence of unavailable playback; the actual WhisperX timestamps remained intact. Normal Chrome successfully decoded the supplied file and sought the real returned words. The app now warns VS Code embedded-browser users to open standalone Chrome/Edge; this is a supported-browser resolution, not a claim that VS Code's bundled decoder has been repaired. Related upstream observations: https://github.com/microsoft/vscode/issues/161823 and https://github.com/microsoft/vscode/issues/329811.

### Fixes implemented

- Repaired the missing closing JSX brace in AudioPlayer.jsx. The diagnostic panel introduced this compilation error; the repair command was initially declined, then explicitly authorized. The final production build passed before further refresh instructions.
- New recordings are stored as binary IndexedDB Blobs, keyed by audioId. Existing localStorage attempt metadata and actual analysis response remain compatible. This separately fixes the design limit where base64 audio could exceed localStorage quota below the 10-MiB upload cap; it was not established as the cause of this Media Error 4.
- Binary writes commit before metadata is published. Failed metadata writes/cancelled saves roll back the Blob where storage remains available; save/retrieval failures are explicit. Retry Save reuses successful analysis. Demo reset also clears the binary store.
- Each player retrieves its recording, creates an owned temporary Blob URL, and revokes only its own URL on replacement/unmount. Existing data-URL recordings load without destructive migration. No temporary URLs are stored as permanent references, and no demo recording is substituted.
- All attempt-audio consumers receive audioId, including details, history, patient home/profile, therapist review and dashboard. Word chips wait for loaded metadata; selection is confirmed only after seeking and playback succeed. Missing/corrupt media disables false successful seeking while retaining transcript/timestamps.
- Added original-recording download and MIME/byte/header/browser/decoder diagnostics. Replaced the misleading demo-seed error with actual media/retrieval failure details and embedded-browser guidance.

### Actual verification

- npm run build: PASS, final observed 3.68 seconds.
- npm run lint: exit 0; 0 errors and 86 warnings, same count as before.
- npm test: 63 PASS, 0 FAIL, no uncaught browser errors. Reloaded recording playback passed; 390-px mobile layout has no horizontal overflow.
- npm run test:media: PASS using real Chrome MediaRecorder encoding a controlled AudioContext tone. Preview, byte-identical IndexedDB save, post-analysis playback and details seeking passed. Six full-page reload/navigation checks passed: details, patient history and therapist review for both IndexedDB and legacy data-URL WebM. The analysis response in this deterministic media test is mocked, not a real WhisperX result.
- npm run test:live -- ../test_audio/recording.webm: PASS using the supplied real human WebM and actual FastAPI/model processing. Chrome preview played; one multipart request returned HTTP 200. Exact response persistence, actual-word seeking, manual feedback/Reviewed state, reloaded audio/results and source hash preservation passed.
- User-confirmed manual check: fresh microphone preview plays in standalone Chrome/Edge. Automated capture remains controlled; a complete fresh physical-microphone submission/review session was not personally automated or separately confirmed by the user.
- git diff --check: PASS, with Git line-ending notices only.

Actual live result: expected_text "Ship"; transcript "Keep, keep, keep, keep."; model tiny/en; duration_seconds 3.42; alignment_status completed; no alignment error or unaligned words. Request latency 52.2245 seconds, total UI through local save 52.5423 seconds.

| Actual word | Start seconds | End seconds |
| --- | ---: | ---: |
| Keep, | 1.790 | 2.173 |
| keep, | 2.193 | 2.434 |
| keep, | 2.454 | 2.756 |
| keep. | 2.796 | 3.058 |

The recognized words were never replaced with "Ship" and no timestamp/score was invented. This transcript difference is not a pronunciation diagnosis. Evidence: ignored ipd_frontend/qa/browser-results.json, lint-playback.txt, native-media-before.json, native-media-after.json, native-playback.png, playback-live-results.json and playback-live-result.png.

### Files and intermediate issues

Created ipd_frontend/src/services/recordingStore.js, src/hooks/useRecordingAudio.js, tests/native-media.html, tests/native-media.jsx and tests/run-native.mjs. Modified AudioPlayer.jsx, SpeechAnalysisResults.jsx, attemptService.js, mocks/storage.js, utils/speech.js; patient PracticeSessionPage.jsx, AttemptDetailsPage.jsx, PracticeHistoryPage.jsx and PatientHomePage.jsx; therapist AttemptReviewPage.jsx, PatientProfilePage.jsx, TherapistDashboard.jsx and SettingsPage.jsx; tests/browser.jsx, run-browser.mjs, live.jsx and run-live.mjs; package.json (test:media only), README.md and MILESTONE_5B.md. Paths in this list are under ipd_frontend/. The only project change outside that folder is this authorized PROGRESS.md update.

Intermediate test failures exposed route/media readiness races and over-broad speech mocks intercepting Blob URL reads. Tests now await the actual loaded route/media and mock only /speech/analyze; native media reads remain real. Failed intermediate runs and the JSX build failure are superseded by the passing final results above, not presented as successful runs.

### Remaining limitations and stop

VS Code's embedded host still cannot play the reported WebM; use standalone Chrome/Edge for the demonstration. canPlayType returning "maybe" and successful MediaRecorder encoding/server decoding are not playback guarantees. Local metadata and IndexedDB are isolated by browser/profile/origin: localhost and 127.0.0.1 histories do not automatically transfer. Existing attempts remain in their original profile; download preserves original bytes where available. Lost legacy blob-only references, missing bytes and genuinely damaged recordings cannot be reconstructed from transcript/timestamps. IndexedDB still has quota/eviction limitations and is not secure clinical storage or a backup.

No backend/alignment/source-model/dependency changes, installs, commits, pushes or merges. Existing PyAV was used read-only for inspection. No new backend test/pip-check result is claimed. No embedded codec package or conversion workaround was installed. Stop after this 5B follow-up; any broader codec/runtime support or further milestone remains pending approval.

## Milestone 5B manual Chrome verification update

Date: October 31, 2026 (Asia/Calcutta). Evidence: the user's direct report from a fresh recording in standalone Google Chrome at http://localhost:5173. This updates the earlier preview-only manual confirmation; previous milestone and automated test records are preserved as historical evidence.

| Manual check on the user's fresh recording | Status |
| --- | --- |
| Fresh microphone recording in standalone Chrome | VERIFIED by user |
| Recording preview before submission | VERIFIED by user |
| Submission and speech analysis complete successfully | VERIFIED by user |
| Results display the real recognized transcript | VERIFIED by user |
| Results display real WhisperX word timestamps | VERIFIED by user |
| Recording playback after analysis | VERIFIED by user |
| Timestamp-chip seeking and replay from the selected word | VERIFIED by user: clicking a WhisperX word timestamp seeks and plays the recording |
| Recording playback after refreshing Patient History | PENDING user confirmation; currently being checked |
| Therapist Attempt Review workflow | PENDING user confirmation; currently being checked |

Manual acceptance is partially complete. The user has now explicitly verified timestamp-chip seeking and playback in standalone Google Chrome, in addition to recording preview, successful analysis, real transcript/timestamp display and post-analysis playback. Playback after refreshing Patient History and Therapist Attempt Review remain pending user confirmation. Previous automated refresh/review successes are separate evidence and do not complete those manual checks. No new transcript wording, timestamp values, request latency or other measurements were supplied, so none are invented or copied from another attempt.

### Verified browser and compatibility limitation

Verified browser: standalone Google Chrome at http://localhost:5173, based on the user's manual testing. The user reports that the playback problem remains specific to VS Code's integrated browser in their testing. Record that as a compatibility limitation of the embedded host, not an unresolved playback failure in the verified Chrome workflow. The working recording, persistence, transcription and alignment pipeline is unchanged. This confirmation does not establish successful manual playback after refresh or Therapist Attempt Review; those two checks remain pending.

Documentation-only update: PROGRESS.md and ipd_frontend/MILESTONE_5B.md. No code changes, build/test/inference reruns, dependency/backend changes, commits or pushes. The latest recorded automated results remain the earlier 63 passing browser checks, six passing native media route checks, passing build, and lint with 0 errors/86 warnings. Await the user's remaining manual results; do not start another milestone.

## Milestone 5C - Phase 1: audit and dataset planning COMPLETE

Date: November 5, 2026 (Asia/Calcutta). User requires one phase at a time and approval before datasets, installations or expensive benchmarks. Phase 1 is complete; the overall evaluation milestone is NOT complete. STOP before Phase 2.

### Completed audit and actual findings

Read root README/ARCHITECTURE/progress, backend entry/config/routes/upload limiter and audio/transcription/alignment services, alignment worker, tests/helpers and requirements. Production ASR is multilingual tiny forced to English, CPU/int8, 2 threads, beam 1, VAD on, condition_on_previous_text=False, no target-text prompt; base.en remains comparison only. Installed library defaults include temperature fallback [0,0.2,0.4,0.6,0.8,1] and best_of=5; fixed sample seed is not deterministic-inference proof. Alignment is WAV2VEC2_ASR_BASE_960H CPU float32/two threads, no interpolation, new isolated child per nonempty request. API remains WAV/WebM, 30 seconds/10 MiB, serialized inference.

Hardware snapshot: i5-1135G7, 8 logical CPUs, RAM 8,299,257,856 bytes; available RAM 698,560,512 bytes (666.2 MiB). Free disk 298,591,633,408 bytes (278.09 GiB). Use sequential model runs and recheck resources before any approved benchmark.

Both venvs reference Python 3.11.9 at C:/Users/RAJ/AppData/Local/Programs/Python/Python311/python.exe, absent from the agent's current filesystem view. Both launch attempts failed and py -0p lists no installed Python. No interpreter/venv/package was repaired, installed or recreated. pip check/current backend tests cannot run here; metadata does not prove runtime compatibility. Establish an interpreter location or obtain explicit approval for a specific restoration plan before dependent execution.

Read existing dist-info/METADATA without importing models: backend hub/tokenizers 2.3.0/0.23.3 versus alignment 0.36.2/0.22.2; preserve isolation. JiWER absent from both. Matplotlib 3.11.2 appears in alignment metadata, import not verified. Tiny/base.en weights, wav2vec2 checkpoint and NLTK directory are present, not load-tested. Existing helpers can download implicitly and were NOT run. Source hashes are in evaluation/phase1_audit.json.

### Dataset/source planning

Verified [OpenSLR SLR12](https://www.openslr.org/12/) and CC BY 4.0. The official Hub card lists 2,620 clean/test utterances. HEAD measured official test-clean.tar.gz at 346,663,984 bytes (330.60 MiB) and clean/test/0000.parquet at 350,452,636 bytes (334.22 MiB). Publisher archive MD5: 32fa31d27d2e1cad72775fee3f4849a9. Hub revision: 71cacbfb7e2354c4226d01e70d77d5fca3d04ba1. Exact 100-clip lossless asset access/bytes remain unverified. No dataset audio/archive payload was acquired locally and no references or timestamps selected/annotated.

Proposal: seed 42 deterministic SHA256 ID-priority ranking, first 100 eligible full utterances <=30 s, original references/IDs/revision/hashes preserved, fixed replacement/exclusion ledger. Never filter on predictions or truncate sentences. Prefer verified lossless per-file retrieval; reject lossy preview assets. Full archive fallback requires separate explicit approval. Proposed 100-MiB small-transfer ceiling is a budget, not authorization; present actual selected/reserve sizes before audio acquisition.

Sentence transcripts are not timestamp truth. Recommend an explicitly approved independent 25-clip annotation, preferably two annotators/adjudication blinded to WhisperX. Buckeye and TIMIT are alternatives with unresolved license/access/size gates, not acquired. Automatic alignments alone are not ground truth. Optional articulation design: 5 consented adults x3 words (ship/three/rabbit) x3 repetitions =45 clips, none collected, separate from benchmark, no clinical score.

### Proposed experiments, not results

ASR: same 100 clips for tiny/base.en, application-matched settings, sequential/reused models, JiWER corpus and per-record WER/CER/S-D-I, shared normalization, separate decode/load/inference timing, mean/median/nearest-rank P95, RTF and actual-native-process RAM. Corpus rates use summed counts/reference denominators; no mean-per-file substitution or fake empty prediction for technical failure.

Alignment A uses correct reference text; B uses saved tiny text. Score against genuine word boundaries with monotone lexical matches, repeated-word ambiguity handling, start/end MAE, median errors, 50/100/200-ms rates with explicit coverage/denominators and failed/missing words. Proposed baseline is 25x2 serialized existing IPC calls with align math versus full startup timing; no production expected-text alignment feature or persistent server.

API proposal: 10 nested clips x3 warm-backend requests plus 3 independent cold starts (33 requests), only after Phase 5 approval. Warm backend still launches a fresh alignment child. Report actual full versus transcription-only success, failures, duration, latency/RTF and real simultaneous process-tree memory only if sampled; separate process peaks cannot be added and labeled a measured combined peak. Generate no graph until measured data exist.

### Files and verification

Created evaluation/README.md, PHASE1_PLAN.md, REPORT.md, phase1_audit.json, config/plan.json and .gitignore. REPORT.md is a pending-results scaffold. No executable downloader/benchmark, dataset payload, annotation or result graph was created. Updated only this PROGRESS.md outside evaluation/. Prior milestones are preserved. Application/frontend/alignment sources, environments, packages and model files were not modified; no commits or pushes.

Audit verification: source and installed-metadata inspection, local machine/disk queries, source/license research, HEAD sizes/checksum metadata and artifact validation. No inference or dataset WER/CER/alignment metric. Historical 43 backend/63 browser/six media successes were not rerun or recertified; backend execution is currently blocked and planning documents do not require a new frontend model run. Prior manual 5B refresh/review states were not newly confirmed here.

### Proposed next step and mandatory stop

Request Phase 2 METADATA/SIZE PREFLIGHT ONLY: prepare a reproducible candidate/reference manifest, verify lossless retrieval and exact transfer bytes, and propose runtime/dependency readiness actions. Audio acquisition, Python/package repair/install, annotation and expensive evaluation each still require explicit approval. Every later phase must end with actual results/files/next-step summary and STOP for approval. Milestone 5C remains INCOMPLETE; Phase 2 has not started.

## Milestone 5C - Phase 2 metadata preflight COMPLETE; audio preparation PENDING

Date: November 5, 2026 (Asia/Calcutta). Approved scope was metadata/size preflight and read-only Python/resource investigation only. That scope is complete. No audio dataset, dependency, repair, annotation or model benchmark was executed. Overall Phase 2 dataset preparation and Milestone 5C are not complete. Detailed report: [evaluation/PHASE2_PREFLIGHT.md](evaluation/PHASE2_PREFLIGHT.md).

### Source, labels and prospective download sizes

[OpenSLR LibriSpeech SLR12](https://www.openslr.org/12/) is CC BY 4.0. The OpenSLR Hub mirror clean/test API returned 2,620 unique IDs/references and 40 source speakers; no truncated/missing reference cells. Original transcripts and IDs are preserved, not generated. Hub revision 71cacbfb7e2354c4226d01e70d77d5fca3d04ba1 matched before/after metadata collection and is included in every asset path.

Seed-42 SHA256 ID ranking selected 100 candidates (36 speakers) plus 20 ordered reserves. All 120 versioned FLAC URLs returned HEAD HTTP 200 with positive sizes. Initial candidates:14,230,967 bytes (13.5717 MiB); reserves:2,878,233 bytes; maximum all 120:17,109,200 bytes (16.3166 MiB), excluding HTTP/metadata overhead. Individual sizes range 39,856-529,644 bytes. This avoids the entire 346,663,984-byte test-clean archive or 350,452,636-byte test parquet.

Provider metadata advertises audio/flac; HTTP header media type is binary/octet-stream. No audio GET/Range, header magic read, decode, duration validation or source audio hash was performed. Therefore the 100 are labeled candidates, not yet 100 finalized <=30-second eligible utterances. No word-level ground truth is supplied by this sentence-reference metadata. Candidate/reserve references and HEAD sizes are in evaluation/metadata/librispeech_seed42_manifest.json and its CSV. Complete text inventory SHA256:c1a1546f75ab11077f6d03c1705451a67315b5f0f55c855896023c6382757580. Public expiring signatures were omitted from persisted URLs.

A future approved acquisition can refresh signed row URLs, revalidate ID/reference/revision/size, fetch only the first 100 listed FLACs, and use listed reserves only for documented eligibility replacements. Max 120 files /17,109,200 payload bytes. Preserve originals, verify FLAC/decoded format/duration with existing PyAV, create separate evaluation WAVs and freeze 100 eligible full utterances without truncation or prediction-based filtering. Stop for review on changed provenance/size, budget overrun or insufficient eligible candidates. No full-split fallback or extra file is authorized automatically.

### Corrected Python finding - no environment repair needed

Approved host-level read-only checks found the original C:/Users/RAJ/AppData/Local/Programs/Python/Python311/python.exe. An isolated -B -I -S probe verified Python 3.11.9 64-bit. Both existing venvs launch correctly as 3.11.9, with distinct proper prefixes and that same base_prefix. Both -B -m pip check runs returned No broken requirements found. The Phase 1 missing-Python/launcher results were restricted execution/filesystem-view artifacts, not an actual missing host installation. Historical phase1_audit.json is preserved and superseded on this point by evaluation/phase2_runtime_audit.json.

Additional installed runtimes: Python 3.12.3 and 3.13.1 under Local/Programs/Python; Anaconda Python 3.13.9 at C:/ProgramData/Anaconda3/python.exe. Host py -0p lists 3.11/3.12/3.13 and defaults to 3.13; use explicit existing venv paths for approved work. No need to repair/recreate/retarget either environment. No installs, package changes, activation changes or model imports were performed. Read-only investigation included registry, PATH/launcher, standard install locations, process inventory and version/prefix probes with bytecode writing disabled. pip check does not itself validate actual model inference.

### RAM and safe future evaluation recommendation

Final RAM snapshots:763,707,392 and 926,539,776 available bytes (728.3-883.6 MiB), from 8,299,257,856 total bytes. Free disk:293,795,368,960 bytes. These are volatile observations. Defer timed evaluation until the system is quieter and recheck available RAM; proposed operational target >=2 GiB is not a guarantee of model memory needs. Do not automatically terminate the working application or user programs.

ASR: unchanged CPU/int8, two threads, one worker, one clip/model process at a time; exit tiny benchmark before loading base.en. Alignment-only work: one CPU float32/two-thread child at a time without competing ASR benchmark. Later production API measurements use one tiny backend plus its one alignment child and sequential requests. Preserve all decoding defaults, use existing caches under approved offline preflight, avoid unnecessary simultaneous models, duplicate stacks and persistent alignment servers. None of these benchmarks ran now.

### Files and validation

Created evaluation/scripts/preflight_metadata.mjs; metadata/librispeech_test_clean_inventory.jsonl; metadata/librispeech_seed42_manifest.json; metadata/librispeech_seed42_candidates.csv; metadata/SOURCES.md; phase2_runtime_audit.json; PHASE2_PREFLIGHT.md. Metadata script permits JSON metadata GET and audio HEAD only; it contains no audio downloader. Updated evaluation/README.md, REPORT.md, PHASE1_PLAN.md (historical-correction pointer) and config/plan.json, plus this PROGRESS.md. All earlier milestones/Phase 1 audit observations remain preserved as history.

Validated unique IDs/row counts/reference provenance, deterministic ranks, all HEAD statuses/byte sums, JSON/provenance/approval flags and unchanged protected source hashes. Both environment dependency checks passed read-only. No frontend/backend regression suite was rerun because application code did not change; no new model execution result is claimed. No frontend/backend/alignment source, environment, packages or model files changed, and no commits/pushes/merges.

### Mandatory stop and next approval

Request explicit approval for bounded candidate audio acquisition and non-model decoding/reference verification only: initial 100 files with listed reserves as needed, maximum 120 /17,109,200 FLAC bytes. No environment repair is necessary. Dependency installation, annotation, model evaluation and Phase 3 remain separate unapproved actions. STOP here; no audio acquisition or next phase started.


## Milestone 5C - Phase 2 dataset download and verification COMPLETE

Date: November 5, 2026 (Asia/Calcutta). User explicitly approved the first 100 frozen candidate recordings, with listed reserves only if required and a strict ceiling of 120 audio files /17,109,200 audio payload bytes. Acquisition and verification are COMPLETE. Overall Milestone 5C remains INCOMPLETE. STOP before Phase 3; no benchmark or installation approval is inferred.

### Verified data and actual results

| Check | Actual result |
| --- | --- |
| Candidate recordings / successful audio downloads | 100 /100 |
| Successfully decoded and eligible selected recordings | 100 |
| Audio download failures / decode failures | 0 /0 |
| Reserve downloads / eligibility exclusions | 0 /0 |
| Received and retained original FLAC bytes | 14,230,967 (13.5717 MiB) |
| Maximum authorized | 120 files /17,109,200 bytes; both respected |
| Unused audio-byte allowance | 2,878,233 bytes |
| Total decoded duration | 752.899875 s (12 min 32.90 s) |
| Minimum /median /maximum duration | 2.02 /6.06 /29.14 s |
| Original speakers | 36 |
| Embedded decoded-PCM MD5 matches | 100 /100 |
| Fresh source ID/reference/audio-path pairings verified | 100 /100 |

All original ranks 1-100 were eligible. Seed-42 SHA256 priority and the 2,620-row reference inventory remain fixed; no reserve replacement, prediction filtering or sentence truncation was necessary. Dataset is openslr/librispeech_asr clean/test, revision 71cacbfb7e2354c4226d01e70d77d5fca3d04ba1, CC BY 4.0. Both pre/post repository revision checks matched. Source: [OpenSLR SLR12](https://www.openslr.org/12/); full attribution is in evaluation/metadata/SOURCES.md.

Fresh source metadata matched utterance ID, original reference text, speaker/chapter, filename, row index and pinned audio asset before each GET; HEAD sizes also matched. All files passed native FLAC magic/STREAMINFO and full PyAV 18.1.0 decoding. Sample totals match STREAMINFO; embedded PCM MD5 matches every decoded waveform. Measured duration is decoded samples /sample rate. All are 16 kHz, mono, 16-bit. Original files are unchanged, with SHA256 recorded and independently rechecked. These are locally measured hashes, not claimed publisher per-file checksums.

Reference verification establishes original corpus metadata/ID/audio-path pairing; it does not claim a new human listening/transcription audit. No Whisper/WhisperX inference or fabricated labels/timestamps were used. No independent word-boundary annotations exist yet. No WER/CER, alignment quality, model performance, pronunciation or clinical result is claimed.

### Error encountered and safe continuation

After 55 successful files and 7,839,526 bytes, the metadata endpoint returned HTTP 429. The downloader stopped before the next audio GET. This metadata interruption is recorded separately from the zero audio download/decode failures. Added slower metadata pacing/backoff and explicit checked --resume, verifying retained files, manifest/protected hashes and cumulative byte accounting before continuing at candidate 56. Remaining 45 candidates succeeded; no completed audio was downloaded twice. The final verified manifest retains resume_events and complete per-record provenance. No audio retries, reserves or full archive/parquet fallback were used.

### Files created or modified

Created inside evaluation/: scripts/acquire_audio.mjs, scripts/download_guard.mjs, scripts/test_download_guards.mjs, scripts/verify_flac.py, scripts/check_dataset.mjs; PHASE2_DATASET.md; metadata/librispeech_verified_manifest.json, metadata/librispeech_verified_records.csv; results/dataset_verification.json and results/dataset_integrity_check.json. Downloaded 100 originals under data/librispeech_test_clean/flac/ and persisted its download_ledger.json; that entire data/ tree is Git-ignored. No derived WAV was created.

Updated evaluation/README.md, REPORT.md, config/plan.json, metadata/SOURCES.md and PHASE2_PREFLIGHT.md (historical-stage pointer), plus this PROGRESS.md. Frozen preflight manifest/CSV, metadata inventory, Phase 1 audit and all previous milestone records are preserved. No frontend/backend/alignment source, requirements, virtual environment, model default or cache was changed. No commit, push, merge or repository initialization.

### Exact verification

PASS: full decode of all 100 real FLAC files, embedded PCM checksum match for all 100, positive duration <=30 s, correct original reference/ID mapping, expected source bytes and SHA256. PASS: node evaluation/scripts/test_download_guards.mjs, covering exact file/byte caps, duplicate/unknown/changed-size IDs, truncated/oversized bodies, cumulative resume budgets and invalid saved ledgers. PASS: node evaluation/scripts/check_dataset.mjs, independently checking seed ranking, all source hashes/sizes, references, selected IDs, decode records, totals and no stray audio. Its result is saved in evaluation/results/dataset_integrity_check.json.

PASS: Node syntax checks for acquisition and offline checker; existing Python 3.11 AST syntax check for verify_flac.py. PASS: Git check-ignore resolves an actual downloaded audio path to evaluation/.gitignore's data/ rule. Protected application/configuration and frontend audio-lifecycle hashes match; the eight Phase 1 source/requirements hashes also match. Detailed commands and evidence are in [evaluation/PHASE2_DATASET.md](evaluation/PHASE2_DATASET.md).

No dependency was installed and no environment was repaired/recreated/retargeted. Existing PyAV only was imported for decoding, with bytecode writing disabled; no speech model imports. Earlier Phase 2 preflight pip checks passed in both environments; not rerun for this dataset-only work. Backend/frontend regression suites and application inference were not rerun or recertified. Milestone 5B's Chrome verification and remaining manual refresh/review states are unchanged.

### Remaining limitations, next step and mandatory stop

The production upload API remains WAV/WebM; dataset originals are FLAC. WAV derivation for a future HTTP benchmark is pending that approved phase; no unnecessary duplicate recordings were made now. This is a 100-utterance read-speech subset, not the entire test split, clinical articulation data or word-level ground truth. Model caches/runtime inference readiness has not been exercised by this phase.

A host read-only RAM snapshot during acquisition showed 705,232,896 available bytes (672.56 MiB); volatile and not a model peak-RAM measurement. Recheck on a quieter system before any separately approved benchmark; >=2 GiB free is a proposed operational target, not a guarantee. Preserve CPU/int8, two threads and sequential tiny/base.en model processes; do not automatically terminate the user's application/programs.

Proposed next: Phase 3 same-sample tiny/base.en ASR evaluation and metrics readiness review. JiWER is absent; any metrics environment/dependency setup needs explicit approval. All new downloads, installations, annotation and expensive model/HTTP evaluation remain pending separate authorization. STOP after this completed dataset phase and ask for explicit approval before proceeding.


## Milestone 5C - Phase 3 tiny pilot runner implemented; inference BLOCKED

Date: November 5, 2026 (Asia/Calcutta). Approved scope: implement the reproducible memory-monitored runner and attempt only a small tiny pilot including the longest recording, then STOP. No base.en pilot or full 100-recording evaluation is authorized. Implementation and non-inference verification are COMPLETE; real pilot and numerical ASR evaluation remain PENDING/BLOCKED. Overall Milestone 5C is INCOMPLETE.

### Implemented scope and files

Created evaluation/scripts/asr_pilot.py, asr_pilot_worker.py, pilot_common.py, windows_memory.py and test_asr_pilot.py. Added evaluation/PHASE3_PILOT.md, results/phase3_tiny_pilot.json and results/phase3_pilot_tests.json. Updated evaluation/README.md, REPORT.md, config/plan.json and this PROGRESS.md. Per-run job/gate/summary artifacts and the serialization lock are under ignored evaluation/results/raw/asr_pilot_tiny/. No audio/download/derivative was added. Frozen dataset manifests, audio, seed 42 and previous milestone records are preserved.

Runner permits tiny CPU/int8, two CPU threads, one worker and exactly three deterministic cases only: shortest 1580-141084-0007 (2.02 s), lower middle-duration rank 50 3575-170457-0029 (6.055 s), longest 5105-28241-0015 (29.14 s). No separate warmup; the first process call is labelled. Full/corpus and base.en execution are rejected. It reuses the unchanged TranscriptionService and decoding options, with an evaluation-only FLAC adapter and offline cached-model factory. Reference text never becomes a prompt. No actual model path was loaded in this attempt.

Native system RAM/commit checks run before launch, before expensive worker imports and before model preparation. Required starts:tiny >=1.0 GiB available RAM /2.0 GiB commit headroom; future base.en >=1.25 GiB /2.5 GiB, with execution still disabled. Actual inference PID monitoring avoids the venv-launcher memory trap. Windows Job Objects contain only the runner's child tree; cleanup on interruption does not terminate unrelated applications. RAM/process/paging samples are logged every 0.5 s when executing. Critical operating floors of 256 MiB RAM /512 MiB commit sustained five seconds and stage/total timeouts stop only the owned worker; these do not weaken the initial gates.

Checkpoint JSON is atomically flushed/fsynced/replaced after each completed case. Explicit resume checks source/code hashes, frozen manifest/settings/IDs and completed prefix, then skips saved results. A changed script requires a new approved run. Completed results and separate model-load/inference timings are retained; no automatic full/base run follows. Raw JSONL/logs/checkpoints are Git-ignored. No JiWER, metrics package or environment was installed.

### Actual tiny attempt

Command:backend/.venv/Scripts/python.exe -B evaluation/scripts/asr_pilot.py --model tiny --mode pilot, from a non-profile PowerShell tool process. One actual attempt; no automatic retry.

| Gate/result | Observed |
| --- | --- |
| Available RAM | 704,454,656 bytes =671.82 MiB =0.656 GiB; FAIL against 1.0 GiB |
| Commit headroom | 6,305,185,792 bytes =5.872 GiB; PASS against 2.0 GiB |
| Result | blocked_memory before any inference worker started |
| Model load attempted /model loaded | false /false |
| Inference attempts /completed samples | 0 /0 |
| Actual transcript, load/inference timing, peak worker RAM, pilot paging | UNAVAILABLE; not measured |

Report: [evaluation/results/phase3_tiny_pilot.json](evaluation/results/phase3_tiny_pilot.json). Gate, job and summary artifacts were saved. There was no inference checkpoint because no worker started; absent timings/checkpoints are marked accurately. No placeholder predictions, WER/CER, graph, timing or zero-error claim. Commit headroom does not satisfy the physical-RAM gate by itself. Native PDH availability was tested separately; no paging behavior during inference can be reported from a blocked attempt.

### Verification and issues fixed

Final command:backend/.venv/Scripts/python.exe -B -m unittest discover -s evaluation/scripts -p test_asr_pilot.py -v. Actual result:20 passed, 0 failures/errors; unittest reported 2.520 seconds (test time, not ASR time). Evidence: evaluation/results/phase3_pilot_tests.json. Checks cover gate boundaries/missing counters, tiny-only scope, fixed selection, source/ref/path integrity, atomic interrupted writes, file-lock retries, completed-prefix resume validation, sustained-pressure reset, failed gates preventing imports/spawn/load, unchanged transcription settings, offline construction and accurate blocked-result metadata.

Real native memory/process/paging counter smoke checks passed. Owned-job cleanup was verified on a disposable standard-library child: its actual interpreter handle was alive before job closure and signalled/exited afterward. No model inference was used in tests. Initial tests found a transient Windows checkpoint PermissionError; bounded replacement retries fixed it while preserving previous content. A cleanup assertion incorrectly required nonzero launcher exit status; actual child-handle signalling now verifies termination independently of launcher status. No unrelated process was stopped.

Model initialization, FLAC-to-ASR inference, real per-record results and checkpoint continuation through actual inference remain UNVERIFIED. Source/config/requirements hashes are checked against the prior audit. Existing frontend/backend/alignment code and both environments remain unchanged; backend/frontend regression suites and pip checks were not rerun for evaluation-only work. No pagefile change, model download, dependency installation, commit, push or merge.

### Remaining work and mandatory stop

Free more memory outside the evaluator if practical, then request explicit approval for another gate-checked tiny-only pilot. A standalone PowerShell -NoProfile session is supported; keeping VS Code open still consumes its memory. Do not automatically close user programs or lower the approved gates. A successful tiny pilot must stop for review before any base.en pilot or full 100-recording run. JiWER/scoring setup requires separate approval. No alignment evaluation, HTTP benchmark or next phase started. STOP here; ask before further execution.


## Milestone 5C - Phase 3 base.en pilot preparation COMPLETE; inference PENDING

Date:November 5, 2026 (Asia/Calcutta). User reports tiny's full evaluation complete and approves only preparation/testing of a three-recording base.en pilot, including the longest clip. No pilot or full inference was executed by the assistant during this work. STOP for explicit approval/manual execution after closing VS Code.

### Existing tiny baseline verified and preserved

Read evaluation/results/phase3_tiny_full.json:full_completed, 100 completed recordings, metrics_complete:true. Saved corpus word edits:S141/D21/I29, denominator2,042, WER191/2042 =9.3536%. Character edits:S187/D131/I65, denominator8,994, CER383/8994 =4.2584%. Saved total inference59.190561 s over 752.899875 s audio; aggregate RTF0.0786167762. These are prior measured results, not a rerun or new benchmark. All prior progress sections remain historical and preserved.

Recorded and rechecked 48 protected hashes, including tiny full/pilot JSON/CSV/checkpoints/logs, dataset manifests, unchanged asr_metrics.py/asr_full.py/asr_full_worker.py and application/environment configuration. No protected file changed. Source/model/dataset content was not rewritten. No backend/frontend/alignment or Python-environment modification, download, install, pagefile change, unrelated process termination, commit, push or merge.

### Implemented base.en-only pilot

Same verified 100 LibriSpeech IDs, references, source hashes and original manifest order as completed tiny; the entire ordered sequence and tiny/manifest hashes are frozen in results/phase3_base_en_preparation.json. Pilot cases retain relative manifest order:position1 672-122797-0022 (19.0049375 s), position38 1580-141084-0007 (2.02 s), position74 5105-28241-0015 (29.14 s, longest).

Three measured recordings plus one excluded warmup on the first recording, matching tiny full's procedure:four sequential calls on three unique files. After an explicitly requested resume, warmup repeats and completed measured cases are skipped. No automatic full 100-recording base.en run; the base entry point and contract reject full jobs.

The shared TranscriptionService remains unchanged. Evaluation-only model identity is base.en; CPU/int8, two threads, one worker, English, beam1, VAD, previous-text/word-timestamp flags and remaining library defaults match tiny. The exact existing dependency-free normalization/Levenshtein scorer is reused byte-for-byte, including WER/CER/S-D-I and weighting conventions. No JiWER or additional dependency was installed. Decode/model-load/warmup are separate from inference timing; inference includes the same VAD/RMS and segment consumption; RTF uses the same definitions.

Native gates now select the model explicitly:base.en >=1,342,177,280 available RAM bytes (1.25 GiB) AND >=2,684,354,560 commit-headroom bytes (2.5 GiB), checked before launch/imports/model preparation. No actual base pilot gate or performance observation exists yet. Shared lock, actual-interpreter RAM/private-commit/paging monitoring, owned-child cleanup, timeouts and atomic fsynced per-case checkpoints are preserved. Source/scoring/text/timing tampering is rejected on explicit resume. Base summaries write only separate base paths and cannot overwrite tiny reports.

### Actual cached-model verification

Verified existing base.en snapshot3d3d5dee26484f91867d81cb899cfcf72b96be6c under models/models--Systran--faster-whisper-base.en/snapshots/. Actual sizes:model.bin145,216,508; config.json2,227; tokenizer.json2,128,466; vocabulary.txt422,309 bytes. All four files were SHA256-hashed. Optional preprocessor_config.json is absent; installed faster-whisper's existing defaults handle that, as for tiny. No replacement config or weights were created. Local snapshot loading/local_files_only=True plus child offline flags prevent implicit downloads; changed/missing required cache assets fail.

Cache verification used existing backend Python and standard-library reads only; faster_whisper, ctranslate2, numpy and torch were not imported. Reading/hashing model files is not model initialization. Evidence:results/phase3_base_en_cache_verification.json. Actual base.en inference/model compatibility, memory, transcripts, latency and accuracy remain UNVERIFIED until a separately approved real pilot.

### Files and exact tests

Created evaluation/scripts/asr_base_pilot.py, asr_base_pilot_worker.py and test_asr_base_pilot.py; evaluation/PHASE3_BASE_EN_PILOT.md; evaluation/results/phase3_base_en_preparation.json, phase3_base_en_cache_verification.json, phase3_base_en_preparation_tests.json and phase3_base_en_preservation.json. Modified shared evaluation/scripts/asr_pilot.py, asr_pilot_worker.py and pilot_common.py to pass model identity explicitly while preserving tiny defaults. Updated evaluation/README.md, REPORT.md, config/plan.json and this PROGRESS.md. Existing tiny output files and original full/scoring scripts are unchanged; old run metadata retains its historical code fingerprints.

Actual command:backend/.venv/Scripts/python.exe -B -m unittest discover -s evaluation/scripts -p test_asr_*.py -v. Result:42 tests passed, 0 failures/errors, 6.826 s reported by unittest (test time, not model time). Fourteen new base-specific tests verify exact dataset/pilot order, longest clip, matching settings/scoring/warmup, stronger parent/worker gates, no launch/import/prepare when blocked, optional/required cache files, changed weights, offline model configuration, full-mode rejection, scored checkpoint integrity, interruption/resume and base-only output routing. Existing tiny pilot/full tests and native memory/paging/disposable-child cleanup checks also pass. All speech-processing tests use mocks; no real inference occurred and no fixture result is presented as a model measurement.

No errors occurred in the final test run. Application regression suites and pip checks were not rerun for evaluation-only changes; source/requirements/configuration hashes are unchanged. No base inference JSON/CSV/transcript or graph was generated. Preparation artifacts are explicitly labelled not-run, not completed benchmark results.

### Standalone command and mandatory stop

After explicit approval, close/save VS Code and open standalone PowerShell with powershell.exe -NoProfile. From the project root:

~~~powershell
Set-Location -LiteralPath "C:\Users\RAJ\OneDrive\Desktop\speak-easeAI"
& ".\backend\.venv\Scripts\python.exe" -B ".\evaluation\scripts\asr_base_pilot.py" --model base.en --mode pilot
~~~

Future result:evaluation/results/phase3_base_en_pilot.json. Its run_directory points to ignored evaluation/results/raw/asr_pilot_base_en/<timestamp>_<id>/ for the gate/job, logs, memory samples, checkpoint and CSVs. None of these base inference artifacts exists yet. A failed gate stops without loading the model. A successful three-recording pilot still must STOP for review. Full base.en, dependency changes, alignment evaluation, API benchmarking and subsequent phases require separate approval. STOP here and wait for the user's explicit approval/manual pilot results.


## Milestone 5C - Base.en pilot VERIFIED; full benchmark PREPARED, not executed

Date:November 5, 2026 (Asia/Calcutta). User supplied successful manual pilot checkpoint evaluation/results/raw/asr_pilot_base_en/20261105T170015Z_e4f41fe4 and approved inspection plus conditional full-run implementation/testing only. Verification passed, so the resumable 100-record runner was prepared. No full benchmark or inference was executed during this work. STOP before the manual full command and await explicit approval.

### Actual saved-pilot verification

Public summary, raw summary/checkpoint, inputs, source hashes, scores and timing/RTF arithmetic agree. All three completed with status completed; checkpoint stage completed, summary/checkpoint error absent and stderr0 bytes. Supervisor, pre-import and pre-model-load gates passed the exact base.en thresholds. All 16 recorded memory samples also remained above those thresholds and the operating floors. Sampling does not guarantee absence of every unsampled system-memory dip.

| Pilot measurement | Verified result |
| --- | --- |
| Measured recordings /excluded warmups | 3/3 completed /1 warmup excluded |
| Peak resident working set | 329,900,032 bytes =314.617 MiB |
| Peak private commit | 1,584,185,344 bytes =1.475388 GiB |
| Private commit after inference | 1,481,027,584 bytes =1.379314 GiB |
| Inference per case, in manifest order | 1.2092133 /0.8063155 /2.1421476 s |
| Measured inference total | 4.1576764 s |
| Audio /aggregate RTF | 50.1649375 s /0.0828801272 |
| Model load /supervised worker wall time | 0.4993356 s /8.344 s |
| Minimum sampled RAM /commit headroom | 2.996 GiB /12.173 GiB |

Paging was nonzero:maximum system-wide page inputs6832.992/s and page reads1461.981/s; sampled outputs/writes0. These include file-backed reads, not necessarily pagefile faults. No paging-free or full-corpus speed claim is made. Resident and private commit values are separate, not summed. The pilot settings, versions, same references/source hashes, normalization/edit scorer, timers and RTF match tiny except model identity. Current cached base.en file hashes still match the pilot. Verification evidence:results/phase3_base_pilot_verification.json. Saved data/cache reads were used, not rerun inference.

### Full runner and resumption

Prepared evaluation/scripts/asr_base_full.py and asr_base_full_worker.py using the existing shared sequential/offline worker, monitor and reporting infrastructure. Exactly the same 100 records in original tiny manifest order; no filtering/replacement, reference prompt or dataset change. CPU/int8, two threads, one model/recording at a time. Same excluded first-record warmup per process, byte-identical scorer, decode/load/inference boundaries, native process RAM/private-commit/paging logs, lock/owned-child cleanup and atomic checkpoints.

Both gates remain >=1.25 GiB available RAM AND >=2.5 GiB commit headroom, rechecked before launch/imports/model preparation, including after resumption. Critical operating floors/timeouts remain unchanged. Full-run total ceiling matches tiny:36,000 s. Historical pilot RAM is not proof of future free memory. No Windows/pagefile setting or unrelated process is changed.

The fixed checkpoint directory is evaluation/results/raw/asr_full_base_en/seed42/. The same standalone command resumes its validated completed prefix, rejecting changed model/code/source/scoring/settings/pilot fingerprints. Completed recorded text/metrics/timing are preserved; a new process repeats only its excluded warmup and unfinished measured cases. Technical failures are not fabricated as empty hypotheses. A complete 100-record checkpoint never reloads a model; a missing final JSON can be rebuilt offline from saved state/logs, with unknown supervisor time null.

Requested final/partial result:evaluation/results/phase3_base_full.json, separate from tiny and pilot summaries. Raw job/gate/checkpoint, stdout/stderr, memory JSONL, summary and samples/metrics CSVs stay inside the ignored full-base directory. No real full-base result/benchmark checkpoint exists yet. No dummy score, transcript, timing, graph or model comparison is presented as a full result.

### Files and exact verification

Created scripts/verify_base_pilot.py, asr_base_full.py, asr_base_full_worker.py and test_asr_base_full.py; evaluation/PHASE3_BASE_FULL.md; results/phase3_base_pilot_verification.json, phase3_base_full_preparation.json, phase3_base_full_tests.json and phase3_base_full_preservation.json. Updated shared pilot_common.py's explicit full-base contract and asr_base_pilot.py's isolated reporting target. Updated evaluation README/REPORT/config plan, historical pilot-preparation pointer and this PROGRESS.md. Tiny/scoring/full-run scripts and native monitor are unchanged.

Final actual command:backend/.venv/Scripts/python.exe -B -m unittest discover -s evaluation/scripts -p test_asr_*.py -v. Result:51 passed, 0 failures/errors, 14.069 s reported by unittest (test time, not full-ASR time). Nine new tests cover real saved-pilot validation/error/gate/log rejection, exact full order/settings/proof, stronger memory gates, changed cache/code rejection, completed-job no-reload behavior, mocked interruption/resume through all100, full-only output paths and missing-final-summary recovery without inference. Existing evaluation and live Windows counter/disposable-child cleanup tests pass. Speech-processing tests use mocks only; fixture results are temporary and not benchmark outputs.

The frozen preparation contract verifies installed versions and cached files without importing faster_whisper, ctranslate2, numpy or torch. After tests/preparation, all165 protected hashes matched, including all100 original recordings, completed tiny/pilot outputs and application/environment/scorer/monitor files. Backend/frontend/alignment and Python environments are unchanged. No downloads, installs, real inference, benchmark execution, pagefile change, unrelated process termination, commit, push or merge.

### Standalone full command and mandatory stop

After explicit approval, close/save VS Code and open standalone PowerShell with powershell.exe -NoProfile:

~~~powershell
Set-Location -LiteralPath "C:\Users\RAJ\OneDrive\Desktop\speak-easeAI"
& ".\backend\.venv\Scripts\python.exe" -B ".\evaluation\scripts\asr_base_full.py" --model base.en
~~~

Use the same command to resume an interrupted run without editing files/settings. Full results and the paired 100-record model comparison remain pending actual execution. STOP here and await approval before any full inference. Do not proceed automatically to Phase4 alignment or API benchmarking afterward.


## Milestone 5C - Phase4 WhisperX evaluation preparation COMPLETE; annotations/inference PENDING

Date:November5, 2026 (Asia/Calcutta). User approved preparation/audit/automated tests only; explicitly prohibited real pilot/full inference, downloads and environment changes. That scope is complete. No Phase4 alignment model was imported/loaded or executed, and no real accuracy is claimed. Prior milestone records and Phase3 numerical outputs remain preserved.

### Audit and deterministic data

Audited existing alignment runner and backend adapter, installed WhisperX/torchaudio code, alignment/.venv metadata, evaluation code and locally available data. Python3.11.9; WhisperX3.8.6; torch/torchaudio2.8.0+cpu; NumPy2.4.6; PyAV18.1.0; NLTK3.10.4; transformers4.57.6; hub0.36.2. Read-only alignment/.venv/Scripts/python.exe -B -m pip check passed:No broken requirements found. Cached WAV2VEC2_ASR_BASE_960H file377,664,473 bytes and four English punkt_tab tables are present and SHA256-frozen. No dependency/model/NLTK download, upgrade or reinstall.

Selection:first25 IDs ranked by ascending SHA256 UTF8('speakease-5c|phase4-alignment|42|' + recording_id), ID tie-break, within the existing verified100. No ASR/alignment outcome filtering. Frozen subset retains original references, source hashes/revision/durations;156.635 total audio seconds and457 whitespace-word rows. Pilot picks shortest/middle/longest within25, in fixed subset order:1188-133604-0028 (19.005 s),1580-141084-0043 (2.065 s),3729-6852-0026 (4.69 s). The global100's29.14-s maximum was not forced into this independent subset.

No trusted word timestamps found locally in evaluation/ or test_audio/. LibriSpeech metadata has sentence text only. Existing alignment JSONs are model-generated estimates, not ground truth. Created reference_annotations.csv with all457 start/end cells blank, all457 statuses pending, no verified row. No manual annotation or automatic model-label reference generation occurred. Guide specifies independent blind human passes/adjudication; distinct annotator/reviewer IDs, original word_index/word, valid intervals and final reference freezing. Difficult/mismatched/uncertain words are flagged, never assigned synthetic equal-length times or silently replaced/dropped.

### Metrics and scientific limits

Implemented start/end MAE, pooled combined boundary MAE, pooled median absolute error, inclusive within100/200-ms rates, conservative word alignment coverage, alignment latency/RTF and native resident/private-commit measures. Error units are seconds. Percentages publish both matched-boundary2n and all-verified-reference-boundary2N denominators. Missing/invalid/ambiguous predictions never become timestamps. Zero-duration/nonfinite/out-of-range/nonmonotonic predicted times are invalid. With no scored pairs, MAE/conditional rates are null, not perfect zeros.

Whitespace reference units remain fixed. Matching uses NFKC/casefold, alphanumeric/internal-apostrophe normalization and excludes punctuation-only units. No token splitting/merging, digit expansion or favorable time-based remapping. Exact matches are accepted only if mandatory across EVERY optimal monotone lexical-edit path; ambiguous repeated words remain unscorable. Coverage includes raw/unique/missing/invalid/ambiguous counts; processed-only coverage and all-planned word yield distinguish failures/unattempted clips. Temporal error aggregation pools boundaries/counts rather than averaging recording means.

A clip's boundary accuracy requires every lexical reference row independently verified/adjudicated with finite positive in-range ordered intervals and distinct human IDs. Partial annotation is not cherry-picked. --performance-only disables all boundary-accuracy values even when references exist; it permits readiness timing/memory/text-based coverage only. No25-record accuracy or clinical/pronunciation conclusion is claimed. Supplied correct corpus reference text feeds the evaluation aligner; ASR predictions/expected patient text are never substituted. Production still aligns its recognized transcript unchanged.

### Pilot architecture and memory monitoring

Six new evaluation-only Python files:phase4_common.py, phase4_prepare.py, phase4_metrics.py, phase4_worker.py, phase4_pilot.py and test_phase4.py. Existing application/alignment/ASR/shared monitor code is unmodified. Supervisor uses backend Python standard-library control; each recording gets one fresh isolated alignment/.venv worker calling original alignment/align_recording.py run_alignment once with repetitions1, CPU float32/two threads, interpolate_method=ignore. No WhisperX transcription, extra server, model training or expected-text production feature.

NativeMemory/PDH/PressureGuard/OwnedJob infrastructure is reused. Phase4 start gates:>=2.0 GiB available physical RAM AND >=3.0 GiB commit headroom per child/import and immediately before model load, based conservatively on historical alignment memory, not a guarantee for longer clips. Critical operating floors256 MiB RAM /512 MiB commit for five seconds and300-s per-case timeout. Phase4 lock serializes supervisors; only owned child trees terminate on interruption. No pagefile or unrelated process change.

Existing runner can download missing resources, so the evaluation wrapper freezes source/cache identity and blocks sockets/URL/NLTK/Torch downloads with offline flags. Missing resources fail instead of fetching. Model-load timing excludes wrapper gate/checkpoint overhead; original alignment-call timing is retained. Decode/integrity/import/load, alignment/RTF and launch-to-observed-exit latency are distinct. Half-second polling can add exit-detection delay and misses transient system-memory dips; PDH reads include file-backed files. Actual interpreter peaks, not venv-launcher memory, are used; serialized peaks are maxima, never summed private/resident or separate-process peaks.

Atomic checkpoints preserve completed-case prefix and evidence. Resume validates annotation/source/script/resource identity and recomputes metrics; failed attempts and resource evidence remain visible. Partial/failed model alignment is explicitly distinguished from successful processing. Pilot CLI has no full25 mode. No real pilot_result.json or run exists yet; scratch test directories were removed.

### Files and verification

All new artifacts live under evaluation/results/phase4_whisperx/:subset_manifest.json, reference_annotations.csv, preservation.json, audit.json, pilot_preparation.json, tests.json, PROTOCOL.md and ANNOTATION_GUIDE.md. Updated evaluation README/report/plan status and this PROGRESS.md. Prior Phase3 result files are untouched. Preservation verification covers203 existing result/source/data hashes, including all100 original FLACs; all match.

Final command:backend/.venv/Scripts/python.exe -B -m unittest discover -s evaluation/scripts -p test_phase4.py -v. Actual result:32 passed,0 failures/errors,2.270 s (test time, not alignment time). Synthetic timestamp fixtures test metric arithmetic, threshold inclusion, denominators, missing/invalid times, punctuation/tokenization, ambiguous repeats/edit paths, verified-reference gates and pooled aggregation. Mock execution tests verify correct reference input, one original alignment call, no imports/spawn/load when gated, checkpoint preservation, failure/partial status and resource retention. Native smoke tests use only counters/disposable standard-library child. Printed failed fixture cases deliberately exercise failure handling; they are not real model failures. No accuracy was established by these tests.

Audit/preparation producer asserted torch/whisperx/numpy/faster_whisper absent from imported modules. Alignment dependency check was read-only. No application regression suite rerun was necessary for unchanged application code. No frontend/backend/alignment/environment mutation, audio derivative, download, model load/inference, commit, push or merge.

### Standalone command, pending work and mandatory stop

After explicit approval, close/save VS Code and open standalone PowerShell using powershell.exe -NoProfile:

~~~powershell
Set-Location -LiteralPath "C:\Users\RAJ\OneDrive\Desktop\speak-easeAI"
& ".\backend\.venv\Scripts\python.exe" -B ".\evaluation\scripts\phase4_pilot.py" --performance-only
~~~

This uses existing alignment Python for children and reports latency/memory/coverage only; all boundary accuracy stays unavailable. After independent human verification and approval, omit --performance-only for the three-file accuracy pilot. Future pilot_result.json and runs/<timestamp>_<id>/ remain under phase4_whisperx/. Full25 accuracy requires references and later execution approval. STOP now and ask before any real inference or subsequent phase. Protocol/annotation guide contain complete metric definitions and limits.


## Milestone 5C - Phase 4 pilot verification and full25 preparation (November 6, 2026)

Completed:read-only audit of runs/20261105T183320Z_92738270/ checkpoint, summary, raw/evaluated results, gate states and monitor logs. Pilot3/3, status pilot_completed, correct reference text used,63/63 uniquely aligned words, no unmatched words or invalid timestamps. Each recording has exactly one completed attempt; third recording retains one earlier blocked attempt. Resuming did not repeat the first two or corrupt the prefix. Accuracy remains unavailable, not zero.

| Recording | Alignment s | Alignment RTF | Supervised s | Peak resident GiB | Peak private commit GiB | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1188-133604-0028 | 5.439294 | 0.286203 | 74.796 | 1.728 | 2.339 | 44/44 |
| 1580-141084-0043 | 1.079120 | 0.522576 | 22.735 | 1.120 | 1.730 | 7/7 |
| 3729-6852-0026 | 0.817156 | 0.174234 | 17.875 | 1.135 | 1.710 | 12/12 |

Total model alignment7.335569 s/25.76 s audio, aggregate RTF0.284766. Supervised timings include imports/model loading/checks and are not API latency. All completed admission gates passed2-GiB RAM/3-GiB commit; no critical256-MiB RAM/512-MiB commit floor was crossed and no timeout. Runtime available RAM dipped below2 GiB on the first two cases; startup gates are admission checks. System-wide paging reads/writes occurred, including file-backed/other-process I/O; no paging-free claim.

Original interruption:retained attempt says blocked_memory before model loading, with commit above3 GiB and RAM below2 GiB in its monitor segment. Previous inspection captured the failed gate at1.491905 GiB available RAM and10.840775 GiB commit, model_load_attempted=false. Resuming overwrote that old per-case gate/state; the final logs retain its attempt entry and63-sample history followed by35 resumed samples. Exact old gate values are from the prior inspection, not a surviving complete gate snapshot. No application/model bug was found.

Prepared only:separate phase4_full.py/full_common/full_monitor/full_worker adapters plus phase4_verify.py; original pilot/metrics/common/worker, ASR/shared monitor and production sources are unchanged. Same frozen25 order, cached CPU float32 model/two threads and correct reference transcripts. A shared nonblocking lock serializes pilot/full workers. Every attempt gets a separate folder; blocked/interrupted evidence survives. Atomic checkpoint validation skips completed results, recovers a result committed before checkpoint update, and rejects input/code/annotation drift. No automatic retry or threshold reduction. Full25 will measure all25 afresh after approval; pilot timings are not reused.

Verification:47 tests passed,0 failures/errors,21.997 s. Existing synthetic metric/native smoke tests plus mocked25-record execution, interruption/resume, crash recovery, summary recovery, corruption, gates, timeouts, critical pressure, failure reporting and shared-lock exclusion. No model runtime imports or real inference during preparation. All203 original protected hashes, saved pilot files and457-row annotation CSV verified unchanged. Test evidence:evaluation/results/phase4_whisperx/full_tests.json.

Created evaluation/scripts/phase4_verify.py, phase4_full_common.py, phase4_full_monitor.py, phase4_full_worker.py, phase4_full.py, test_phase4_full.py. New evidence under evaluation/results/phase4_whisperx/:pilot_verification.json, full_tests.json, full_preparation.json, full_preservation.json, FULL_BENCHMARK.md, full25/job.json and empty full25/checkpoint.json. Updated this file, evaluation README/report/config and Phase4 protocol. No frontend/backend/alignment source, environment, dataset, Phase3 result or reference annotation edit.

Pending:explicit approval to execute full25 performance-only benchmark, then review actual results. All boundary accuracy and later phases remain pending independent human annotations/approval. Exact command and output locations are in evaluation/results/phase4_whisperx/FULL_BENCHMARK.md. STOP; zero full-benchmark inference was run during preparation.
