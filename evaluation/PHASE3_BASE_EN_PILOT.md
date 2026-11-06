# Phase 3 - base.en pilot preparation

Historical pilot-preparation handoff. The subsequent real pilot is verified and full-benchmark preparation is documented in [PHASE3_BASE_FULL.md](PHASE3_BASE_FULL.md); pending statements below describe the earlier preparation stage.

Date: November 5, 2026 (Asia/Calcutta). PREPARATION COMPLETE; all 42 automated evaluation tests passed. Actual base.en pilot NOT RUN. STOP for explicit approval before inference. The full base.en evaluation, alignment and API benchmarks remain unapproved. No speech model was loaded in this preparation.

## Frozen tiny baseline and data

The existing phase3_tiny_full.json reports full_completed, 100 completed/scored recordings, corpus WER191/2042 =9.3536%, CER383/8994 =4.2584%, total inference59.190561 s, aggregate RTF0.0786167762. These are saved historical measurements, not new runs. JSON/CSV/checkpoints/logs for tiny are preserved byte-for-byte. The preservation artifact records 48 protected hashes and PASS after preparation; it also covers dataset manifests, the unchanged scoring/full-run scripts and application/environment configuration.

Base.en uses the same verified 100 LibriSpeech IDs, original references and source hashes in exactly the completed tiny manifest order. The full sequence and manifest/tiny-result hashes are frozen in results/phase3_base_en_preparation.json. Validation rejects changed order, settings, sources, scoring or incomplete tiny results. No dataset/reference, tiny result, backend/frontend/alignment source, environment or model file was modified.

## Exact three-recording pilot

| Original manifest position | ID | Duration |
| --- | --- | ---: |
| 1: first record | 672-122797-0022 | 19.0049375 s |
| 38: shortest | 1580-141084-0007 | 2.02 s |
| 74: longest | 5105-28241-0015 | 29.14 s |

The pilot retains the manifest's relative order. There are three measured recordings, with ONE additional excluded warmup call on the first recording, matching tiny full's procedure. Thus four sequential inference calls on three unique recordings, not four distinct files. Every process restart repeats the same excluded warmup; completed measured cases are skipped after validated checkpoint resumption. No automatic expansion to 100 samples occurs.

## Shared method and memory gates

The existing TranscriptionService is reused unchanged through a local cached-model factory. Only model identity differs:base.en versus tiny. Device=cpu, compute_type=int8, cpu_threads=2, num_workers=1, language=en, beam_size=1, VAD=True, condition_on_previous_text=False, word_timestamps=False and all unset library defaults are preserved. Expected/reference text never becomes a model prompt. One model process and one recording are processed at a time.

The asr_metrics.py file is byte-identical to the version fingerprinted by the completed tiny run. Its actual normalization, deterministic Levenshtein tie rules, word/character S/D/I, corpus weighting and CER whitespace rules are reused directly. This is the existing dependency-free scorer, not JiWER. No scorer was replaced or corrected during this preparation and no new dependency is needed.

Decode, imports/cache verification and model load are timed separately. Inference timing wraps the same complete service.transcribe call, including VAD/RMS and lazy segment consumption. Scoring occurs after the inference timer. Warmup is excluded from latency/RTF/error aggregates. RTF is inference/audio duration; aggregate RTF uses summed inference/summed duration, matching tiny. Pilot scores will describe three samples only and cannot be compared as if they were the complete 100-sample baseline.

Base.en requires BOTH available physical RAM >=1,342,177,280 bytes (1.25 GiB) and system commit headroom >=2,684,354,560 bytes (2.5 GiB). Checks occur immediately before worker launch, before expensive worker imports and before model preparation. If either fails, model loading does not proceed. No actual pilot gate decision is reported yet; this preparation did not invoke execution.

The shared 0.5-second monitor records available RAM, system commit usage/headroom, actual interpreter resident/private-commit counters and system-wide paging rates. The owned Windows Job Object safely stops only the evaluation child tree on interruption. The shared OS lock prevents overlapping tiny/base supervisors. Existing critical operating floors (256 MiB RAM /512 MiB commit for five seconds) and stage timeouts remain unchanged; the pilot has a 900-second total ceiling. Hard-read counters also include mapped files and are not proof of pagefile-only thrashing. No pagefile settings or unrelated applications are changed.

## Existing cached model verified without loading

Snapshot: models/models--Systran--faster-whisper-base.en/snapshots/3d3d5dee26484f91867d81cb899cfcf72b96be6c.

