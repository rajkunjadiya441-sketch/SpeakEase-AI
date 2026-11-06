# GitHub publication review

Prepared November7, 2026 (Asia/Calcutta). No project repository was initialized, no existing remote was changed, and nothing was committed or pushed. A disposable Git index may be used solely to verify the export. Do not execute the publication commands until the owner supplies the target GitHub URL and approves this plan.

## Git and frontend history

The existing project root is not a Git repository, so it has no root branches/remotes/status yet. ipd_frontend is a separate repository, origin https://github.com/arya-thakkar/ipd_frontend.git. Local branches main and frontend-completion point to b0ce55a (initial Adapt Synthetix commit); frontend-completion is checked out. main tracks origin/main. Numerous modified/untracked Milestone5A/5B files are existing working changes, not new changes from this publication preparation. No frontend dependency, environment, source or Git history was altered. A complete local history bundle was created and verified at ignored .publication/ipd_frontend-history.bundle; uncommitted work is preserved in the original working tree and source export.

A root `git add .` with the nested repository present can create a gitlink rather than include the frontend source. Even adding individual paths inside an embedded repository is not a reliable workaround (a disposable test silently omitted the file). Do not delete, move or rewrite ipd_frontend/.git for this plan.

The selected approach creates a CLEAN publication working copy under .publication/checkout, containing reviewed ordinary source files but no nested .git/.gitmodules. The original project/frontend work and Git history stay untouched. After approval, initialize the new ROOT repository inside that publication copy. The GitHub repository will contain the current frontend snapshot as regular files; its old commit history remains in the original nested repository, rather than being merged into the new root history. This is not a submodule migration or a rewrite of the original history. Future edits should use the new Git checkout or be explicitly synced from the original workspace; exports are not automatically linked.

Frontend provenance:the existing origin and b0ce55a are retained here for attribution. No LICENSE was found at the project or frontend root, including the frontend's committed tree. Confirm the right to redistribute that frontend and choose an appropriate project license before PUBLIC release; no MIT/other license has been invented. A private repo also needs the friend added as a collaborator.

## Exact candidate files and exclusions

[PUBLICATION_FILES.txt](PUBLICATION_FILES.txt) is the exact sorted relative file list for the initial commit. It includes all existing frontend tracked files and current untracked source additions, backend/alignment source/tests/scripts, both Python manifests/snapshots, frontend package.json/package-lock.json, both .env.example files, evaluation source/docs and compact safe measured summaries.

The updated root .gitignore excludes both virtual environments, node_modules, caches/builds, model weights, datasets, private test_audio files, actual .env credentials, browser qa profiles, local checkpoint/log/result/provenance files and the publication directory itself. Only public/demo-tone.wav is deliberately included as a small labeled synthetic non-speech test fixture. Browser IndexedDB/localStorage histories are not part of the source tree. Original benchmark files and annotation rows remain untouched; evaluation/publication/summary.json is a NEW compact copy of existing numerical summaries, without raw transcripts or local paths. Raw/local evaluation artifacts needed for future research are not shipped; they are not needed to run the application.

Run an audit with existing Python or a system Python3.11 (no dependencies required):

```powershell
py -3.11 -B scripts/prepare_publication.py
```

To create the reviewed copy, ONCE after all documentation is final:

```powershell
py -3.11 -B scripts/prepare_publication.py --export
```

The exporter refuses to overwrite an existing publication copy. It copies only ignored-rule-filtered paths, verifies all required manifests/config/source, scans for provider/private keys/credential URLs, and stages the copy in a disposable temporary index to check every mode is100644 (no160000 gitlink). It never invokes commit/push or edits either existing .git directory. Audit details and file hashes stay under ignored .publication/. Do not copy the entire OneDrive tree or nest the old .git in the export.

## Verification and remaining limitations

Actual checks during preparation:

