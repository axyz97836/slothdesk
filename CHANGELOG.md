# Changelog

All notable changes to SlothDesk are documented in this file.

## [1.0.0] — 2026-10-23: SlothDesk — Local AI File Organizer

First formal tagged release. Merged Phase A–G improvements (`improve/v2-modernization`) into `main`.

### CI & Filesystem Inode Hardening (`cc378ee`)

- Hardened `safe_move_file` rollback identity check to verify `st_size`, `st_mtime_ns`, and `st_ctime_ns` alongside `st_ino` and `st_dev`, resolving Linux ext4 inode-reuse false-match during cross-filesystem rollback races.
- All 38 automated tests passing on Ubuntu Linux and macOS CI runners.

### Phase G — Documentation & Community Readiness (`754b722`)

- Added formal documentation: `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, and `docs/HACKTOBERFEST_SUBMISSION.md`.
- Refined Quick Start documentation and verified local Qwen2.5 1.5B inference instructions.

### Phase F — Security Review & Release Readiness (`586049d`)

- Hardened rollback to verify inode (`st_ino`, `st_dev`) before unlinking, preventing race conditions if an external process replaced a file concurrently.
- Added advisory file locking (`fcntl.flock`) on `data/.slothdesk.lock` to prevent multiple independent SlothDesk processes from accessing the same data directory.
- Suppressed keyboard shortcuts when focus is inside `input`, `textarea`, `select`, or `contenteditable` elements.
- Added Escape key dismissal for alert banners.
- Added JavaScript syntax validation to CI.
- 38 automated tests passing.

### Phase E — Signature Color Identity & Accessibility (`0a16254`)

- Implemented **Warm Ivory + Emerald Green + Vermilion** signature color palette.
- Added **Emerald Night** dark theme with functional theme toggle.
- WCAG 2.2 AA contrast compliance across both themes.
- Keyboard shortcuts: `Alt+A` (analyze), `Alt+O` (organize), `Alt+S` (select all), `Alt+D` (deselect all), `Alt+R` (refresh), `Alt+Z` (undo), `Alt+T` (theme toggle), `?`/`/` (help).
- Skip-to-content link and ARIA landmarks.
- Focus-visible outlines on all interactive elements.

### Phase D — Analysis Reliability & Error Recovery (`af6d6f5`)

- Implemented partial-failure recovery: individual file analysis errors no longer abort the entire batch.
- Accurate per-file inference progress indicator with live status updates.
- Actionable error alerts with specific failure reasons and suggested fixes.
- Model readiness pre-check before starting analysis.
- 9 new reliability tests added.

### Phase C — Professional UI/UX Redesign (`9579b32`)

- Two-pane layout: inbox file list on the left, suggestion details on the right.
- Selective inbox triage with per-file checkboxes.
- Responsive layout adapting to smaller viewports.
- Accessible design system with semantic HTML and proper heading hierarchy.
- CSV export for suggestion tables.

### Phase B — Security & File Reliability (`8cbe096`, `93763e1`)

- Atomic no-clobber file moves using `os.link()` + `os.unlink()` on same-filesystem paths.
- Cross-filesystem staging with temporary files and atomic `os.rename()` commit.
- `FS_LOCK` (threading.RLock) serializing all multi-step filesystem transactions within the HTTP server process.
- Symlink rejection and path traversal prevention.
- Filename sanitization for AI-suggested names.
- Collision-safe destination resolution (appends numeric suffix).
- Comprehensive undo with batch history in `data/history.json`.
- 23+ filesystem safety and undo tests.

### Phase A — Workspace Setup (`e997d97`)

- Established workspace agent rules (Ponytail conventions).
- Unminified and reformatted CSS with design token variables.
- Installed skill references for design, branding, and UI/UX.

## [1.0.0] — Initial Release (`2aed0dd`)

- Single-file Python backend using stdlib only.
- Ollama integration for local AI inference with Qwen2.5 1.5B.
- Browser-based frontend (HTML/CSS/JS) served by the Python server.
- Demo file generation for quick testing.
- Basic file move and undo functionality.
- 12 initial tests.
- MIT license.
