# SlothDesk 🦥

[![Release](https://img.shields.io/github/v/release/axyz97836/slothdesk?color=2D6A4F&label=Release)](https://github.com/axyz97836/slothdesk/releases/tag/v1.0.0)
[![CI Checks](https://github.com/axyz97836/slothdesk/actions/workflows/tests.yml/badge.svg?branch=main)](https://github.com/axyz97836/slothdesk/actions/workflows/tests.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-D96B43.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-38%20passing-2D6A4F.svg)](tests/test_app.py)

**Less filing. More living.** A fully local file tidier powered by an **open-weight language model**. Created for the **Hacktoberfest 2026 Open-Source AI Challenge, Week 3: Slow and Steady**.

A script can sort `.pdf` files into a PDF folder. SlothDesk looks at the *meaning* of supported text documents, generates a brief summary, proposes a human-readable filename, and suggests a category. **Nothing is moved until you approve it.** You can also undo the last organizing batch.

## Why the open AI matters

- **Private:** Files are analyzed via Ollama running locally at `127.0.0.1:11434`; no external AI API and no API keys.
- **Offline after initial setup:** After installing Ollama and downloading an open-weight model, the sorting workflow works without internet access. (The setup documentation links and model download need internet.)
- **Replaceable models:** Choose any installed Ollama model from the dropdown to compare output and speed. Default is **Qwen2.5 1.5B** (Apache 2.0 model license, unlike the separately licensed 3B and 72B variants).
- **Runs on modest computers:** Qwen2.5 1.5B is a small model. RAM and inference speed vary by machine.
- **Transparent, reversible control:** You see *what* the AI thinks and *why* before deciding whether to move any files.

## Requirements

- Python **3.10+** (standard library only — no pip packages needed)
- [Ollama](https://ollama.com/download), installed and running
- Local open-weight model: **Qwen2.5 1.5B** (`ollama pull qwen2.5:1.5b`)
- Operating systems: Tested on **macOS** (Sonoma/Sequoia on Apple Silicon & Intel) and **Linux** (Ubuntu 24.04 / 26.04). Windows is supported via Python 3.10+ and Ollama for Windows.

## Quick Start (Step-by-Step)

### 1. Verify Python version
Ensure you have Python 3.10 or higher installed:
```bash
python3 --version
```

### 2. Install and start Ollama
Download and install Ollama from <https://ollama.com/download>.
- **macOS / Windows**: Launch the installed Ollama application.
- **Linux**: Start the Ollama background service if not already active:
  ```bash
  ollama serve
  ```

### 3. Download the open-weight AI model
Download the lightweight, Apache-2.0 licensed **Qwen2.5 1.5B** model (downloads once, ~986 MB):
```bash
ollama pull qwen2.5:1.5b
```
Verify the model is ready with:
```bash
ollama list
```

### 4. Clone and run SlothDesk
Clone the repository and start the single-process local Python server:
```bash
git clone https://github.com/axyz97836/slothdesk.git
cd slothdesk
python3 app.py
```

### 5. Open the web interface
Open your web browser and navigate to:
```
http://127.0.0.1:8765
```
*(Do not open `frontend/index.html` as a `file://` URL — SlothDesk requires the local Python server at `127.0.0.1:8765` for API routing).*

### 6. Try the 2-minute demo workflow
1. **Load sample files**: Click **Try with sample files**. Six fictional documents appear in `data/inbox/` (no personal files).
2. **Verify model status**: Confirm the status indicator in the top bar displays **Ollama: Ready** with `qwen2.5:1.5b`.
3. **Run AI analysis**: Click **Analyze my inbox** (or press `Alt+A`). You will see a live per-file progress tracker as local Qwen2.5 reads each file and proposes structured recommendations.
4. **Review & edit**: Review proposed categories, filenames, summaries, and reasons. You can edit suggested filenames or categories directly in the table.
5. **Approve & organize**: Select the checkboxes for the files you want to move and click **Approve & organize** (or press `Alt+O`). Files are atomically moved into `data/organized/<Category>/`.
6. **Undo & restore**: Click **Undo last batch** (or press `Alt+Z`) to restore the moved files back to `data/inbox/` under their original filenames.
7. **Toggle themes**: Press `Alt+T` to switch between **Warm Ivory** and **Emerald Night** themes.

### 7. Stopping the application
When finished, return to the terminal running `python3 app.py` and press:
```bash
Ctrl+C
```
The server will cleanly close its listener and release its advisory lock (`data/.slothdesk.lock`).

### Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+A` | Analyze inbox |
| `Alt+O` | Approve & organize |
| `Alt+S` | Select all suggestions |
| `Alt+D` | Deselect all |
| `Alt+R` | Refresh inbox |
| `Alt+Z` | Undo last batch |
| `Alt+T` | Toggle light/dark theme |
| `?` or `/` | Show help |

Shortcuts are disabled when typing in input fields.

### Supported input files

`.txt`, `.md`, `.csv`, `.json`, `.py`, `.js`, `.html`, `.log`, `.yaml`, `.yml`.

Scans only the top level of `data/inbox/`. Files above 2 MB are displayed but won't be sent to the model. To minimize prompt length, the model reads only the **first 5,500 decoded characters** from each file. This release deliberately does **not** parse PDF, Word, images, email accounts, or binary files.

## Safety and data handling

- The Python server binds only to **127.0.0.1**, never to the public internet.
- The app contacts only your **local** Ollama service, on `127.0.0.1:11434`. Choose only locally downloaded models; do not use Ollama cloud model aliases if you require strict offline operation.
- **Atomic file moves:** same-filesystem moves use hardlinks to prevent partial transfers. Cross-filesystem moves use staged temporary files with atomic commits.
- **No-clobber guarantee:** destination files are never silently overwritten.
- **Inode-verified undo:** rollback checks file identity (`st_ino`, `st_dev`) before restoring, preventing accidental overwrites if files changed externally.
- **Process locking:** advisory file lock on `data/.slothdesk.lock` prevents multiple SlothDesk instances from corrupting the same data directory.
- All file content is treated as *untrusted text* in the model prompt. AI suggestions can be wrong: **review before moving**.
- No autonomous deletion, emails, uploads, scheduled scans, purchases, or publishing.
- Only recognized local text extensions are read; symbolic links and path traversal are rejected.
- The frontend does not load Google Fonts, external scripts, analytics, images, or APIs.
- Avoid exposing the server through a tunnel or public network. This is a local, single-user development tool, not a hardened multi-user production service.

## Themes

SlothDesk ships with two themes:

- **Warm Ivory** (default light) — warm paper background with emerald green accents and vermilion highlights.
- **Emerald Night** (dark) — deep emerald background with soft ivory text.

Toggle with `Alt+T` or the theme button. Both themes meet WCAG 2.2 AA contrast requirements.

## Architecture

```text
Browser UI (HTML/CSS/JS)
    │  local HTTP API
    ▼
Python stdlib server on 127.0.0.1:8765
    ├── /api/files    → read local inbox metadata
    ├── /api/analyze  → Qwen2.5 1.5B via Ollama /api/chat
    ├── /api/apply    → explicitly approved file moves
    ├── /api/undo     → restore latest batch
    ├── /api/demo     → generate 6 fictional sample files
    └── /api/status   → model availability + genuine file counts
                    │
                    ▼
             Ollama local model
             127.0.0.1:11434
```

All backend functionality uses the Python standard library; **no pip install** necessary.

## Automated tests

```bash
python3 -m unittest discover -s tests -v
```

38 tests covering filesystem safety, atomic moves, undo verification, collision handling, path rejection, concurrency, error recovery, and process locking.

The tests use a mocked local model response. **Running unit tests does not prove a live Ollama model is installed or working.** Before submitting the challenge, run the complete workflow using your actual local model and capture it on video.

## What to show in your challenge demo

- The local `qwen2.5:1.5b` model listed in Ollama.
- Six synthetic inbox items, visibly analyzed into AI suggestions.
- Review and approve different folder categories / names.
- The organized folder and an undo operation.
- Optional: turn off Wi-Fi *after downloading the model* and repeat to demonstrate the offline workflow.

To capture a short screen recording on macOS, use **Shift + Command + 5 → Record Selected Portion**, then share the recording via YouTube unlisted or a publicly viewable Google Drive link.

## Limitations

- Local model classification quality varies. Check or edit every suggestion.
- CPU inference on older laptops may be slow. Use a smaller downloaded model (`ollama pull qwen2.5:0.5b`) if needed.
- Long or complex documents may need a dedicated parser; this MVP intentionally prioritizes safety and transparency over broad file support.
- Undo is one batch at a time, starting with the newest non-undone batch; it cannot undo arbitrary filesystem changes made outside the app.
- No synthetic "time saved" metrics are presented as measured results. If discussing savings in a DEV post, time a real before/after test first.
- Thread locking protects against concurrent HTTP requests but not against external programs modifying the data directory simultaneously. See [SECURITY.md](SECURITY.md) for the full threat model.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT for this project's code (see `LICENSE`). Model weights and Ollama are separate projects with their own licenses.
