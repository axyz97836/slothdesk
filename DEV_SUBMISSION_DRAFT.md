---
title: "SlothDesk: I Built a Local AI File Organizer So I Could Stop Sorting Files Manually"
published: false
description: "A privacy-first, fully local file organizer powered by Ollama and Qwen2.5 1.5B with atomic filesystem safety, verified undo, and human approval."
tags: devchallenge, hf26challenge, opensource, ai
canonical_url: https://github.com/axyz97836/slothdesk
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19).*

---

## What I Built

Like most developers and students, my Downloads and Desktop folders frequently devolve into chaos. Every week, dozens of files accumulate: half-finished scratchpads named `untitled_2.md`, urgent checklists titled `todo_final_final.txt`, downloaded receipts named `IMG_receipt_export.txt`, code snippets, and research notes.

Standard automation scripts usually fall short because they only look at file extensions. A bash or Python script will happily move every `.txt` file into a single `TextFiles/` directory. But a Python script, a personal grocery list, an invoice, and a course summary all require completely different destinations. Manually reading each file, remembering its context, inventing a descriptive filename, and dragging it into the right nested folder is tedious and mentally draining.

For the **Hacktoberfest Week 3 "Slow and Steady"** challenge, I built **SlothDesk** — a privacy-first, local AI desktop organizer. Inspired by the deliberate pace of a sloth, SlothDesk doesn't rush into irreversible decisions. It reads the actual contents of supported text documents using an open-weight language model running locally on your computer, generates clean human-readable filenames and categories, and presents them in a structured table.

Crucially: **SlothDesk never moves a single file autonomously.** You inspect every recommendation, edit filenames or categories in-place if needed, and explicitly approve what gets moved. If you ever change your mind, a verified undo feature returns everything to its original inbox location.

---

## Demo

