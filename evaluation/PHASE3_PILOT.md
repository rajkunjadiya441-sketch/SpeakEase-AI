# Phase 3 - tiny pilot implementation and cache-check fix

Date: November 5, 2026 (Asia/Calcutta). Current status: evaluation cache-check fix COMPLETE; 24 non-inference tests and real local cache verification PASS. Latest manually launched pilot passed RAM/commit gates but failed in cache validation before model loading. It has not been rerun after this fix. Numerical Phase 3 and Milestone 5C remain INCOMPLETE. STOP pending approval for another tiny-only inference attempt.

## Latest standalone failure and minimal fix

The user manually launched one additional standalone tiny pilot. Its persisted result is [results/phase3_tiny_pilot.json](results/phase3_tiny_pilot.json); raw checkpoint/stderr remain under results/raw/asr_pilot_tiny/20261105T155603Z_f19b627d/. Supervisor gates passed with 1,285,787,648 available RAM bytes (approximately 1.20 GiB) and 9,060,577,280 commit-headroom bytes (approximately 8.44 GiB). The worker's pre-import gate also passed. The final pre-model-load gate was never reached: cached_snapshot failed before importing the ASR runtime.

Actual error:FileNotFoundError for preprocessor_config.json in snapshot d90ca5fe260221311c53c58e660288d3deb8d356. Completed samples:0; model_load_attempted:false; model_loaded:false. The report's 1.516-second supervisor duration, 25,075,712-byte worker peak and two paging samples describe preflight only; they are not model loading/inference performance or model peak RAM. Existing failed-run JSON/checkpoint/logs are preserved without rewriting them as successes.

### Root cause and working-backend comparison

The snapshot path and revision are correct. The actual local files are:

| File | Bytes |
| --- | ---: |
| model.bin | 75,538,270 |
| config.json | 2,249 |
| tokenizer.json | 2,203,239 |
| vocabulary.txt | 459,861 |

preprocessor_config.json is absent. The working backend constructs faster_whisper.WhisperModel for tiny with device=cpu, compute_type=int8, cpu_threads=2, num_workers=1 and the existing models download_root. The evaluation worker already reuses that unchanged TranscriptionService through a local-snapshot factory with local_files_only=True, preserving offline operation and the same recognition settings.

Installed faster_whisper/transcribe.py, WhisperModel._get_feature_kwargs, explicitly returns an empty kwargs dictionary if the optional preprocessor file is absent. FeatureExtractor then supplies its existing defaults:80 Mel features, 16,000-Hz audio, hop length160, 30-second chunks and n_fft400. The backend uses that same behavior. No manual feature overrides, replacement configuration, new model revision or incompatible loading approach are needed.

The evaluation-only cache inventory incorrectly required preprocessor_config.json while hashing files, before WhisperModel was ever constructed. This was an overly strict preflight check, not evidence that the working weights or environment were broken.

### Changes and verification

Only two code files changed:

- scripts/asr_pilot_worker.py:continue requiring model.bin, config.json and tokenizer.json; hash optional preprocessor_config.json and vocabulary.txt when present; record absent optional files. The model-loading factory, offline flags, CPU/int8/two-thread settings, inference options and memory thresholds are unchanged. No dummy preprocessor config is created.
- scripts/test_asr_pilot.py:four regression tests cover absent/present optional config, failure for each missing required file, and the installed loader's default fallback. The last test executes only the installed pure configuration-reader method extracted via AST, without importing faster-whisper, constructing a model or running inference.

Actual final suite:24 tests passed, 0 failures/errors, 2.306 seconds reported by unittest. Command:

~~~powershell
backend/.venv/Scripts/python.exe -B -m unittest discover -s evaluation/scripts -p test_asr_pilot.py -v
~~~

Test evidence: [results/phase3_cache_fix_tests.json](results/phase3_cache_fix_tests.json). Earlier 20-test evidence below remains historical. Native Windows counter and owned disposable-child cleanup tests still pass; no speech model participates in them.

Separately ran the corrected cached_snapshot function against the REAL existing snapshot, reading/hashing all four available files and recording the absent optional config. PASS. ASR runtime modules faster_whisper/ctranslate2/numpy were not imported in this check. Evidence with per-file SHA256/size: [results/phase3_cache_verification.json](results/phase3_cache_verification.json). Reading and hashing model.bin is cache verification, not model initialization or inference. The script used existing backend Python with -B -I -S; no installs, network requests or cache writes.

Protected backend/alignment source and requirements hashes match the prior audit. Backend code, Python environments, cached model files, model configuration, memory gates, base.en/full-run scope and Windows settings are unchanged. No downloads, package/model reinstalls, model load, pilot rerun, transcription or alignment occurred during this fix. No corpus metrics/graphs are generated. Real model initialization and inference after this correction remain UNVERIFIED until a separately approved manual pilot succeeds.

