# Phase 2 - verified LibriSpeech evaluation dataset

Date: November 5, 2026 (Asia/Calcutta). COMPLETE: approved bounded download, decode and reference/ID verification. STOP before Phase 3. Milestone 5C as a whole remains incomplete. No ASR, alignment or HTTP benchmark has run.

## Actual results

| Measurement | Verified result |
| --- | ---: |
| Initial candidates processed | 100 |
| Audio GET attempts / successful downloads | 100 / 100 |
| Audio download failures / decode failures | 0 / 0 |
| Successfully decoded, duration-eligible selected recordings | 100 |
| Reserve downloads / eligibility exclusions | 0 / 0 |
| Received and retained original FLAC payload | 14,230,967 bytes (13.5717 MiB) |
| Approved maximum | 120 audio files / 17,109,200 payload bytes |
| Unused payload allowance | 2,878,233 bytes |
| Total selected decoded duration | 752.899875 seconds (12 min 32.90 s) |
| Minimum / median / maximum duration | 2.02 / 6.06 / 29.14 seconds |
| Source speakers | 36 |
| Decoded PCM MD5 matches | 100 / 100 |
| Source metadata ID/reference pairings verified | 100 / 100 |
| Derived WAVs, model runs, new dependencies | 0 / 0 / 0 |

All 100 original candidates were eligible; the final IDs exactly equal frozen ranks 1-100. No truncation, resampling, re-encoding, prediction filtering or reserve substitution occurred. All audio is native FLAC, 16 kHz, mono, signed 16-bit PCM after decoding. Payload accounting excludes HTTP/TLS and metadata overhead. No archive or parquet was downloaded.

## Provenance and reference verification

