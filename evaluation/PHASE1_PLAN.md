# Milestone 5C - Phase 1 audit and proposed protocol

Historical Phase 1 plan: current Phase 2 metadata availability/size findings and the correction to the restricted-view Python result are documented in PHASE2_PREFLIGHT.md. Preserve the original observations below as history; they are not the current runtime status.

November 5, 2026 (Asia/Calcutta). Phase 1 COMPLETE; Milestone 5C INCOMPLETE. This plan authorizes no dataset acquisition, annotation, installation, environment repair or benchmark. STOP before Phase 2.

## Existing application and readiness

Read README.md, ARCHITECTURE.md, PROGRESS.md, backend entry/config/routes/upload limiter, audio/transcription/alignment services, worker, tests/helpers and requirements. Root overview documents still contain older frontend-pending statements; newer 5B progress and implementation supersede those historical statements. Application source was not changed.

| Component | Audited configuration |
| --- | --- |
| ASR | faster-whisper 1.2.1; multilingual tiny forced to English, not tiny.en |
| Baseline | base.en, comparison only |
| Both ASR runs | CPU/int8, 2 threads, 1 worker, beam_size=1, VAD enabled, word_timestamps=False, condition_on_previous_text=False, no reference prompt |
| Silence | RMS <0.0001 returns empty recognition |
| Other defaults | Installed library uses temperature fallback [0,0.2,0.4,0.6,0.8,1], best_of=5; preserve these unset application defaults and log resolved options. Sample seed does not ensure deterministic inference. |
| Alignment | WhisperX 3.8.6; WAV2VEC2_ASR_BASE_960H; torch/torchaudio 2.8.0+cpu; CPU float32, 2 threads, interpolate_method=ignore |
| API | WAV/WebM; 30 s /10 MiB defaults; multipart overhead 64 KiB; one Uvicorn worker and one concurrent speech request |
| IPC | New alignment child per nonempty request; mono float32/16 kHz .npy plus recognized transcript; JSON; no WhisperX retranscription |

HTTP 200 with alignment failed/partial/skipped is possible; full pipeline success needs more than HTTP success. compare_models.py invokes model-download preparation, and the alignment runner can fetch missing NLTK/weights. Neither helper was run. Cache existence is not a successful model-load test.

Hardware audit: i5-1135G7, 8 logical processors; total RAM 8,299,257,856 bytes (7.73 GiB); available snapshot 698,560,512 bytes (666.2 MiB); free disk 298,591,633,408 bytes (278.09 GiB). Run models sequentially. Propose at least 2 GiB available RAM as a pre-run operational gate, not a performance guarantee; do not close user programs automatically.

Both venvs point to Python 3.11.9 at C:/Users/RAJ/AppData/Local/Programs/Python/Python311/python.exe, absent in the current agent view. Both launchers failed; py -0p lists no Python. pip check and fresh backend execution are unavailable. Read dist-info metadata only; do not present it as successful imports. Do not recreate environments or install/repair Python without approval; first establish an available interpreter or a precise restoration plan.

Backend hub/tokenizers are 2.3.0/0.23.3; alignment versions are 0.36.2/0.22.2. Keep them isolated. JiWER is absent; alignment Matplotlib metadata is 3.11.2 but runtime import is unverified. Proposed evaluation/.venv contains approved JiWER 4.0.0 dependencies only, with model work left in existing environments. Plotting may use existing alignment Matplotlib after validation; Windows counters avoid needing psutil. No environment created now.

## Sources and acquisition decision