Files changed/created for this repair:the two evaluation code files above, this PHASE3_PILOT.md, results/phase3_cache_verification.json and results/phase3_cache_fix_tests.json. Previous failed pilot artifacts are unchanged. Other project progress/planning files retain their earlier historical snapshots; this section is the current cache-fix handoff.

### Standalone command after approval

Close/save VS Code as desired, open standalone PowerShell with powershell.exe -NoProfile, then run a NEW tiny-only pilot:

~~~powershell
Set-Location -LiteralPath "C:\Users\RAJ\OneDrive\Desktop\speak-easeAI"
& ".\backend\.venv\Scripts\python.exe" -B ".\evaluation\scripts\asr_pilot.py" --model tiny --mode pilot
~~~

A new run records the corrected code hashes; the old failed run's fingerprints must remain historical. The command still checks tiny's 1.0-GiB RAM /2.0-GiB commit gate before model loading, processes at most three pilot cases, and cannot run base.en/full evaluation. Summary remains evaluation/results/phase3_tiny_pilot.json; its run_directory identifies the new raw logs/checkpoints. Another gate failure stops without loading the model. No inference command was executed by the assistant during this fix. STOP and await approval before any inference.

## Initial RAM-blocked attempt (historical)

The user approved implementation and only a small monitored tiny pilot, including the longest recording. CPU/int8, two CPU threads, one worker, one recording at a time, cached weights only. No dependency installation, application/environment changes, pagefile changes or termination of unrelated processes.

The real pilot command was invoked once, from a non-profile PowerShell tool process using the existing backend interpreter. The runner returned blocked_memory before spawning a worker or importing the ASR runtime. No model load was attempted.

| Gate | Required | Observed | Result |
| --- | ---: | ---: | --- |
| Available physical RAM | 1,073,741,824 bytes (1.0 GiB) | 704,454,656 bytes (671.82 MiB /0.656 GiB) | FAIL |
| System commit headroom | 2,147,483,648 bytes (2.0 GiB) | 6,305,185,792 bytes (5.872 GiB) | PASS |

Historical evidence: [initial raw summary](results/raw/asr_pilot_tiny/20261105T153709Z_7671e05f/summary.json). Native observations were taken immediately before the launch decision. No inference worker, prediction, model timing, peak worker RAM or pilot paging observation exists. Those fields are null/unavailable, not zero-valued benchmark measurements. Completed recordings:0. No model/inference failure was observed because inference did not start.

The selected cases remain reproducible:

| Selection | Dataset ID | Verified duration |
| --- | --- | ---: |
| Shortest | 1580-141084-0007 | 2.02 s |
| Lower middle, duration rank 50 of 100 | 3575-170457-0029 | 6.055 s |
| Longest | 5105-28241-0015 | 29.14 s |

Ranking is duration ascending, ID tie-break, within the existing frozen seed-42 subset. Three calls maximum; there is no extra warmup in this pilot. The first call in each process is labelled separately. This is a memory/readiness pilot, not the 100-recording corpus comparison. WER/CER/scoring and comparison graphs have not been produced.

## Implemented execution path

- scripts/asr_pilot.py: standard-library supervisor, nonblocking inter-process lock, gate decision, scoped launch, live monitor, timeouts, result exports and explicit checkpoint resumption. Model/mode guards reject base.en and full/corpus execution before launch.
- scripts/windows_memory.py: native GlobalMemoryStatusEx/GetPerformanceInfo RAM and commit counters, actual inference-process GetProcessMemoryInfo, PDH English paging counters and an owned Windows Job Object.
- scripts/pilot_common.py: frozen input/settings/hash contracts, deterministic selection, audio-path containment, atomic JSON checkpoints and prefix validation.
- scripts/asr_pilot_worker.py: delayed runtime imports, cached local tiny snapshot with recorded revision/file hashes, evaluation-only native FLAC decoding and reuse of the application's unchanged TranscriptionService.
- scripts/test_asr_pilot.py: deterministic contract/gate/checkpoint checks and live Windows counter/owned-child cleanup smoke tests. No speech inference in tests.

Both start gates are enforced: tiny >=1 GiB available RAM /2 GiB commit headroom; future base.en >=1.25 GiB /2.5 GiB. Base.en execution remains disabled. The supervisor checks immediately before spawning; the worker checks before expensive imports and again before model preparation. A failed gate stops without loading the model. Missing required native counters fail closed.

When a worker is allowed, samples are recorded every 0.5 seconds. Current and peak resident RAM/private commit come from the actual interpreter PID, covering imports/model initialization/inference. The virtual-environment launcher is not used as the model memory measurement. The launcher and actual interpreter join the same owned job; closing it stops only that evaluation child tree, including on interruption. Native cleanup was tested with a disposable standard-library sleeping child, not a speech model.

