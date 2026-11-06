# Phase 3 - verified base.en pilot and full benchmark preparation

Date:November 5, 2026 (Asia/Calcutta). Saved real pilot VERIFIED PASS. Full 100-recording base.en runner IMPLEMENTED/TESTED, NOT EXECUTED. Final evaluation/results/phase3_base_full.json is reserved for the actual future run. STOP for explicit approval before full inference. Tiny results, pilot evidence, dataset, application and environments are preserved.

## Actual pilot verification

Inspected evaluation/results/raw/asr_pilot_base_en/20261105T170015Z_e4f41fe4/:job, checkpoint, gate, summary, memory samples, CSVs and stderr. Public phase3_base_en_pilot.json equals raw summary; status pilot_completed, checkpoint stage completed, three correctly ordered completed records, no error and empty stderr. Actual recognized text, source IDs/hashes/references and recomputed scores match checkpoint/summary. No inference was rerun to verify this.

| Verified measurement | Actual result |
| --- | ---: |
| Completed measured recordings | 3/3 |
| Excluded warmup calls | 1 |
| Peak native resident working set | 329,900,032 bytes =314.617 MiB |
| Peak native private commit | 1,584,185,344 bytes =1.475388 GiB |
| Private commit after inference | 1,481,027,584 bytes =1.379314 GiB |
| Measured inference total, excluding warmup | 4.1576764 s |
| Measured audio total | 50.1649375 s |
| Aggregate RTF | 0.0828801272 |
| Model loading | 0.4993356 s |
| Supervised worker wall time | 8.344 s; not entire PowerShell wall time |
| Minimum sampled available RAM | 3,216,945,152 bytes =2.996 GiB |
| Minimum sampled commit headroom | 13,070,635,008 bytes =12.173 GiB |
| Monitor samples /valid paging-rate samples | 16/15 |

| Recording | Inference seconds | RTF |
| --- | ---: | ---: |
| 672-122797-0022 | 1.2092133 | 0.0636263 |
| 1580-141084-0007 | 0.8063155 | 0.3991661 |
| 5105-28241-0015 | 2.1421476 | 0.0735123 |

All three recorded start gates (supervisor, pre-import, pre-model-load) passed the exact base.en 1.25-GiB available-RAM /2.5-GiB commit-headroom requirements. Every logged system sample remained above those start gates and the lower sustained operating floors. No sampled memory violation, timeout, model failure or other recorded error was found. Half-second sampling cannot exclude every brief unsampled system-memory dip. Resident RAM and private commit are separate counters; they are not added together.

Paging was NOT zero:maximum system-wide Pages Input/sec6832.992 and Page Reads/sec1461.981; sampled page outputs/writes were zero. These counters include file-backed reads and do not identify pagefile-only faults. Healthy logged headroom and successful completion do not prove that every read was unrelated to paging. No speed extrapolation to the full corpus or clinical conclusion is made from three recordings.

CPU/int8, two threads, one worker, language, beam/VAD/previous-text flags, unset defaults, installed versions, input sources, scorer and timing/RTF rules match tiny except for model identity. Cached base.en revision/files still match the successful pilot. Independent verification artifact: results/phase3_base_pilot_verification.json, with all gate checks, memory/timing values and source pilot SHA256. The verifier uses saved data and optional cache reads only; it constructs no model.

## Full benchmark implementation

- scripts/asr_base_full.py:manual-only, fixed seed42 directory, frozen same 100 records/order as tiny, cached weights and package-version checks, successful-pilot prerequisite, source/scoring fingerprint checks and validated resume.
- scripts/asr_base_full_worker.py:dedicated full base.en entry point using the existing sequential/offline worker.
- scripts/verify_base_pilot.py:saved-pilot verification and full-job prerequisite.
- scripts/test_asr_base_full.py:verification, memory gates, contracts, completed checkpoint handling, mocked 100-record interruption/resume and output isolation.
- Shared pilot_common.py adds an explicit full base.en contract bound to passing pilot/verification hashes. Shared asr_base_pilot.py reporting accepts a separate full output target; full jobs cannot fall back to the pilot path. Tiny full/scoring scripts and native monitor remain unchanged.

The full run uses CPU/int8, two threads, one model/recording at a time. It performs the same excluded first-record warmup as tiny, then measures all 100 in original manifest order. No transcript/reference becomes a prompt. The byte-identical asr_metrics.py normalization/Levenshtein scorer, corpus WER/CER/S-D-I weighting and RTF definitions are reused; no dependency was installed.