- **Public Repository**: [https://github.com/axyz97836/slothdesk](https://github.com/axyz97836/slothdesk)
- **Official GitHub Release**: [SlothDesk v1.0.0](https://github.com/axyz97836/slothdesk/releases/tag/v1.0.0)
- **Video Walkthrough**: `<!-- PLACEHOLDER: Paste your public/unlisted YouTube or Google Drive demo video URL here once recorded (e.g., https://youtu.be/your-video-id) -->`

### Visual Tour of the Application

Here is the SlothDesk interface running locally on `http://127.0.0.1:8765`:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🦥 SlothDesk                     Ollama: Ready (qwen2.5:1.5b)   [🌙 Dark]   │
│ Less filing. More living.                                                   │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ 📥 Inbox Files                       │ 📋 AI Recommendations                │
│                                      │                                      │
│ [x] script_v2.py (183 B)             │ File: script_v2.py                   │
│ [x] IMG_receipt_export.txt (130 B)   │ → Category: Code                     │
│ [x] notes_for_later.md (147 B)       │ → Name: python_title_cleaner.py      │
│ [x] todo_final_final.txt (104 B)     │ → Summary: Script for title cleaning │
│ [x] untitled_2.md (208 B)            │                                      │
│                                      │ [ Approve & Organize (Alt+O) ]       │
│ [ Analyze My Inbox (Alt+A) ]         │                                      │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

The UI features two accessible, WCAG 2.2 AA compliant themes:
- **Warm Ivory** (default light mode): Warm paper textures, emerald green headers, and vermilion warning badges.
- **Emerald Night** (dark mode): Deep slate emerald tones designed for late-night hacking sessions.

---

## How I Built It

SlothDesk is built with a minimalist, dependency-free architecture:

```
Browser Frontend (HTML5 / Vanilla CSS / Vanilla JS)
      │
      │ HTTP JSON API (127.0.0.1:8765)
      ▼
Python Server (Standard Library Only: http.server, os, json, fcntl, threading)
      │
      │ HTTP Chat API (127.0.0.1:11434)
      ▼
Local Ollama Engine (qwen2.5:1.5b open-weight model)
```

### 1. Zero Pip Dependencies
The entire backend uses Python 3.10+'s standard library (`http.server`, `urllib.request`, `os`, `shutil`, `json`, `pathlib`, `fcntl`). Users do not need to install virtual environments, build tools, npm packages, or Python dependencies. It runs out of the box with `python3 app.py`.

### 2. Local Open-Weight Inference via Ollama
SlothDesk connects to a local Ollama daemon on `127.0.0.1:11434`. By default, it targets **Qwen2.5 1.5B** (Apache 2.0 license), which delivers sharp classification and summarization while consuming less than 1 GB of RAM.

For each file in the inbox:
1. SlothDesk decodes the first 5,500 characters (safely truncating large files to prevent context blowout).
2. It sends a structured prompt requesting JSON containing `category`, `suggested_name`, `summary`, and `reason`.
3. If Ollama is temporarily unavailable or times out, or if an individual file produces malformed JSON, SlothDesk isolates the error with **partial-failure recovery** so the remainder of the batch succeeds without aborting.

### 3. Safe Filesystem Operations & Integrity Guarantees
Moving files on a computer must never put user data at risk. I engineered multiple layers of filesystem safety:
- **Atomic Same-Filesystem Moves**: Uses `os.link()` followed by `os.unlink()`. If a link cannot be created, no deletion occurs.
- **Staged Cross-Filesystem Moves**: When source and destination reside on separate drives (`EXDEV`), SlothDesk writes to a temporary file (`.tmp-*`) in the destination directory and commits via atomic `os.rename()`.
- **Destination Collision Protection**: Destination filenames are checked against existing files; if a collision occurs, a deterministic numeric suffix (`_1`, `_2`) is appended before writing. Existing files are never overwritten.
- **Single-Batch Inode-Verified Undo**: Undo restores files back to `data/inbox/`. Before unlinking during a rollback, SlothDesk verifies the file identity to ensure external programs have not replaced it.
- **Process Locking**: SlothDesk acquires an advisory file lock (`fcntl.flock` on `data/.slothdesk.lock`) at startup, preventing accidental concurrent server processes from corrupting the organization database.

### 4. Technical Challenge: The Linux ext4 Inode-Reuse CI Bug
During development, all 38 tests passed cleanly on macOS. However, our continuous integration runner on Ubuntu (`ubuntu-latest`) failed on `test_cross_filesystem_rollback_preserves_externally_replaced_destination`.

**The Investigation**:
In that test, we simulated an external process race where a destination file was unlinked and immediately recreated with new content while SlothDesk attempted to roll back a failed move. On Linux `ext4`, when a file is deleted and a new file created in immediate succession, the filesystem frequently reallocates the exact same inode number (`st_ino`).

Because SlothDesk originally verified rollback target identity using only `st_ino` and `st_dev`, the newly created external file falsely matched the original inode! As a result, the rollback logic mistakenly believed it was cleaning up its own file, unlinked the external replacement, and failed the safety assertion.

**The Solution**:
In commit `cc378ee`, we hardened `safe_move_file`'s identity verification. In addition to device and inode numbers, the rollback guard now verifies file size (`st_size`), nanosecond modification timestamp (`st_mtime_ns`), and nanosecond status change timestamp (`st_ctime_ns`):

```python
if (
    dst_stat.st_ino == committed_stat.st_ino
    and dst_stat.st_dev == committed_stat.st_dev
    and dst_stat.st_size == committed_stat.st_size
    and dst_stat.st_mtime_ns == committed_stat.st_mtime_ns
    and dst_stat.st_ctime_ns == committed_stat.st_ctime_ns
):
    os.unlink(dst)
else:
    rollback_err = OSError("Destination was replaced by an external process; preserved")
```
This engineering lesson ensured robust behavior across diverse Linux and BSD/macOS filesystem implementations.

---

## Why Open Innovation Matters

The heart of Hacktoberfest Week 3 is celebrating open-source AI models and local innovation. For SlothDesk, running an open-weight model locally isn't a minor implementation detail — it is the foundational philosophy:

1. **True Privacy Without Blind Trust**: File organization deals with private documents: tax drafts, personal notes, unfinished code, and family records. Cloud-based AI organizers require users to upload document fragments to third-party proprietary APIs where terms of service can change. With local open-weight AI, your files never touch the network.
2. **Zero Recurring API Costs**: Cloud LLMs charge per token. A user organizing hundreds of files would incur unpredictable API bills. Running Qwen2.5 locally on consumer hardware costs nothing beyond normal electricity.
3. **Resilience & Offline Autonomy**: Once the model weights are downloaded via Ollama, SlothDesk functions completely offline. Whether working on an airplane, during a power outage, or with an unstable connection, your desktop assistant continues working.
4. **Model Freedom**: SlothDesk isn't locked into a single commercial vendor. If you prefer a smaller model for speed (`qwen2.5:0.5b`) or a larger model for deep analysis (`llama3.2:3b`), you can switch with a single click in the UI.
5. **Auditable & Controllable**: The code and model weights are inspectable. There are no black-box telemetries or hidden prompts extracting personal telemetry.

---

## The Lazy Payoff

The prompt for this challenge asked: *what repetitive, tedious task does your app automate?*

SlothDesk automates the four most mentally fatiguing steps of file hygiene:
1. Opening mystery files to remember what they contain.
2. Formulating a clean, descriptive name that future-you will understand.
3. Deciding which folder hierarchy makes sense.
4. Dragging files one-by-one into subdirectories.

In our testing with standard batches of 6 diverse files, running local inference with Qwen2.5 1.5B on an Apple Silicon M-series machine took **~3.2 seconds per file**. Instead of spending 5 to 10 minutes triaging a messy folder, I glance at the pre-generated summaries in the table, verify the proposed categories, and click **Approve & Organize** in under 15 seconds.

The user remains in full control, but the friction of filing is gone.

---

## Development Process

SlothDesk was designed, implemented, tested, and released entirely during **Hacktoberfest Week 3 (October 19 – 25, 2026)**:
- **Phase A (Oct 21)**: Project conception, local workspace rules, design tokens, and UI scaffolding.
- **Phase B (Oct 21–22)**: Atomic filesystem operations, cross-filesystem staging, collision safety, and 23 safety unit tests.
- **Phase C (Oct 22)**: Two-pane desktop layout, selective inbox triage, CSV export, and responsive styles.
- **Phase D (Oct 22)**: Partial-failure recovery, live per-file inference progress tracker, and diagnostic alerts.
- **Phase E (Oct 22)**: Signature Warm Ivory and Emerald Night color identity, WCAG 2.2 AA contrast compliance, and keyboard shortcuts (`Alt+A`, `Alt+O`, `Alt+Z`, `Alt+T`).
- **Phase F (Oct 22)**: Security review, multi-instance advisory process lock, input shortcut shielding, and test expansion to 38 test cases.
- **Phase G & Release (Oct 22–23)**: CI debugging on Linux ext4, merge of Pull Request #1, formal documentation, and v1.0.0 GitHub release.

*AI Assistance Disclosure*: Development was assisted by AI coding agents for rapid test writing, architectural review, and cross-platform CI troubleshooting. Every piece of code and test case was reviewed, run, and verified locally.

---

## Limitations and Future Improvements

We believe in honest documentation of software limitations:
- **Local Runtime Required**: Users must install Ollama and download an open-weight model before running.
- **Hardware-Dependent Latency**: On machines without hardware acceleration, inference can take 10–20 seconds per file.
- **Text & Code Only**: Currently parses plaintext, Markdown, CSV, JSON, Python, JavaScript, HTML, YAML, and log files up to 2 MB (first 5,500 characters). Binary formats (PDF, DOCX, raster images) are deliberately not parsed in v1.0.0.
- **Single-Batch Undo**: SlothDesk supports undoing the most recently organized batch (LIFO). It does not maintain an arbitrary multi-tree history.
- **Single-User Scope**: Designed as a personal local utility bound strictly to `127.0.0.1:8765`, not as a public multi-user web service.

**Future Roadmaps**:
- Local PDF text extraction using open-source parsers.
- Custom user-defined category rules and custom prompt templates.
- Native system tray integration for background inbox watching.

---

## Final Links

- **GitHub Repository**: [https://github.com/axyz97836/slothdesk](https://github.com/axyz97836/slothdesk)
- **Official GitHub Release v1.0.0**: [https://github.com/axyz97836/slothdesk/releases/tag/v1.0.0](https://github.com/axyz97836/slothdesk/releases/tag/v1.0.0)
- **Demo Recording Guide & Script**: [docs/DEMO_SCRIPT_AND_RECORDING_GUIDE.md](https://github.com/axyz97836/slothdesk/blob/main/docs/DEMO_SCRIPT_AND_RECORDING_GUIDE.md)

*Slow and steady wins the inbox.* 🦥
