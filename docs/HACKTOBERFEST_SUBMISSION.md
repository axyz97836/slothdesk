# SlothDesk — Hacktoberfest 2026 Week 3 Submission

## Challenge

[Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19)

## Repository

<https://github.com/axyz97836/slothdesk>

Branch: `improve/v2-modernization`

## What SlothDesk does

SlothDesk is a privacy-first, fully local AI file organizer. It uses an open-weight language model (Qwen2.5 1.5B via Ollama) to analyze text files in a local inbox, generate meaningful category suggestions, human-readable filenames, and one-line summaries — then lets you review, approve, or reject every suggestion before anything is moved.

**Nothing leaves your machine. Nothing moves without your approval.**

## How it fits the "Slow and Steady" theme

- **Deliberately paced**: inference runs locally on your own hardware, not through a fast cloud API. It's slower, but completely private.
- **Patient review**: the model suggests; you decide. No autonomous batch processing.
- **Incremental trust**: undo any batch, inspect every suggestion, verify every move.
- **No rush to ship**: the codebase prioritizes safety (atomic no-clobber moves, inode-verified rollback) over feature velocity.

## Technology

| Component | Technology | Why |
|-----------|-----------|-----|
| Backend | Python 3.10+ stdlib | Zero pip dependencies |
| Frontend | Vanilla HTML/CSS/JS | No build tools, no CDNs |
| AI Model | Qwen2.5 1.5B (Apache 2.0) | Open-weight, runs on modest hardware |
| Model Runtime | Ollama | Local inference on 127.0.0.1:11434 |
| Server Binding | 127.0.0.1:8765 | Never exposed to network |

## Key features (v2)

- **Atomic file safety**: hardlink-based same-fs moves, staged cross-fs fallback, no overwrites.
- **Undo with verification**: inode-verified rollback prevents silent data replacement.
- **Process locking**: advisory file lock prevents multiple SlothDesk instances on the same data directory.
- **Dual themes**: Warm Ivory (light) and Emerald Night (dark) with accessible contrast ratios.
- **Keyboard shortcuts**: `Alt+A` analyze, `Alt+O` organize, `Alt+Z` undo, `Alt+T` theme toggle, `?` help.
- **Partial failure recovery**: individual file errors don't abort the batch.
- **38 automated tests**: filesystem safety, undo, concurrency, error handling.
- **No external requests**: no fonts, analytics, trackers, or third-party scripts.

## Demo checklist

Before recording:

- [ ] `ollama list` shows `qwen2.5:1.5b` installed.
- [ ] `python3 app.py` starts without errors.
- [ ] Click "Try with sample files" — 6 demo files appear.
- [ ] Click "Analyze my inbox" — model generates real suggestions.
- [ ] Review suggestions — uncheck any you disagree with.
- [ ] Click "Approve & organize" — files move to `data/organized/<Category>/`.
- [ ] Verify in Finder/file manager.
- [ ] Click "Undo last batch" — files return to inbox.
- [ ] Toggle theme with `Alt+T`.
- [ ] (Optional) Disconnect Wi-Fi and repeat to demonstrate offline inference.

## Test results

```
38 passed, 5 subtests passed
```

Run with: `python3 -m unittest discover -s tests -v`

## License

MIT (project code). Qwen2.5 model weights and Ollama have their own licenses.
