# Phase 2 - metadata and download-size preflight

Historical preflight snapshot. Subsequent approved audio preparation is complete; current results and limits are in [PHASE2_DATASET.md](PHASE2_DATASET.md). Statements below about pending audio describe the preflight stage.

Date: November 5, 2026 (Asia/Calcutta). APPROVED SCOPE COMPLETE: metadata, HEAD-only size checks and read-only runtime/resource investigation. Audio preparation and Milestone 5C remain incomplete. STOP before any audio download, installation, repair or benchmark.

## Dataset availability and provenance

Primary source: [LibriSpeech, OpenSLR SLR12](https://www.openslr.org/12/), by Vassil Panayotov and colleagues, licensed CC BY 4.0. [OpenSLR Hub mirror](https://huggingface.co/datasets/openslr/librispeech_asr), config clean, split test; revision 71cacbfb7e2354c4226d01e70d77d5fca3d04ba1. Both pre/post metadata revision checks matched. The [row API](https://huggingface.co/docs/dataset-viewer/en/rows) returned 2,620 unique untruncated IDs with nonempty original transcripts and 40 speakers.

The inventory preserves utterance/speaker/chapter IDs, original reference text, source FLAC filename, row index and versioned asset path. Every source filename matches its ID and speaker/chapter metadata. Nothing is generated as reference speech/text. References are sentence-level; no genuine word boundaries are provided. Attribution and exact sources are in [metadata/SOURCES.md](metadata/SOURCES.md).

Provider metadata advertises individual audio/flac resources under the pinned revision. HEAD returned HTTP 200 and positive Content-Length for all 120 candidate/reserve URLs. HTTP Content-Type is binary/octet-stream; suffix/provider type alone is not a byte-level format check. No audio GET or Range request was made. The [viewer asset implementation](https://github.com/huggingface/dataset-viewer/blob/main/libs/libcommon/src/libcommon/viewer_utils/asset.py) supports direct copying when source/target FLAC extensions match, corroborating a lossless route; this is source-level evidence, not proof of this deployment's decoded contents. Validate FLAC magic, sample format/duration and hashes only after acquisition approval.

## Reproducible candidate set and verified prospective sizes

Rank the complete ID inventory by hexadecimal SHA256(UTF8('speakease-5c|42|' + utterance_id)), ascending, ID tie-break. Freeze the first 100 candidates and next 20 reserves. The 100 candidates cover 36 source speakers. This is reproducible pseudo-random sampling, not a speaker-balanced sample or a claimed full-corpus result. All 120 sizes were measured individually using HEAD, with identity content encoding, and summed from the saved records.

| Files | Count | FLAC payload bytes | MiB |
| --- | ---: | ---: | ---: |
| Initial candidates | 100 | 14,230,967 | 13.5717 |
| Optional reserves | 20 | 2,878,233 | 2.7449 |
| Maximum if all reserves needed | 120 | 17,109,200 | 16.3166 |

These are prospective audio payload bytes, excluding HTTP/TLS/metadata overhead. No audio has been downloaded. Individual files range from 39,856 to 529,644 bytes. This avoids the 346,663,984-byte entire official test-clean archive or 350,452,636-byte test parquet (Phase 1 HEAD sizes). No full-split fallback is authorized.

Manifest: [metadata/librispeech_seed42_manifest.json](metadata/librispeech_seed42_manifest.json); reviewable table: [metadata/librispeech_seed42_candidates.csv](metadata/librispeech_seed42_candidates.csv). Complete metadata inventory: metadata/librispeech_test_clean_inventory.jsonl; SHA256 c1a1546f75ab11077f6d03c1705451a67315b5f0f55c855896023c6382757580. The approximately 1.49-MiB local inventory is text metadata only. Expiring URL signatures were omitted from persistent artifacts.

## Proposed approved acquisition procedure - not executed

1. Obtain explicit approval for 100 candidate FLACs, using listed reserves only as needed, maximum 120 files and 17,109,200 audio payload bytes.
2. Refresh signed row-asset URLs. Require the same ID/reference/revision and recheck HEAD size. Stop for review if these change or the approved budget would be exceeded.
3. Download only approved files into ignored evaluation/data/, bounded by declared lengths. Do not fetch full parquet/archive/training data, lossy previews or models. Preserve originals and compute SHA256; ETags are opaque and are not assumed to be checksums.
4. Use existing PyAV, without inference, to verify FLAC/sample format and measured duration. Derive separate WAV copies for the unchanged WAV/WebM API. Record original/derived hashes and conversion details.
5. Retain full utterances with duration >0 and <=30 s and the existing size limits. Never truncate a sentence or use a prediction to choose data. Log exclusions and use the fixed reserve order. If 120 candidates cannot produce 100 eligible recordings, stop and request approval for any additional data.
6. Freeze the final 100-record manifest and verified references, summarize files/counts/bytes, then STOP before Phase 3 approval.

No duration, decode, audio hash or final eligibility is claimed yet. The current 100 are labeled candidates, not a finalized duration-verified evaluation set. No evaluation metric or human timestamp reference was produced.

## Python finding: no recovery or repair needed

The previous Phase 1 missing-executable result was caused by the restricted agent filesystem/execution view. Approved host-level read-only checks found the original base executable at C:/Users/RAJ/AppData/Local/Programs/Python/Python311/python.exe. An isolated -B -I -S probe confirmed CPython 3.11.9, 64 bit. Both existing venvs launch as Python 3.11.9 with their proper sys.prefix and the same base_prefix. Both -B -m pip check runs reported 'No broken requirements found.' No files/packages/configuration in either venv were repaired, recreated or changed. Bytecode writing was disabled during probes.

Also found and version-checked: Python 3.12.3 and 3.13.1 under the user's Local/Programs/Python directory, and Anaconda Python 3.13.9 at C:/ProgramData/Anaconda3/python.exe. The host launcher defaults to 3.13 and lists 3.11/3.12/3.13; use explicit existing venv executables for future approved work. Do not retarget the 3.11 environments to another version.

Read-only methods: launcher/PATH, standard installation directories, Python registry entries, process inventory, version/prefix probes and pip check. The negative restricted-view result is retained in phase1_audit.json as historical observation and explicitly superseded by [phase2_runtime_audit.json](phase2_runtime_audit.json). Model/native inference imports were not tested; pip check validates declared dependencies, not every runtime behavior. No missing runtime installation is recommended now.

## RAM and safe future configuration

Observed total RAM: 8,299,257,856 bytes (7.73 GiB). Final host available-RAM snapshots: 763,707,392 and 926,539,776 bytes (728.3 and 883.6 MiB). Free disk: 293,795,368,960 bytes. Values are volatile. Current free memory is below the proposed 2-GiB pre-benchmark gate; obtain a quieter system and recheck before any approved timed evaluation. That gate is an operational recommendation, not a guarantee of peak memory.

- tiny and base.en: CPU/int8, two threads, one model worker, one clip in memory, one ASR model process at a time. Exit tiny's evaluation process before loading base.en. Preserve the existing VAD/decoding configuration.
- Alignment-only evaluation: one CPU float32/two-thread child at a time, without concurrent ASR benchmarks. The later production API benchmark necessarily combines its one tiny backend with one alignment child, sequential requests and one Uvicorn worker.
- Load cached models only after benchmark approval; no implicit download. Do not automatically stop user programs or the working application, change model defaults, start a persistent alignment server or install a duplicate model stack.
- Avoid benchmarking while the application is actively processing other work. Log available RAM and paging/resource conditions; if pressure persists, defer timing rather than present paging-dominated numbers as stable model speed.

## Files, verification and stop

Created scripts/preflight_metadata.mjs (JSON metadata GET + asset HEAD only), metadata inventory/JSON manifest/CSV, metadata/SOURCES.md, phase2_runtime_audit.json and this report. Updated evaluation README/REPORT/planning status and root PROGRESS.md. No application source or environment edits. Source hashes from Phase 1 remain unchanged. Both pip checks passed; no backend/frontend regression suite or model benchmark was run for this metadata/documentation-only work.

The user approved this preflight only. Dataset audio download, environment modification, installation, annotation and all benchmarks remain unapproved. No repair is currently necessary. Request explicit acquisition/decoding-preparation approval within the concrete byte/file bound above, then STOP. Do not start Phase 3 automatically.
