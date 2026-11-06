# Milestone 5B - Real FastAPI Speech Integration

Current state: implementation and automated verification are complete. Standalone Google Chrome is manually verified for fresh preview, successful analysis, real transcript/timestamp display, post-analysis playback and timestamp-chip seeking/playback. Manual playback after refreshing History and Therapist Attempt Review remain pending. VS Code integrated-browser playback is a compatibility limitation; the working pipeline is unchanged.

Completed October 30, 2026 on frontend-completion; documentation synchronized October 31, 2026 (Asia/Calcutta). Stop at Milestone 5B; no later milestone was started. Implementation edits are inside ipd_frontend/. The user explicitly authorized root PROGRESS.md as the sole documentation exception; this follow-up updates only that file and this handoff. Existing Milestone 5A work remains uncommitted. No backend/alignment files, installed dependencies, Python environments or models were changed; no commit, push or merge was performed.

## Inspection and API contract

Read the 5A handoff, audit, recording hook, speech and attempt services, results, practice and review components. Fetched the live http://127.0.0.1:8000/openapi.json successfully before finalizing response types; saved the actual schema in docs/backend-openapi.json.

| Request input | Mapping |
| --- | --- |
| URL | VITE_API_BASE_URL (default http://127.0.0.1:8000) + /speech/analyze |
| Method | POST |
| file | Original recorded WAV/WebM Blob, filename recording.wav or recording.webm |
| expected_text | Assigned exercise prompt, optional; no recognized-text substitution |
| Headers | Accept: application/json; browser-generated multipart Content-Type |
| Cancellation | AbortController, including navigation/unmount |
| Timeout | VITE_SPEECH_TIMEOUT_MS, default 150000 ms |

The source schema requires status, filename, duration_seconds, expected_text, transcript, model and alignment_status. processing_status, words, language, alignment_error and unaligned_words have schema defaults and may be absent; the client does not add missing fields. Required scalars/enums and present optional structures are validated. Malformed core responses are errors. Missing/unusable individual timestamps preserve the transcript and raw response but are not made seekable; no values are interpolated.

| Actual response field | UI/storage mapping |
| --- | --- |
| transcript | Recognized Speech and attempt.transcript, without replacement by expected text |
| expected_text | Retained verbatim in attempt.analysis; assigned targetText remains separate |
| duration_seconds | Measured playback/attempt duration |
| words[].word/start/end | Exact usable model values in playback chips, highlight and seek |
| alignment_status/error/unaligned_words | Availability notice and partial/failed alignment details |
| status | Empty recognized text is shown as no speech recognized |
| processing_status, filename, model, language | Preserved in full attempt.analysis with every returned response field |

The original Blob is saved as a data URL alongside patientId, assignmentId, exerciseId, targetId, submittedAt and reviewStatus PENDING. A stable attempt ID prevents duplicate saves. Review notes/status use the existing therapist service and survive reload.

## Implemented behavior

The existing Submit for Analysis action now invokes real fetch. A synchronous UI guard and service in-flight lock prevent duplicate submissions. During processing, the exact required message appears: 'Analyzing your speech. This may take around 20 seconds.' An elapsed timer and Cancel Analysis are visible. After 20 seconds, a keep-waiting/cancel message explains that some requests take longer. No demo fallback is used for network, HTTP, timeout or response errors.

Successful analysis is shown before persistence. If localStorage is full, the actual result remains visible and Retry Save reuses it without repeating inference. Cancellation keeps the recording available and explains that backend processing may continue. Navigation aborts outstanding client work. Client checks reject empty, oversized, over-duration and unsupported-format recordings before fetch; server HTTP validation/ASR errors are surfaced safely.

The shared result component presents assigned expected text and actual transcript separately, uses only supplied usable timestamps, and keeps the original recording and transcript after alignment failure. Existing patient history/details and therapist review consume these saved actual results. Manual feedback and Reviewed state remain manual. The separate results preview stays labeled as an example and never enters the real-analysis flow.

## Real end-to-end result

Executed a real browser-to-FastAPI request using ../test_audio/recording_2_test.wav, the existing human recording from Milestone 3. The QA capture fixture supplies this original WAV's bytes through the actual practice flow; physical microphone hardware is controlled, but HTTP, transcription and alignment are real and not mocked. The source file was not modified.

- SHA-256 before/after: 7051b9226017fc51e465ca26885e49e1281f1cb194c8e533c57e8dc998f384b9.
- One request; fields exactly file and expected_text; no manually set multipart Content-Type.
- expected_text sent: 'I have three apples.'
- HTTP 200; status and processing_status completed; model tiny; language en.
- Actual transcript: 'I have three happens.'
- Actual measured duration: 2.986688 seconds.
- alignment_status completed; alignment_error null; unaligned_words empty.

| Word returned | Start (s) | End (s) |
| --- | ---: | ---: |
| I | 0.722 | 0.822 |
| have | 0.862 | 1.002 |
| three | 1.042 | 1.243 |
| happens. | 1.263 | 1.604 |

Observed request latency: 90.4017 seconds. Total UI time through local save: 90.7357 seconds. The processing text and elapsed clock were verified. Exact response persistence, original-audio word seeking, manual therapist feedback, marking Reviewed and reloaded patient playback/results all passed. The isolated QA attempt was att-b294aa22-c960-4e31-b8ef-0eea857bd3f5 with patient p-1, assignment as-live and exercise ex-live; it was not inserted into the user's normal browser profile.

This request was slower than historical backend-only tests. The cause was not isolated; RAM and individual backend processing stages were not measured. The 150-second client timeout handled this run, but does not guarantee all requests finish within it. No second worker/server or backend performance change was introduced.

Evidence generated under ignored qa/: live-results.json, live-result.png and live-stderr.txt. Screenshot review confirmed distinct expected/recognized text, four actual word chips, original recording and persisted manual feedback.

## Tests executed

| Check | Result |
| --- | --- |
| npm run build | Passed; Vite production build |
| npm run lint | Exit 0; 0 errors, 86 warnings (same count as 5A) |
| npm test | 50 passed, 0 failed; prior 36 checks retained |
| Uncaught browser errors | None |
| Reloaded saved audio | Native playback metadata available after reload |
| Mobile width | 390-px viewport and body; no horizontal overflow |
| Real live harness (now npm run test:live) | Passed against running backend; HTTP 200 and real alignment |
| GET /health | HTTP 200 during live verification |
| CORS OPTIONS /speech/analyze | HTTP 200 for both Vite localhost and 127.0.0.1 origins; matching allow-origin |
| git diff --check | Passed (Git line-ending notices only) |

Deterministic coverage includes recorder lifecycle/cleanup, microphone denial, unsupported format, empty/oversized input, duration limit, all 18 routes, existing CRUD/generation/approval/assignment flows, multipart field and header contract, actual-shaped response mapping, loading clock, cancellation, duplicate guard, network failure, HTTP 413/415/422/429/503, malformed JSON, missing required/optional fields, timeout, partial alignment, unaligned words, missing timestamps, alignment failure fallback, native seeking, quota errors, Retry Save without re-analysis, persistence and therapist review. HTTP error scenarios use mocks; the live success is independently verified above.

Rerun with the Vite server on 127.0.0.1:5173: npm run build, npm run lint, npm test. For the real run also keep the existing backend available and run npm run test:live. The real harness reads the existing WAV from ../test_audio and preserves it. Both harnesses use installed Chrome, isolated profiles under ignored qa/, and Node's built-in WebSocket; no dependency installation was needed. The real harness expects completed service availability and may report failures if backend/model startup exceeds timeout.

## Files changed or added in 5B

- .env.example: API origin and 150-second timeout defaults.
- src/services/speechService.js: live client, schema types/validation, multipart, abort, timeout and errors.
- src/services/attemptService.js: full actual response/metadata/audio persistence and stable save ID.
- src/utils/speech.js: safe timestamp filtering.
- src/pages/patient/PracticeSessionPage.jsx: live submission, elapsed/cancel/guards, actual results and quota retry.
- src/components/ui/SpeechAnalysisResults.jsx: real transcript/alignment and unavailable timing states.
- src/components/layout/PatientLayout.jsx and TherapistLayout.jsx: current demo-data/real-speech notices.
- docs/backend-openapi.json: live OpenAPI snapshot.
- tests/browser.jsx: 5B deterministic checks and updated practice response assertions; earlier checks preserved.
- tests/live.html, tests/live.jsx and tests/run-live.mjs: isolated real HTTP/inference UI verification.
- package.json: test:live script; dependencies unchanged.
- README.md and MILESTONE_5B.md: current setup, contract, evidence and limitations.

Other uncommitted frontend files listed by Git belong to the existing 5A work. The existing tests/run-browser.mjs harness, recorder, AudioPlayer, history/details and therapist review are reused. Generated dist/ and qa/ output are ignored.

## Backend issues and remaining limitations

No CORS block was found: both http://127.0.0.1:5173 and http://localhost:5173 were allowed. The real API returned a successful tiny transcript/alignment without backend changes. The observed 90.4-second latency is a demonstration constraint; no cause or RAM measurement is claimed.

Microphone capture/permission lifecycle is covered with browser fixtures, but physical hardware and native permission dialogs still need a manual browser check. Browser support determines WAV/Opus WebM availability. LocalStorage data URLs may exceed quota below the backend upload limit; this is not secure clinical storage. Metadata, assignments, history and feedback are still local demo data with no database or authentication. Clearing local storage removes them.

A client timeout/cancel does not guarantee server-side cancellation. A retry may encounter the backend's busy response, which is surfaced. Failed analysis never falls back to example results. The preview's synthetic audio/example data remain separate. Forced alignment estimates word positions, not pronunciation correctness; expected/recognized differences are not classified as errors. No pronunciation scoring, LLM feedback, Supabase, new AI model or subsequent milestone was implemented.

## Errors encountered and fixes applied

Browser verification initially exposed asynchronous route/control readiness races in the harness. Explicit waits for loaded controls, test-state restoration and adjusted polling corrected them; the final run passed all 50 checks. The initial live harness also queried a stale/uninitialized DOM node before the file input was ready. Explicit page navigation and a ready signal fixed that harness error; no inference success was claimed for the failed launch. The later real request succeeded as recorded above.

Quota failure after successful analysis is handled by retaining the actual result and retrying only the save with a stable attempt ID; its deterministic check confirms no repeated inference. Mocked network, HTTP, timeout, malformed-response and alignment-failure scenarios verify safe errors/retained transcripts without fake fallback. They are intentional failure scenarios, not observed live-model failures. The observed 90.4-second request remains a performance limitation; its cause has not been resolved or measured by stage.

## Status and next recommended milestone

Completed: approved 5B implementation, live OpenAPI inspection, required build/lint/browser verification, one real supported-recording HTTP/inference run, seeking/persistence/manual review and CORS checks. The project-level record is synchronized in [PROGRESS.md](../PROGRESS.md); the earlier 5A handoff is preserved as history.

Partially verified: recorder/permission lifecycle is tested with fixtures and the original human WAV reaches the real API, but physical microphone capture and native permission dialogs remain untested. One real request latency was measured; repeated warm-request performance, backend stage timings and RAM remain unmeasured in 5B. No broader hardware or performance completion claim is made.

Pending approval: proposed Milestone 5C, demonstration readiness and CPU latency profiling. Manually test microphone permission/capture on the actual laptop/browser, measure repeated requests and memory/stage timings, then assess whether persistent alignment model reuse warrants a separately approved worker change. No second server, worker, database, authentication, pronunciation scoring or LLM feedback was implemented.

The October 31 follow-up edits documentation only. It rechecked saved browser/live JSON reports and lint output and preserved the existing historical root log. It did not rerun build, lint, browser tests, inference, backend unit tests or either pip check. The table above records the actual completed 5B runs; backend 43-test/pip-check evidence belongs to Milestone 4, not a new 5B run.

STOP after Milestone 5B; await user approval for further implementation.

## Playback follow-up: October 31, 2026

Status: the syntax error is fixed and the supported standalone Chrome workflow is verified. The VS Code embedded-browser WebM playback limitation remains explicit; no claim is made that its media library was repaired. Root progress is synchronized in ../PROGRESS.md. This section supersedes earlier data-URL storage and 50-test descriptions for the current implementation while preserving those historical results.

### Root cause and scope of evidence

The user's failing environment was Code/1.143.1, Electron/43.7.7 and embedded Chrome/150.0.7871.250. The reported error was media error 4 with PipelineStatus::DEMUXER_ERROR_COULD_NOT_OPEN: FFmpegDemuxer: open context failed. Crucially, the user confirmed fresh playback failed before submission/persistence, then confirmed fresh microphone preview works in standalone Chrome/Edge. The failure is in the embedded browser's media-demux/playback path, with word seeking unavailable because no playable media loaded. FastAPI recognition alone was not used as proof of browser compatibility.

User diagnostics described an 80,011-byte audio/webm Blob with an EBML header and canPlayType "maybe". The file supplied at ../test_audio/recording.webm was a distinct 49,193-byte version during initial inspection: PyAV decoded Opus, mono, 48 kHz, 3.06 seconds; hash 04cdd7fbc15dc16921d479517c1f3e1ae2c03b438d376f01fbb8e3195d3d00c5. It was updated before the live run to 55,669 bytes, 3.42 seconds and hash 697b027eb9b5144c0e269ee556f6064046e2078de89dede80deeeaa9b0b5dd8b. The latter was unchanged throughout the browser test and matched subsequent PyAV inspection. Do not equate these different clips or claim the separate 80,011-byte saved attempt was recovered in VS Code. The implementation/test did not alter or convert any original recording.

Related VS Code upstream reports corroborate embedded media limitations: https://github.com/microsoft/vscode/issues/161823 and https://github.com/microsoft/vscode/issues/329811. The exact bundled DLL/build flags were not inspected. A normal installed Chrome (headless 156 in automated tests) played the real supplied bytes. The app now detects the Code/Electron environment and advises standalone Chrome/Edge before practice and in WebM failure messages. Browser histories are separate; switching browser is not a metadata migration.

### Implementation and lifecycle

1. The existing MediaRecorder hook still captures chunks into the original Blob and releases microphone/preview resources. No encoder, backend decoder, transcription model or alignment logic was changed.
2. The real speech service still uploads that Blob in multipart file, plus optional expected_text, without manual multipart Content-Type. Actual response fields/timestamps are retained.
3. attemptService commits the original binary Blob to IndexedDB database adaptsynthetix_recordings_v1 / recordings, keyed by attempt audioId, before writing existing localStorage metadata. New metadata stores audioId, audioMimeType and audioSize, with audioBlobUrl null. Analysis, IDs, times and review schema remain compatible. No permanent object URL or base64 recording is written for new attempts.
4. Metadata quota/cancellation after a committed Blob rolls back the binary entry if storage allows; binary-write failures publish no attempt. Reads and save failures are explicit. Retry Save does not rerun analysis. Settings reset clears recordings too.
5. useRecordingAudio retrieves the binary and creates one player-owned temporary object URL. It also reconstructs existing legacy data-URL audio without overwriting it and resolves capture Blob URLs for diagnostics. Each owned URL is revoked on replacement/unmount, with cancelled late reads ignored. Each patient/therapist consumer passes audioId.
6. AudioPlayer enables chips only after native metadata loading, awaits actual seeking/playback, and highlights only successful operations. Failed play, missing storage or corrupt media leaves no false selected word and preserves the transcript/timestamps. Playback errors do not claim the recording is a demo seed.
7. The original-recording download and expandable format details expose actual MIME, size, first 16 bytes, browser support indication, native decoder message, user agent and origin. This permits inspection even when decoding fails. No demo audio or timestamps substitute for missing/unsupported recordings.

IndexedDB was added because 10-MiB recordings cannot reliably fit base64 localStorage. That was a verified architectural limit, not the proven cause of the reported pre-submission Media Error 4. Changing persistence alone did not resolve the embedded decoder and was not reported as doing so.

### Final verification

| Command/check | Actual result |
| --- | --- |
| npm run build | PASS, final 3.68 s |
| npm run lint | Exit 0, 0 errors, 86 warnings |
| npm test | 63 passed, 0 failed; prior 50 integration checks retained/adapted |
| Reloaded native recording in browser suite | PASS |
| Uncaught browser errors | None |
| 390-px mobile layout | No horizontal overflow |
| npm run test:media | PASS; native WebM encoder, preview, byte-identical IndexedDB save and post-save seeking |
| Full-page media checks | Six passed: details, history and therapist review for both IndexedDB and legacy WebM |
| npm run test:live -- ../test_audio/recording.webm | PASS; real human WebM, real HTTP/model response, preview and actual word seeking |
| Manual physical microphone preview | User confirmed fresh preview works in standalone Chrome/Edge |
| git diff --check | PASS, line-ending notices only |

The deterministic browser checks include 10-MiB binary storage with small JSON metadata, binary-write and metadata-quota failure, rollback, retrieval failure, blocked IndexedDB, cancelled save, missing/corrupt media, failed playback without false selection, legacy playback, owned-URL cleanup and embedded-browser guidance. Speech mocks now intercept only the speech endpoint so Blob reads remain real. The separate native MediaRecorder test uses an AudioContext test tone and mocked analysis; it is not a claim of real ASR on the tone or a physical microphone capture.

The live run used the exact supplied human WebM in an isolated Chrome profile. Controlled capture supplied its unchanged bytes, while the real speech endpoint/model pipeline ran. Preview played before submission. One request returned HTTP 200; expected_text Ship; actual transcript 'Keep, keep, keep, keep.'; tiny/en; duration_seconds 3.42; alignment completed, error null, no unaligned words. Request 52.2245 s; total through local save 52.5423 s. Actual word chips:

| Word | Start (s) | End (s) |
| --- | ---: | ---: |
| Keep, | 1.790 | 2.173 |
| keep, | 2.193 | 2.434 |
| keep, | 2.454 | 2.756 |
| keep. | 2.796 | 3.058 |

Actual-word seeking, exact response persistence, therapist feedback, Reviewed status and full-reload audio/results passed. Screenshot inspected after reload. No transcript correction, invented alignment or pronunciation inference. A complete fresh physical-microphone submission/review session was not automated; the user's manual confirmation is specifically fresh preview playback. The real file request and synthetic native encoder checks provide separate evidence.

Reports/screenshots: ignored qa/browser-results.json, qa/lint-playback.txt, qa/native-media-before.json, qa/native-media-after.json, qa/native-playback.png, qa/playback-live-results.json and qa/playback-live-result.png. The original October 30 live-results.json remains historical. Reproduce with Vite on 127.0.0.1:5173: npm run build; npm run lint; npm test; npm run test:media. The live file test also requires the already-running backend.

### Errors during this follow-up

The new diagnostic panel initially omitted the JSX group's closing brace, producing Expected '}' but found '{' at AudioPlayer.jsx:73. A repair write was declined, then the user explicitly approved it. The brace was corrected, npm run build passed before asking for another refresh, and final build/tests passed. No failed build is counted as successful.

Initial regression runs also revealed asynchronous route/control/media readiness assumptions. Tests now wait for the actual route and loaded/ready controls. Broad mocked fetch functions were counting/intercepting Blob reads as speech calls; mocks were restricted to /speech/analyze. This corrected the tests without masking real native-media reads or error paths. All final 63 checks passed.

### Files created/modified for playback

Created:
- src/services/recordingStore.js
- src/hooks/useRecordingAudio.js
- tests/native-media.html
- tests/native-media.jsx
- tests/run-native.mjs

Modified:
- src/components/ui/AudioPlayer.jsx; src/components/ui/SpeechAnalysisResults.jsx
- src/services/attemptService.js; src/mocks/storage.js; src/utils/speech.js
- src/pages/patient/PracticeSessionPage.jsx; AttemptDetailsPage.jsx; PracticeHistoryPage.jsx; PatientHomePage.jsx
- src/pages/therapist/AttemptReviewPage.jsx; PatientProfilePage.jsx; TherapistDashboard.jsx; SettingsPage.jsx
- tests/browser.jsx; tests/run-browser.mjs; tests/live.jsx; tests/run-live.mjs
- package.json (test:media script; installed dependencies unchanged)
- README.md; MILESTONE_5B.md; authorized root ../PROGRESS.md

### Remaining boundaries

Use standalone Chrome/Edge. VS Code embedded playback of this WebM remains unsupported; no codec replacement, second server, conversion dependency or runtime change was installed. canPlayType "maybe" is not a decoding guarantee. Existing records remain local to the original browser/profile and exact origin; they are not automatically moved when switching browsers or between localhost and 127.0.0.1. Legacy data URLs remain supported; lost temporary URLs or missing/corrupted bytes cannot be reconstructed from timestamps.

IndexedDB/localStorage remain demo browser storage with quota, eviction and clearing risks, not secure clinical storage or backup. Processing latency remains variable (52.225 s in this run). No backend/alignment/package/model/source-audio changes or new backend test/pip-check claims. No commits, pushes or merges. Stop after this 5B fix; no later milestone or scoring/LLM/database work started.

## Manual Chrome verification update

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

Documentation-only update: root ../PROGRESS.md and this handoff. No code changes, build/test/inference reruns, dependency/backend changes, commits or pushes. The latest recorded automated results remain the earlier 63 passing browser checks, six passing native media route checks, passing build, and lint with 0 errors/86 warnings. Await the user's remaining manual results; do not start another milestone.