Imports/cache verification, model load, decode, excluded warmup and timed recognition remain distinct. Inference includes the application's RMS/VAD and full lazy-segment consumption. Native RAM/private-commit/paging monitoring, lock/owned-child cleanup, operating floors and stage timeouts are retained. Full-run total timeout matches tiny:36,000 seconds. Both start gates remain 1.25 GiB RAM AND 2.5 GiB commit headroom and are checked afresh before worker launch/imports/model preparation, including after a resume. No current memory sufficiency is inferred from the earlier pilot.

## Resume and outputs

The deterministic checkpoint directory is evaluation/results/raw/asr_full_base_en/seed42/. Each completed measured case is atomically saved with original/predicted/normalized text, source hash, duration, decode/inference timings, RTF, edit counts and native memory. Same-command resume validates source/code/model/settings/pilot fingerprints and existing text/scoring/timing before skipping the completed prefix. No technical failure is replaced by a fake empty hypothesis. A fresh process reloads the model and repeats its excluded warmup; inference/error aggregates retain only measured cases.

An already-complete 100-record checkpoint never reloads a model. If its final JSON is missing/incomplete, the runner can rebuild that summary from the checkpoint and saved logs without inference; unknown supervisor time is null. Existing valid completed results are retained. Old source/model fingerprints are never silently replaced. After code changes, resume fails safely rather than discarding saved results.

Future final/partial summary: evaluation/results/phase3_base_full.json (the user's requested exact path). It records complete/incomplete status, corpus metrics, per-record results, aggregate RTF, model/load diagnostics, recorded process peaks and job provenance. It does not overwrite phase3_tiny_full.json or phase3_base_en_pilot.json.

Under the checkpoint directory:job.json, gate.json, checkpoint.json, separate stdout.log/stderr.log, memory_samples.jsonl, summary.json, samples.csv and metrics.csv. Raw outputs are Git-ignored. Model loading time reflects the last launch; recorded case metrics/inference and saved monitor history cover completed prefixes across restarts. Process peaks use maxima, never sums of separate-process peaks. Full results do not exist yet; preparation/test fixtures are not benchmark results.

## Verification and preserved files

Command:

~~~powershell
backend/.venv/Scripts/python.exe -B -m unittest discover -s evaluation/scripts -p test_asr_*.py -v
~~~

Final actual result:51 tests passed, 0 failures/errors, 14.069 seconds reported by unittest. This is test runtime, not full ASR time. Nine new tests verify the real saved pilot, reject pilot error/gate/log violations, enforce exact full order/settings/proof and memory thresholds, reject changed cache/code, preserve completed results, simulate interruption/resume through all 100 cases, isolate output paths and rebuild a missing final summary without inference. All speech-processing tests use mocks. Live native Windows counter/disposable-child cleanup smoke checks remain separate evidence.

Artifacts:results/phase3_base_full_tests.json, phase3_base_full_preparation.json, phase3_base_full_preservation.json. The preservation ledger covers 165 file hashes, including all 100 original audio files, completed tiny/pilot outputs, scorer/native monitor, application sources and environment configuration. All matched after preparation. No data, tiny result, pilot artifact, application/environment, dependency, pagefile setting or unrelated process changed. No downloads, model load, real ASR inference or full benchmark was executed during this work. No commit/push/merge.

Actual full-100 base.en behavior and final accuracy/performance remain UNVERIFIED until the separately approved run finishes. The successful pilot supports proceeding with the same gates/monitor; it is not a completed 100-record evaluation. Alignment/API benchmarks remain out of scope.

## Standalone command and mandatory stop

After explicit approval, close/save VS Code, open standalone PowerShell with powershell.exe -NoProfile, then run:

~~~powershell
Set-Location -LiteralPath "C:\Users\RAJ\OneDrive\Desktop\speak-easeAI"
& ".\backend\.venv\Scripts\python.exe" -B ".\evaluation\scripts\asr_base_full.py" --model base.en
~~~

Use the identical command to resume an interrupted run without changing files/settings. It rechecks memory before loading. The runner stops if gates fail; it does not terminate unrelated applications or alter Windows memory settings. STOP after preparation; await approval before executing the full benchmark. Do not start Phase 4 or API benchmarking automatically afterward.
