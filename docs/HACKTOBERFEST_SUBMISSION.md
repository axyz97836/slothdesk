# SlothDesk — Hacktoberfest 2026 Week 3 Submission Package

## Challenge Details

* **Challenge**: [Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19)
* **Deadline**: October 25, 2026 at 11:59 PM PDT
* **Theme**: "Slow and Steady" — Building open-source AI utilities that solve repetitive tasks with transparency, patient review, and open-weight models.
* **Eligible Tags**: `#devchallenge`, `#hf26challenge`, `#opensource`, `#ai`

---

## Submission Artifacts

| Artifact | Location | Status |
|---|---|---|
| **Repository** | [https://github.com/axyz97836/slothdesk](https://github.com/axyz97836/slothdesk) | Public & Active |
| **Release v1.0.0** | [https://github.com/axyz97836/slothdesk/releases/tag/v1.0.0](https://github.com/axyz97836/slothdesk/releases/tag/v1.0.0) | Published |
| **DEV Post Draft** | [`DEV_SUBMISSION_DRAFT.md`](../DEV_SUBMISSION_DRAFT.md) | Ready for Final Review |
| **Demo Script & Guide** | [`docs/DEMO_SCRIPT_AND_RECORDING_GUIDE.md`](DEMO_SCRIPT_AND_RECORDING_GUIDE.md) | Prepared |
| **Automated Tests** | [`tests/test_app.py`](../tests/test_app.py) | 38/38 Passing |
| **CI Checks** | GitHub Actions (`tests.yml`) | All Passing on `main` |

---

## Project Summary

SlothDesk is a privacy-first, fully local file organizer powered by an open-weight language model (`qwen2.5:1.5b` via Ollama). It analyzes the contents of messy text documents, proposes meaningful categories and human-readable filenames, and generates concise summaries.

### Core Guarantees:
1. **Zero Cloud Dependencies**: 100% local inference via Ollama HTTP API (`127.0.0.1:11434`). No API keys, no per-token charges, and complete offline capability after setup.
2. **Explicit Human Approval**: The AI generates recommendations in an editable table. No files move until the user reviews and clicks "Approve & Organize".
3. **Atomic Filesystem Safety**: Same-device moves use `os.link()` + `os.unlink()`; cross-device moves use staged temporary files with atomic `os.rename()` commits. Existing files are protected with automatic numeric suffixes.
4. **Verified Rollback & Undo**: Single-batch undo restores files to original inbox locations and names. Rollback checks `st_ino`, `st_dev`, `st_size`, `st_mtime_ns`, and `st_ctime_ns` to prevent clobbering externally modified files.
5. **Zero Pip Packages**: Pure Python standard library backend paired with vanilla HTML5, CSS, and JavaScript.

---

## Week 3 Eligibility Checklist

- [x] Repository created within challenge window: **October 21, 2026** (Challenge: Oct 19–25, 2026).
- [x] Initial commit made within challenge window: **October 21, 2026 at 17:06 UTC** (`2aed0dd`).
- [x] All PR merges and releases completed before October 25, 2026 deadline.
- [x] Uses genuine open-weight model: **Qwen2.5 1.5B** (Apache 2.0 license).
- [x] Open-source license: **MIT License**.
- [x] Public GitHub repository with clean history and zero tracked private data or secrets.
- [x] Comprehensive test suite (38 automated unit tests).
- [x] Verified beginner-friendly README with step-by-step setup and quick-start instructions.
- [x] Structured DEV post following the official competition template.

---

## Demo Checklist

Before publishing the final DEV post:
1. Record a 90–120s walkthrough following [`docs/DEMO_SCRIPT_AND_RECORDING_GUIDE.md`](DEMO_SCRIPT_AND_RECORDING_GUIDE.md).
2. Upload the video to YouTube as **Unlisted** (or Google Drive with public link viewing).
3. Replace the video placeholder in [`DEV_SUBMISSION_DRAFT.md`](../DEV_SUBMISSION_DRAFT.md).
4. Review post formatting on DEV and submit under the required tags `#devchallenge` and `#hf26challenge`.
