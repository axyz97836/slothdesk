# SlothDesk — Demo Video Recording Guide & Voiceover Script

This guide provides exact, step-by-step instructions for recording the 90–120-second demonstration video on macOS for the Hacktoberfest 2026 Week 3 ("Slow and Steady") challenge submission.

---

## 1. Recording Setup Checklist (macOS)

1. **Clean Workspace**:
   - Close all unrelated browser windows, notification banners, and personal documents.
   - Set browser zoom to 100% or 110% (Command + Plus) so all UI text is crisp and easily readable.
2. **Launch Prerequisites**:
   - Start Ollama: Launch the Ollama app or run `ollama serve`. Confirm with `ollama list` that `qwen2.5:1.5b` is present.
   - Start SlothDesk in Terminal:
     ```bash
     cd ~/Downloads/SlothDesk
     python3 app.py
     ```
   - Open browser at `http://127.0.0.1:8765`.
   - Verify the top bar reads: **Ollama: Ready** with `qwen2.5:1.5b`.
3. **Reset Sample Files**:
   - Click **Try with sample files** to ensure the 6 fictional demo files are populated in `data/inbox/`.
4. **macOS Screen Recorder**:
   - Press `Command + Shift + 5`.
   - Select **Record Selected Portion** and frame only the SlothDesk browser window (excluding desktop icons, menu bars, and private docks).
   - Under **Options**, select your microphone if recording audio live, or record video first and dub the voiceover track.
   - Set Timer to 5 seconds to give yourself time to prepare.

---

## 2. Minute-by-Minute Voiceover Script & Action Timeline

| Timestamp | Visual Action on Screen | Spoken Voiceover Script |
|---|---|---|
| **00:00 – 00:10** | Show SlothDesk header, sloth logo, and tagline: *"Less filing. More living."* | *"Hi everyone! We all know the pain of messy download folders filled with cryptic filenames like `untitled_2.md` and `todo_final_final.txt`. Today I'm excited to present SlothDesk — a privacy-first, fully local file organizer powered by an open-weight language model."* |
| **00:10 – 00:25** | Point cursor to the top status bar showing **Ollama: Ready** with `qwen2.5:1.5b`, then scroll down to the Inbox table showing the 6 fictional sample files. | *"SlothDesk connects directly to Ollama running right on this machine at localhost:11434. No cloud APIs, no tokens, and no tracking. Here in our inbox, we have six sample files — python scripts, meeting notes, receipts, and reading summaries."* |
| **00:25 – 00:45** | Click the **Analyze my inbox** button (or press `Alt+A`). Show the live per-file inference progress bar as Qwen2.5 reads each file and populates the table. | *"Rather than sorting blindly by file extension, SlothDesk reads the actual meaning of each document. Let's hit 'Analyze my inbox'. Local Qwen2.5 1.5B processes each file locally. You can see real-time per-file progress as structured suggestions appear."* |
| **00:45 – 01:05** | Hover over the generated table. Point out categories (`Code`, `Finance`, `Reading`, `Study`), summaries, and reasons. Click and edit the suggested filename on row 1. | *"Look at that! It recognized `script_v2.py` belongs in 'Code', categorized the receipt export into 'Finance', and classified reading notes appropriately. Best of all, SlothDesk never moves anything without approval. You can directly edit any proposed filename or category right here."* |
| **01:05 – 01:25** | Check the selection checkboxes, then click the emerald **Approve & organize** button. Show the inbox empty and files appearing in `data/organized/`. | *"Once you're satisfied, click 'Approve & organize'. Using atomic filesystem operations with hardlinks and staged commits, SlothDesk moves approved files into clean category folders without risk of partial transfers or clobbering existing files."* |
| **01:25 – 01:40** | Scroll to the **History & Undo** section. Click **Undo last batch** (or press `Alt+Z`). Show files instantly restored to Inbox. | *"What if you change your mind? SlothDesk features a verified undo system. Click 'Undo last batch', and files are safely returned to their original inbox locations. The rollback verifies inode and timestamps so externally modified files are never overwritten."* |
| **01:40 – 02:00** | Press `Alt+T` or click the theme toggle to show **Emerald Night** dark theme, then back to **Warm Ivory**. Pan across the screen and close out. | *"SlothDesk features full keyboard accessibility and dual WCAG-compliant themes: Warm Ivory and Emerald Night. With 38 automated tests and 100% open-weight AI, it puts you in complete control. Check out the project on GitHub — happy Hacktoberfest!"* |

---

## 3. Post-Recording Review Checklist

- [ ] Duration is between 90 and 120 seconds.
- [ ] No personal files, email addresses, browser bookmarks, or notification popups are visible.
- [ ] Audio is clean, clear, and synchronized with on-screen clicks.
- [ ] AI inference is authentic (real `qwen2.5:1.5b` model running locally).
- [ ] File movements and undo operations are genuine filesystem actions.
- [ ] Upload video to YouTube as **Unlisted** (or Google Drive with "Anyone with link can view").
- [ ] Insert the public video URL into `DEV_SUBMISSION_DRAFT.md` and `docs/HACKTOBERFEST_SUBMISSION.md`.