During execution, available RAM <256 MiB or commit headroom <512 MiB continuously for five seconds stops the owned worker. These operating floors do not weaken the higher start gates. Per-stage timeouts are 180 seconds (300 for inference), with a 900-second total ceiling. Paging read/write rates are logged; high reads alone are not treated as proof of pagefile thrashing, because mapped files/DLLs also contribute. No system memory/pagefile tuning or unrelated process termination occurs.

Model construction uses a local snapshot path and local_files_only=True. The child additionally receives offline/telemetry-disabled flags; no model download helper is invoked. The service retains language=en, beam_size=1, VAD=True, condition_on_previous_text=False, word_timestamps=False and unset library defaults. Expected/reference text is never passed as a prompt. The production endpoint still accepts WAV/WebM; an evaluation-only PyAV adapter decodes the verified native FLACs without changing production validation. No WAV copies or new audio downloads are created.

## Checkpoints and outputs

Each invocation has its own ignored directory under evaluation/results/raw/asr_pilot_tiny/. job.json freezes inputs, dataset/source/script hashes and settings. gate.json records the launch decision. An executed worker atomically saves checkpoint.json after every completed case using flush/fsync and replace. Transient Windows sharing errors receive a bounded retry; the previous checkpoint survives failed replacement.

An explicit --resume-run validates settings, source/code hashes, IDs and completed prefix before skipping saved results. A changed script or completed pilot is rejected, so a blocked run from an earlier script version needs a new approved invocation. Resuming partial work loads a fresh model and labels its first new call; it does not pretend that model reuse survived process exit.

An executed pilot also writes memory_samples.jsonl, separate stdout.log/stderr.log, summary.json and samples.csv for real completed cases. A public summary is saved to evaluation/results/phase3_tiny_pilot.json. In the initial RAM-blocked attempt, only job/gate/summary artifacts exist; there was no inference checkpoint to create or preserve. No placeholder prediction CSV or graph was generated. Raw artifacts are Git-ignored by the existing results/raw/ rule.

The blocked summary was corrected to mark its absent checkpoint and unmeasured supervisor/inference timings accurately. Its original job/code fingerprints remain historical; it was not rerun after this reporting-only correction.

## Initial implementation verification, errors and limits (historical)

Final test command:

~~~powershell
backend/.venv/Scripts/python.exe -B -m unittest discover -s evaluation/scripts -p test_asr_pilot.py -v
~~~

Actual final result:20 tests passed, 0 failures/errors, 2.520 seconds reported by unittest. This is test execution time, not ASR processing time. Evidence: results/phase3_pilot_tests.json. Tests cover exact RAM/commit boundaries, base/full-scope rejection, missing counters, reference/hash/path contracts, fixed three-file selection, interrupted atomic writes, transient file locks, saved-result prefix validation, sustained-pressure reset, no subprocess/runtime import when blocked, pre-load rechecking, shared transcription settings and offline model construction. Live native RAM/process/paging checks and actual test-child job termination passed.

Initial testing found a real transient checkpoint replacement PermissionError; bounded retries and a regression test fixed it. A native cleanup test initially assumed termination must return a nonzero launcher exit code; Windows returned zero despite prompt termination. The corrected test captures the actual child process handle, verifies it is alive before job closure and signalled/exited afterward. No inference was used to resolve either issue.

Real cached model initialization, native FLAC-to-ASR inference, per-record transcripts/timing, and checkpoint continuation through actual inference remain UNVERIFIED. The initial attempt was blocked by RAM; the later manual attempt failed during the overly strict cache check described above. No inference was rerun after the fix. Unit/native smoke successes are not evidence of successful speech recognition. JiWER is absent and not installed; no metric implementation/package choice is silently substituted. Existing backend/frontend regression suites were not rerun for evaluation-only changes. Protected application/requirements/config hashes are verified unchanged.

## Next action and mandatory stop

After explicit approval, another gate-checked tiny-only pilot can use a standalone PowerShell -NoProfile session and the existing interpreter. Save/close VS Code yourself if desired; starting an additional shell alone does not release the existing IDE's memory. Do not automatically close user programs.

~~~powershell
backend/.venv/Scripts/python.exe -B evaluation/scripts/asr_pilot.py --model tiny --mode pilot
~~~

This command enforces scope and gates; it is not permission to retry automatically. Do not lower the approved thresholds. Ask for approval before the next tiny attempt; even a successful pilot must STOP for review. Base.en pilot, full 100-recording evaluation, dependencies, WhisperX alignment and API benchmarking remain pending separate approval.
