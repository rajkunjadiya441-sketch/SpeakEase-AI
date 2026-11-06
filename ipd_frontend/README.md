# Adapt Synthetix - SpeakEase AI Frontend

Milestone 5B is complete (October 30, 2026) on branch frontend-completion. Patient practice now sends real recordings to the existing FastAPI speech endpoint and displays its actual transcript and word alignment. Patient management, assignments, history and manual therapist feedback still use the existing browser demo storage. The October 31 playback follow-up stores new audio Blobs in IndexedDB and is verified in standalone Chrome; see the final section of MILESTONE_5B.md.

See [MILESTONE_5B.md](MILESTONE_5B.md) for the API mapping, changed files, test results and limitations. [AUDIT.md](AUDIT.md) and [MILESTONE_5A.md](MILESTONE_5A.md) describe the earlier frontend audit and historical offline milestone.

## Run

Use the existing installed dependencies. From ipd_frontend:

~~~powershell
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
~~~

Use standalone Chrome or Edge for recording/playback. VS Code's embedded browser can capture WebM that its media player cannot open; the app now warns about this. Histories are separate per browser/profile and exact origin.

Keep the existing FastAPI backend running on http://127.0.0.1:8000. Open http://127.0.0.1:5173/patient/practice, choose an assigned exercise, record, stop, preview, then Submit for Analysis. Patient history and /therapist/attempts show saved recordings, real results and manual reviews.

The defaults are documented in [.env.example](.env.example). To override them, use .env.local (ignored by Git), then restart Vite:

~~~dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_SPEECH_TIMEOUT_MS=150000
~~~

Vite configuration is public client configuration. Do not put secrets in VITE_ variables. The speech service always calls the real API; unrelated local CRUD services and the separate labeled results preview remain demo features.

## Speech request and results

- POST /speech/analyze uses FormData with file containing the original WAV/WebM Blob and optional expected_text containing the assigned prompt. The browser sets the multipart Content-Type boundary.
- The live /openapi.json was inspected before implementation; its snapshot is [docs/backend-openapi.json](docs/backend-openapi.json). Expected text stays separate from the returned transcript.
- Processing shows the required analysis message, elapsed timer, cancellation and duplicate-submission protection. The default timeout is 150 seconds. Cancellation stops the browser request; server work may continue.
- Core response fields are validated. Optional fields are not synthesized. Only actual usable word start/end values become clickable playback positions; missing values are never interpolated. A failed/partial alignment preserves the transcript and original recording.
- The full actual response, patient/assignment/exercise IDs, submission time and review status stay in localStorage metadata. Original audio Blobs are committed to IndexedDB and referenced by audioId through the existing attempt service. Legacy data-URL recordings remain readable. Players create disposable playback URLs and revoke only URLs they own. After a quota error, results remain visible and Retry Save retries storage without another analysis request.
- Therapist review reuses the same results/audio component and supports manual feedback and Reviewed status. No pronunciation score, diagnosis or LLM feedback is generated. Alignment positions do not verify pronunciation, and transcription differences do not establish mispronunciation.

## Verification

With the Vite server running on 127.0.0.1:5173, run:

~~~powershell
npm run build
npm run lint
npm test
npm run test:media
# Optional: calls the running real backend with the existing human recording
npm run test:live
~~~

Build passed. Lint exited successfully with 0 errors and 86 warnings. All 63 current browser checks passed, preserving/adapting the previous integration checks. Six additional native WebM navigation/reload checks passed for IndexedDB and legacy audio. Saved audio playback after reload passed; the mobile layout had no horizontal overflow at 390 px.

The browser harness requires installed Chrome at its standard Windows path and Node with built-in WebSocket support. It uses an isolated profile under ignored qa/, controlled microphone/HTTP fixtures for deterministic tests, and no additional dependencies. Reports and screenshots are written under qa/.

The initial October 30 live harness supplies the unchanged ../test_audio/recording_2_test.wav through a controlled capture fixture, then uses the actual practice UI, real browser HTTP request and real FastAPI inference. It does not test a physical microphone. The executed request returned HTTP 200, tiny transcript 'I have three happens.', and completed alignment of all four words. Request latency was 90.402 seconds, with results saved in about 90.736 seconds. Seeking, manual review and persistence after reload passed. See the milestone report for actual timestamps and evidence.

The October 31 real WebM check also passed: npm run test:live -- ../test_audio/recording.webm. Preview, actual-word seeking, review and reload worked in Chrome; the real tiny transcript was 'Keep, keep, keep, keep.' with completed alignment. Request latency was 52.225 seconds. The user separately confirmed a fresh microphone preview works in Chrome/Edge. Physical capture in the automated harness is controlled; no complete fresh physical-microphone analysis/review session is claimed.

CORS preflight succeeded for both http://127.0.0.1:5173 and http://localhost:5173. If using another origin, the existing backend must permit that exact origin. This milestone changed no backend configuration.

## Demo boundaries

- LocalStorage metadata and IndexedDB audio are demonstration storage, not secure clinical record storage or a backup. Browser quotas/eviction still apply. Clearing browser storage removes recordings/history/feedback; demo reset clears both stores. Existing legacy base64 recordings may still fill localStorage and produce a metadata save error.
- Browser recording supports WAV/Opus WebM only where MediaRecorder supports them. MP4/OGG fallback is blocked. Recording stops just before 30 seconds; the server performs authoritative audio validation. The user confirmed fresh microphone preview in Chrome/Edge; full physical-microphone submission/review and other browsers still need manual checks.
- The required processing message says 'around 20 seconds'; the observed real request took 90.4 seconds. Longer-running processing shows a keep-waiting/cancel notice, and the configured timeout is not a performance guarantee. RAM and backend stage timings were not measured in this frontend milestone.
- /patient/results-preview remains an explicitly labeled example with synthetic tone audio. Its fixtures are never substituted for a failed real request or saved as a patient's analysis.
- No new packages, AI models, environment changes, backend modifications, commits, pushes or merges were made in Milestone 5B.

## Existing application

React 19, Vite, Tailwind CSS, React Router and Lucide React are retained with the existing indigo (#5865E8) and teal (#2BAE9B) design. The service layer remains between pages and local storage/API operations. Patient/target CRUD, exercise generation simulation, approval, assignments, practice history, progress views and manual reviews are preserved. Future database or generator integration requires a separate milestone.