- Backend unittest:43 passed; generated audio/IPC models are mocked, health/docs and HTTP cleanup checked. No ASR/alignment inference.
- Both existing Python environments:`pip check` passed, no broken requirements.
- Frontend production build passed (Vite8.3.5); lint passed with warnings.
- Existing Chrome browser suite:63 passed, zero failed; saved synthetic recording reload playback passed, mobile390px had no horizontal overflow.
- Existing native-media suite passed:four initial native WebM flow checks and all six History/details/therapist reload-and-seeking routes passed using controlled media/mocked analysis.
- The clean export also started the production backend command using the existing Python dependencies and returned the exact expected /health JSON; no model/cache was initialized. A clean online installation on a separate laptop is still unverified.
- Temporary test server stopped after checks. No package installation/upgrades, model/dataset downloads or physical-microphone/real-inference test was run.

No high-confidence secret/provider-key/private-key/credential-URL pattern was found in candidate files. A separate literal credential-assignment scan also found no candidates. This is not a guarantee of absence. Sensitive human recordings, downloaded data/model weights and machine-specific raw results are excluded; no frontend tracked source file is missing. Source seed patient contacts use example.com/555 demo data. Historical milestone/research documentation still records this author's old absolute paths/ignored evidence; use the portable root README, not old resumption commands. The included evaluation scripts need omitted research datasets/provenance for full reproduction.

Unresolved:GitHub target URL and final commit/push approval; frontend redistribution/license choice; fresh online dependency installation and actual microphone/model execution on the friend's hardware remain unverified. Initial staging also reports four pre-existing blank-at-EOF warnings (index.html, src/App.jsx, src/index.css and vite.config.js); no source formatting was changed. The proposed check below reports them, then checks other whitespace errors with only blank-at-EOF disabled for that command. Existing frontend lint warnings and duplicate /patient/history navigation keys emit React development warnings; source functionality was deliberately not changed for publication. The current backend has no production auth, and browser demo data are local-only. See root README for CPU/RAM, CORS, origin/storage and VS Code playback limits.

## Publication commands - ONLY after URL and explicit approval

Create an EMPTY target GitHub repository (no auto README/license/gitignore until reviewed). Do not replace the frontend's existing origin. From the original project root, after checking the frozen export against PUBLICATION_FILES.txt:

```powershell
$projectRoot = (Get-Location).Path
$repositoryUrl = Read-Host "Paste the approved personal GitHub clone URL"
$remoteRefs = git ls-remote --heads --tags $repositoryUrl
if ($LASTEXITCODE -ne 0) { throw "Cannot read target repository; check URL/access." }
if ($remoteRefs) { throw "Target already has history; STOP for a separate fetch/merge plan. Do not force-push." }
Set-Location -LiteralPath (Join-Path $projectRoot '.publication/checkout')
if (Test-Path -LiteralPath .git) { throw "Repository already initialized; inspect before proceeding." }
git init -b main
git remote add origin $repositoryUrl
git add --all
git diff --cached --check
# Four documented pre-existing blank-at-EOF warnings are expected above.
# Check other whitespace errors without rewriting frontend source:
git -c core.whitespace=-blank-at-eof diff --cached --check
if ($LASTEXITCODE -ne 0) { throw "Review additional staged whitespace/errors before commit." }
if (git ls-files --stage | Select-String '^160000 ') { throw "Gitlink found; STOP." }
git status --short
git diff --cached --stat
git remote -v
# Check/set your author identity locally if it is not already configured:
git config user.name
git config user.email
# Only after reviewing the staged files and author identity:
git commit -m "Publish SpeakEase AI source and reproducible Windows setup"
git push -u origin main
```

Supply a normal HTTPS/SSH repository URL; do not embed a token/password in it. Authenticate with your normal Git/GitHub credential workflow when needed. Do not force-push, overwrite existing remote history or change the original nested remote. All commands above remain a proposal until approval. Root initialization is necessary ONLY in the clean publication checkout for this approach; the original workspace can remain unchanged.
