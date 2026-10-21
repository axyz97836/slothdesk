---
title: "SlothDesk: I Let a Tiny Open-Weight Model Do My File Sorting"
published: false
tags: devchallenge, hf26challenge, hacktoberfest, opensource
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19).*

> **Before publishing:** Replace all `[ADD ...]` fields with your real links and observations. Run the project on your own laptop with a downloaded Ollama model. Don't claim an offline demo or time savings unless you've actually tested them. Delete this reminder when you're ready.

## What I Built

I don't mind writing code. I mind the part afterward: the folder full of `untitled_2.md`, `todo_final_final.txt`, mixed-up class notes, half-finished scripts, and other files I keep promising myself I'll organize *later*.

So for this week's **Slow and Steady** theme, I built **SlothDesk**, a local AI file-organizing assistant with a very sloth-like work ethic: do one repetitive thing for me, do it quietly, and never rush into a decision I haven't approved.

You put files into a local inbox. SlothDesk reads their contents with an open-weight model, figures out what they're about, and proposes a category, useful filename, and one-line summary. It does **not** move anything until you select and approve the suggestions. If you change your mind, it can undo the latest batch.

A normal extension-based organizer would put every `.txt` file into the same bucket. SlothDesk can distinguish a receipt, a class note, and a personal checklist even when all three end in `.txt`. That's the job the model actually performs; it's not a decorative chat box wrapped around a regular script.

## Demo

**Video:** [ADD a public or unlisted demo-video URL]

**What the demo shows:**
1. Running `qwen2.5:1.5b` locally with Ollama.
2. Six fictional sample documents in SlothDesk's inbox.
3. The model generating reviewable categories, filenames, summaries, and reasoning.
4. Approving a selected set of moves, seeing the real organized folders, and undoing a batch.
5. [OPTIONAL — only if personally verified] Disconnecting from Wi-Fi after the model download to demonstrate local inference without network access.

[Screenshot: ADD your real running app screenshot with suggestions visible]

## Code

**Source:** [ADD your public GitHub repository URL]

The app has no cloud API key and no Python package dependencies. The backend uses Python's standard library; the frontend is plain HTML, CSS, and JavaScript. Tests can run with `python3 -m unittest discover -s tests -v`.

## How I Built It

The pipeline is deliberately straightforward:

```text
Local inbox files
       ↓
Python reads up to 5,500 characters per supported file
       ↓
Ollama local HTTP API → Qwen2.5 1.5B
       ↓
Structured JSON: category + filename + summary + reason
       ↓
Browser review screen (human approval)
       ↓
Local file move + history record + optional undo
```

I chose **Qwen2.5 1.5B**, an open-weight model in the Apache-2.0-licensed Qwen2.5 family, running through **Ollama**. The model fits into a much smaller local download than larger LLMs, making an offline-first workflow more practical for a student laptop.

The Python server runs on `127.0.0.1`, talks only to Ollama on `127.0.0.1:11434`, and never sends file content to a hosted LLM. The UI has no external fonts, trackers, scripts, or API integrations.

I didn't want the model to become a filesystem administrator. SlothDesk enforces a category allowlist, sanitizes AI-suggested filenames, keeps original extensions, rejects symbolic links and unsafe paths, and handles collisions without overwriting files. The model doesn't control tools directly: **it suggests; the user decides**.

I also built in an undo log. It's not magic time travel — if someone has changed or replaced a file afterward, SlothDesk refuses to overwrite it when undoing.

The project includes **12 automated tests** for file moves, undo, collision handling, path rejection, and error cases. These are code tests with a simulated model response, so the live inference demo separately validates the real Ollama integration.

## Why Does Open Innovation Matter?

For this project, open AI is the product — not just a deployment option.

**Privacy without relying on promises.** Many organizer apps would upload document snippets to a provider's server. Here, inference happens through a local open-weight model. That means I can keep messy personal drafts and class material on my own machine rather than sending them to a closed API.

**No inference API bill.** Once the model is downloaded, I can run it repeatedly without paying per request. There is still a real local hardware, electricity, and initial-download cost, but no per-token cloud charge.

**A model I can swap.** I can select another locally installed Ollama model without changing the file-management logic. A smaller model can favor speed; a larger one may produce better filenames or categories. That makes performance and quality trade-offs something I can experiment with, rather than accept from one hosted provider.

**Offline operation is meaningful.** Sorting a local folder shouldn't depend on a third-party service being up. After the one-time setup, SlothDesk's core workflow can operate without internet access.

I would pick a closed API if I needed the very best possible document understanding across many formats and didn't mind uploading data or paying for calls. For this specific small, repeated, privacy-sensitive task, local open-weight inference is a better fit.

## The Lazy Payoff

I tested the prototype on **[ADD actual number]** synthetic text files. Local inference took **[ADD measured time]**, and I reviewed and approved **[ADD actual number]** file suggestions.

The most useful result wasn't raw speed. It was reducing the repetitive decisions: open file, remember what it was, invent a good name, choose a folder, repeat. The model turns those into one reviewable batch.

**What I'd improve next:** optional PDF text extraction, a folder picker, and a more systematic benchmark of small versus large local models on correctly categorized files. I intentionally kept these out of the first version to make the core path real, inspectable, and safe.

---

*Slow and steady wins the inbox.*