Dataset: [LibriSpeech / OpenSLR SLR12](https://www.openslr.org/12/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), mirrored by [openslr/librispeech_asr](https://huggingface.co/datasets/openslr/librispeech_asr), config clean, split test. Pinned revision: 71cacbfb7e2354c4226d01e70d77d5fca3d04ba1. The repository revision matched before and after the acquisition.

The 2,620-row inventory and preflight manifest remain unchanged. Seed 42 ranks SHA256(UTF8('speakease-5c|42|' + utterance_id)), hexadecimal ascending, ID tie-break. The offline checker independently recomputed priorities and confirmed the first 100 selected IDs. Inventory SHA256: c1a1546f75ab11077f6d03c1705451a67315b5f0f55c855896023c6382757580. Frozen preflight-manifest SHA256: e4df14f6a40900fbe7caf7ef642974088a8ed576d0d873b6c450b9795df6d05e.

Before each audio GET, fresh public row metadata was checked against the frozen utterance ID, original reference text, speaker/chapter, filename, row index and versioned audio URL; HEAD size had to match. Only that paired asset could be fetched. Original references are preserved verbatim. This verifies corpus labeling/provenance, not an independent human listening audit of every sentence. No reference was generated, corrected using a prediction, or substituted from expected patient text.

Verification checked native fLaC magic, STREAMINFO and every decoded frame using the existing backend PyAV 18.1.0. Decoded sample totals match STREAMINFO; decoded PCM MD5 matches each embedded FLAC checksum. Durations are measured as decoded_samples / sample_rate. Each source file also has a recorded SHA256 and was checked unchanged after decoding. These SHA256 values are locally measured integrity records, not publisher-supplied per-file checksums.

## Storage and reproducible artifacts

Original audio: evaluation/data/librispeech_test_clean/flac/<dataset-id>.flac. Acquisition ledger: evaluation/data/librispeech_test_clean/download_ledger.json. Both are ignored by evaluation/.gitignore's data/ rule. Git check-ignore confirmed the actual audio path is excluded; no repository was initialized and nothing was staged, committed or pushed.

- metadata/librispeech_seed42_manifest.json and candidates.csv: frozen historical preflight, unchanged.
- metadata/librispeech_test_clean_inventory.jsonl: fixed original reference inventory, unchanged.
- metadata/librispeech_verified_manifest.json: final 100 IDs plus per-file provenance, source paths, hashes, decode results and durations.
- metadata/librispeech_verified_records.csv: reviewable per-record results.
- results/dataset_verification.json: aggregate counts, failure/exclusion lists, budget and resume evidence.
- results/dataset_integrity_check.json: independently rerun offline integrity/manifest check, PASS.

## Errors and recovery

After 55 successful downloads, the metadata endpoint returned HTTP 429 despite its short retry allowance. Acquisition stopped before any audio GET for candidate 56; this was a metadata failure, not an audio download/decode failure. The ledger retained all 55 verified files and 7,839,526 received bytes.

Recovery added slower metadata requests/backoff and explicit --resume. Resume checked the prior manifest, source hashes, completed decodes, protected application hashes and cumulative byte ledger before continuing at candidate 56. No completed audio was fetched again. The final manifest preserves the metadata interruption in resume_events. All remaining 45 candidates succeeded. No reserves were needed. The downloader refuses implicit fresh reruns and duplicate audio requests.

## Checks executed

From the project root:

~~~powershell
node --check evaluation/scripts/acquire_audio.mjs
node --check evaluation/scripts/check_dataset.mjs
node evaluation/scripts/test_download_guards.mjs
node evaluation/scripts/check_dataset.mjs
backend/.venv/Scripts/python.exe -B -I -S -c "import ast,pathlib; ast.parse(pathlib.Path('evaluation/scripts/verify_flac.py').read_text()); print('PASS: decode worker Python syntax')"
git --git-dir=ipd_frontend/.git --work-tree=. check-ignore --no-index -v evaluation/data/librispeech_test_clean/flac/672-122797-0022.flac
~~~

All passed. Budget tests cover exact limits, unknown/changed-size IDs, duplicate requests, file/byte overflow, truncated/oversized bodies and corrupt/resumed budgets. The independent checker validates all 100 source SHA256 values, file sizes, decoded sample/duration records, original references, deterministic ordering, final selection, absence of stray audio files and protected source hashes. Real full decoding and PCM checksum comparisons occurred for every recording; these are not mocked successes.

Actual acquisition commands were node evaluation/scripts/acquire_audio.mjs, then the checked --resume continuation after the metadata interruption. Acquisition is finished; do not rerun network commands or fetch the unused reserves without further approval. The offline check commands above need no network or model execution.

## Preserved application, limitations and next step

Changes are confined to evaluation/ and this phase's root PROGRESS.md update. Frontend/backend/alignment source, requirements, model defaults and both environments are unchanged. The eight Phase 1 source/requirements hashes and additional frontend audio-lifecycle/config hashes match. Existing PyAV was used with bytecode writing disabled; no packages, model weights, annotations or runtime repairs were installed. Backend/frontend regression suites were not rerun for data/documentation-only work. Both pip checks passed in the earlier Phase 2 preflight; they were not rerun here.

The production upload API still accepts WAV/WebM, not FLAC. Original FLACs are suitable for future approved direct ASR decoding; WAV derivation for a later HTTP experiment is pending its approved phase. No derivative copies were made now. These are sentence-reference read-speech samples, not independent word-boundary annotations or a clinical articulation dataset. No WER, CER, alignment accuracy, pronunciation score, model speed or peak model RAM is claimed.

A current host snapshot showed 705,232,896 available RAM bytes (672.56 MiB), volatile. No model peak RAM was measured. Before a separately approved benchmark, make the system quieter and recheck memory; the proposed >=2 GiB free target is operational guidance, not a guarantee. Keep CPU/int8, two threads, one clip/model process at a time, and exit tiny before loading base.en. Do not stop user programs automatically.

Proposed next phase: review Phase 3 same-sample tiny/base.en ASR execution and metrics-readiness plan. JiWER is absent and any metrics dependency/environment setup needs explicit approval. All Phase 3-6 runs, installs and independent annotations remain pending. STOP here and request approval before proceeding.