| File | Bytes |
| --- | ---: |
| model.bin | 145,216,508 |
| config.json | 2,227 |
| tokenizer.json | 2,128,466 |
| vocabulary.txt | 422,309 |

All four files were read and SHA256-hashed using existing backend Python and the standard library. preprocessor_config.json is absent and optional; installed faster-whisper supplies its existing feature defaults, as with tiny. No replacement file is created. The worker uses the pinned local snapshot and local_files_only=True, with offline flags; missing/changed required assets fail instead of triggering a download. Worker cache metadata must match the prepared job before model initialization.

Evidence: results/phase3_base_en_cache_verification.json. Reading/hashing files is not model initialization. faster_whisper, ctranslate2, numpy and torch were not imported during this real cache verification. No model download, package installation or environment modification occurred. Actual base.en model loading, audio recognition, memory footprint, timing and accuracy remain unverified by this preparation.

## Files, checkpoints and verification

New scripts: asr_base_pilot.py, asr_base_pilot_worker.py, test_asr_base_pilot.py. Shared asr_pilot.py, asr_pilot_worker.py and pilot_common.py now take the model identity explicitly where needed, retaining tiny defaults. The base entry point permits only --model base.en --mode pilot; base full jobs and incompatible resume inputs are rejected. Existing asr_metrics.py, asr_full.py and asr_full_worker.py are unchanged. Completed tiny artifacts retain their historical code fingerprints; new jobs fingerprint the updated shared sources.

Reproducibility and verification artifacts, all under evaluation/results/:

- phase3_base_en_preparation.json: frozen 100-ID order, three cases, cached revision/hashes, matching settings/scoring/source fingerprints and pilot-only scope.
- phase3_base_en_cache_verification.json: actual local cache file sizes/hashes and no-model-loading evidence.
- phase3_base_en_preparation_tests.json:42 passed, 0 failures/errors, 6.826 s reported by unittest; test time is not model time.
- phase3_base_en_preservation.json:48 protected pre-change file hashes, verified unchanged after preparation.

Automated command:

~~~powershell
backend/.venv/Scripts/python.exe -B -m unittest discover -s evaluation/scripts -p test_asr_*.py -v
~~~

The 42 tests include 14 base-specific tests, the existing tiny pilot/full-run tests and live native counter/test-child cleanup checks. New checks cover exact 100-ID order, pilot relative order/longest clip, settings/scoring equivalence, base RAM/commit gates blocking before imports/spawn/load, optional/required cache files, weight-change failure, offline construction, full-run rejection, scored checkpoint tamper rejection, interruption/resume and exclusion of warmup from aggregates. Output-routing tests verify that base summaries cannot overwrite tiny reports. Mock transcription is used for all speech-processing tests; no real inference occurred. Temporary fixture results are removed and are not benchmark measurements.

Executed pilots save an atomic checkpoint after each completed measured recording, with raw/normalized text, word/character edits and separate decode/inference timings. Explicit resume validates IDs, references, metrics, timing, settings and dataset/code hashes before skipping completed results. Old jobs from changed source versions are rejected. JSON flush/fsync/replace and bounded Windows sharing-lock retries are retained.

No errors occurred in the final 42-test run. Existing application regression suites and pip checks were not rerun for evaluation-only changes; application/source hashes and environment configuration are unchanged. No frontend/backend service or inference command was launched.

## Standalone command, output locations and stop

After explicit approval, save/close VS Code, open standalone PowerShell using powershell.exe -NoProfile, then run from the existing project:

~~~powershell
Set-Location -LiteralPath "C:\Users\RAJ\OneDrive\Desktop\speak-easeAI"
& ".\backend\.venv\Scripts\python.exe" -B ".\evaluation\scripts\asr_base_pilot.py" --model base.en --mode pilot
~~~

Future summary: evaluation/results/phase3_base_en_pilot.json. Its run_directory identifies evaluation/results/raw/asr_pilot_base_en/<timestamp>_<id>/, containing job.json, gate.json, checkpoint.json, stdout.log, stderr.log, memory_samples.jsonl, summary.json, samples.csv and metrics.csv as execution reaches the corresponding stages. A blocked prelaunch gate produces no fabricated predictions or model timings. Raw outputs are excluded by evaluation/.gitignore's existing results/raw/ rule.

The summary and raw inference artifacts do not exist yet; preparation artifacts are not pilot results. STOP after this implementation and testing. Await explicit approval/manual pilot execution. Even a successful pilot must be reviewed before any base.en 100-recording run; do not start alignment, API benchmarking or another phase automatically.