Primary corpus: [OpenSLR SLR12](https://www.openslr.org/12/), CC BY 4.0. [OpenSLR Hub metadata](https://huggingface.co/datasets/openslr/librispeech_asr/blob/main/README.md) identifies clean/test as 2,620 utterances. This is audiobook/read speech, not clinical articulation data. Preserve attribution, source IDs and genuine transcripts.

| Acquisition candidate | Verified bytes, November 5 | Status |
| --- | ---: | --- |
| Official test-clean.tar.gz | 346,663,984 (330.60 MiB) | HEAD only; no local payload |
| HF clean/test/0000.parquet | 350,452,636 (334.22 MiB) | HEAD and Hub file metadata agree; no payload |
| Selected 100 lossless clips | Not yet verified | No IDs/assets selected or acquired |

Archive URL: https://openslr.trmal.net/resources/12/test-clean.tar.gz. Publisher MD5: 32fa31d27d2e1cad72775fee3f4849a9, from its md5sum.txt. Hub revision: 71cacbfb7e2354c4226d01e70d77d5fca3d04ba1. Parquet LFS SHA256: 7113aa4c3cf963fb54697145719a7725f984c8836d1c494a554cbb9f1a017df0. These sizes describe entire test splits, not the selected subset.

Preferred Phase 2 preflight: investigate documented [row slices](https://huggingface.co/docs/dataset-viewer/en/rows) / [filters](https://huggingface.co/docs/dataset-viewer/en/filter) for per-utterance lossless assets. Documentation supports metadata access; lossless asset access for this particular revision remains unverified. Reject lossy MP3/Opus preview derivatives for the primary benchmark. Verify revision, source identity and format rather than trusting signed playback URLs. Avoid a config-wide load, which can fetch training splits; a slice expression alone does not prove small transfer.

Before audio acquisition, present exact candidate/reserve IDs, references/provenance, license, lossless URLs and verified Content-Length total. Unknown sizes must be resolved first. A proposed 100-MiB small-transfer ceiling is a budget, not approval. If selective lossless retrieval is not reliable, stop and separately request the official archive download; never silently fall back to full parquet/archive/training data. Verify publisher checksum and record SHA256 after any approved download. No benchmark data has been downloaded locally in Phase 1.

## Sampling and preparation proposal

Seed 42: rank all verified unique utterance IDs by hexadecimal SHA256(UTF8('speakease-5c|42|' + utterance_id)), with ID tie-break, and select the first 100 eligible IDs. This stable pseudorandom ranking avoids PRNG-version dependence. Eligibility: real nonempty reference; valid decode; duration >0 and <=30 s; derived WAV <=10 MiB. The duration constraint matches the unchanged API. Name the benchmark 'LibriSpeech test-clean 100-utterance <=30 s subset'; do not imply complete official test-clean results.

If duration is not in metadata, inspect only after approved acquisition. Use next-ranked replacements, record every exclusion/reason, and stop before exceeding the approved transfer budget. Never filter using predictions, drop an empty recognition result, or truncate sentences to fit the API. Speaker/duration distributions and actual eligible counts are unknown until preparation.

Keep source FLAC when obtained. Verify sample rate/channels/bit depth, then create separate mono 16 kHz PCM WAV evaluation copies. Native PCM16/16 kHz FLAC can be repackaged losslessly; any resampling/quantization must be documented, not assumed equivalent. No production FLAC-support change. Hash original/derived files and verify ID/reference pairing and decoded duration.

Manifest: corpus/config/split/revision/license, utterance/speaker/chapter ID, original reference/provenance, seed/priority/rank, source/derived path/hash/bytes/format/duration, acquisition status and exclusions. Annotation manifest adds ordered word indices/text/bounds, annotator/adjudication protocol and uncertainty. No fictional reference strings or sample IDs are prefilled now.

## ASR protocol - Phase 3 only

Same frozen 100 WAVs for tiny/base.en; sequential fresh processes, one model resident at a time, weights reused within each model run. Evaluation-only factory enforces cached/offline loading without changing recognition settings. Record package/source/model revisions and input hashes. Reference/expected text never becomes a prompt. Preserve all unset faster-whisper defaults, including temperature fallback; fixed sampling is not a promise of bit-identical predictions.

Measure imports/startup/model load separately. Decode each file once with the existing audio service, time decode separately, and time the complete service.transcribe call including VAD/RMS and lazy segment consumption. One separately logged warm-up uses a manifest file and is excluded from scoring/timing aggregates; then score 100 records per model, never a best-of-repetitions selection.

Keep valid empty hypotheses. Technical errors are missing predictions, not fabricated empty transcripts. Require a complete paired 100-record set for the primary comparison; otherwise mark incomplete and identify any successful-only secondary subset/coverage. Do not silently exclude failed records.

Normalization v1, shared by references/hypotheses: Unicode NFKC, lowercase, canonical ASCII apostrophes retained internally, dashes to word separators, other punctuation removed, whitespace collapsed/stripped. Do not expand digits or infer intended words. Preserve raw text. CER removes whitespace from the normalized strings and counts internal apostrophes; other conventions differ. Flag an empty normalized reference instead of silently dropping it.

Use [JiWER](https://jitsi.github.io/jiwer/) process_words/process_characters. Corpus WER = sum(S+D+I)/sum(reference words); corpus CER = sum(character edit counts)/sum(reference characters). Per-record rates are separate; their simple mean is not a corpus rate. Save raw/normalized reference/prediction, word/character counts and edit counts, duration, status/error, decode/load/inference times and memory. WER can exceed 100% with insertions; do not clamp it.

Timing mean/median and nearest-rank P95 use sorted t[ceil(0.95*n)-1]. RTF_i = inference_seconds/audio_seconds; aggregate RTF = sum(inference_seconds)/sum(audio_seconds), distinct from mean per-record RTF. Actual native inference process peak resident working set includes imports/loading; private commit is separate. A lifetime high-water mark is not a per-record peak or weight size. Do not select only the small venv launcher or sum separate process peaks as a simultaneous total.

## Ground truth and alignment A/B - Phase 4 only

Recommended, pending explicit annotation approval: 25 nested clips selected by a frozen secondary seed-42 hash priority with an 'alignment' salt. Two independent annotators listen/view waveforms, mark acoustic word starts/ends under a written convention, adjudicate disagreement and keep uncertain boundaries. Hide WhisperX predictions and freeze references before scoring. One annotator needs explicit acceptance and a stronger limitation. Never use WhisperX/MFA/other automatic boundaries alone as ground truth.

Alternatives: [Buckeye](https://buckeyecorpus.osu.edu/node/1) has manually adjusted time labels, with [lab/class licensing and registration](https://buckeyecorpus.osu.edu/faq). Its current per-file access/size is unverified. [TIMIT LDC93S1](https://catalog.ldc.upenn.edu/LDC93S1) has hand-verified word references but licensed access; price, access and download size are unverified. No registration/download was performed. Do not use unofficial redistributions or machine-aligned LibriSpeech packs as human truth. Sentence transcripts do not supply timestamp references.

A aligns the correct verbatim reference transcript; B aligns the saved tiny transcript, on identical audio. Store/score separately. A is evaluation-only use of the existing aligner, not a new expected-text production API feature. Preserve failures, empty transcripts, partial/missing words and reference uncertainty.

Match normalized tokens monotonically by lexical minimum-edit alignment; only exact equal-token matches with genuine times enter paired error metrics. Log S/D/I/unmatched words. Never select matches by favorable predicted time proximity. Document deterministic edit-path tie-breaking. Current IPC returns unaligned strings without token indices, making some missing repeated words ambiguous: flag these rather than guessing favorable matches. Retain them in all-reference coverage. If needed, a Phase 4 evaluation-only raw-segment adapter may preserve indices, with equivalence checks and no production schema change.

For m unambiguous matched words: start MAE_ms=1000*sum(abs(pred_start-ref_start))/m, end MAE similarly. Median boundary error pools 2m absolute start/end errors. Report <=50/100/200 ms percentages both on scorable matched boundaries and on 2*all reference words. Missing/failed/ambiguous boundaries are not within threshold. Publish denominators and missing counts; m=0 yields unavailable, not zero error.

Full alignment success = completed recordings/attempted recordings; report partial/failed/skipped and any-word yield separately. Measure alignment math from worker diagnostics and full import/load/IPC wall time separately. Proposed baseline: 25x2 serialized existing IPC calls. run_alignment reloads the model and resets Torch thread settings; do not call it repeatedly for different clips assuming free reuse. A warm-model supplemental experiment would require explicit declaration/approval. No persistent worker/server is proposed.

## Actual API benchmark - Phase 5 only

Proposed workload: 10 preselected nested clips x3 warm-backend requests plus 3 independent cold-server first requests =33 total. These counts require explicit expensive-benchmark approval. No --reload, no parallel load, one Uvicorn worker; no best-result retries. Cache weights before timing; downloads are not cold inference. A bounded pilot and actual resource/time budget must precede full approved runs.

Cold = fresh backend process and new alignment child, disk weights cached. Warm = backend tiny reused, but each alignment child still imports/loads anew. Do not call that warm alignment. Measure server startup/readiness separately from HTTP round-trip, and use evaluation-only diagnostics for stage times without adding a production endpoint or changing defaults/timeouts.

Record every attempt's HTTP/status fields, actual transcript/words, audio duration, latency and failure time. Full success requires HTTP 200, actual nonempty speech recognition and completed valid alignment; report transcription-only/partial success separately. Include failure counts/rates and timings, not zeros for failures. Report mean/median/nearest-rank P95, per-request and aggregate RTF with denominators. Three cold runs are descriptive; publish all three rather than confident tail claims.

For RAM, identify actual backend/child PIDs and report per-process working-set peaks separately. A combined process-tree peak must sample contemporaneous sums at a documented interval, with missed-short-child limitations. Never sum separate high-water marks and call it a measured combined peak. Current application diagnostics alone do not give that combined number.

## Optional articulation design

Propose 5 consented adults x3 words (ship, three, rabbit) x3 repetitions =45 clips, with explicit approval before collection. None exist as evaluation data yet. Use anonymous IDs, declared recording conditions and human-verified actual spoken references; prompts alone are not proof of content. Keep the set and short-speech/error analysis separate from LibriSpeech. No clinical diagnosis, pronunciation correctness or unsupported accuracy/F1/precision/recall claim.

## Reporting, verification and phase gates

Future Matplotlib figures use actual CSV/JSON only: tiny/base.en WER; CER; inference latency; alignment boundary errors; threshold coverage (A/B separately); API cold/warm latency. Show sample/word/boundary counts and missing coverage. No placeholder graph resembling measurements. Final mentor report will add objectives, dataset/setup/formulas/protocol, count-backed results, real examples, limitations and reproduction commands after execution.

Meaningful evaluator checks and existing backend tests/pip checks plus frontend build/lint/browser checks are required after implementation. Current Python blocks fresh backend execution. Previous 43 backend/63 browser/six media successes are historical, not rerun or recertified in Phase 1. No application change warrants expensive inference now.

Next recommended scope: Phase 2 METADATA/SIZE PREFLIGHT ONLY. Return a concrete candidate/reference manifest, verified lossless route, exact byte total and runtime/dependency readiness plan. Audio acquisition, Python repair, dependency install and annotation each still require explicit approval. Every later phase ends with actual results/files/next steps and STOP. If access/size/license/runtime conditions fail, stop the dependent action instead of silently substituting data. Phase 1 completion authorizes no Phase 2 work or model evaluation.
