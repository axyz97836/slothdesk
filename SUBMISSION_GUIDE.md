# SlothDesk · Hacktoberfest Week 3 Submission Checklist

## Timeline

The official Week 3 contest entry period ends **October 25, 2026 at 11:59 PM PDT** (**October 26 at 12:29 PM IST**). It allows one qualifying submission per participant. Use the latest official rules if dates change: https://dev.to/page/hacktoberfest-week3-2026-10-19-contest-rules

## 1. Run the real model (required before making inference claims)

```bash
# Install Ollama: https://ollama.com/download
ollama pull qwen2.5:1.5b
# On Mac open the Ollama application; on Linux use 'ollama serve' if needed
python3 app.py
```

Visit http://127.0.0.1:8765. Click **Try with sample files**, then **Analyze my inbox**. Check that the local model produces actual suggestions, not sample or placeholder output. Confirm the reviewed file moves and undo work on your Mac.

## 2. Capture a 60-120 second demo video

- Use **Shift + Command + 5** on macOS to start screen recording.
- Show the model installed (`ollama list`).
- Show sample files appearing in the inbox.
- Show actual model analysis and summaries (you may speed up the long inference portion during editing; disclose if sped up).
- Check a few suggestions and click **Approve & organize**.
- Open the actual `data/organized/` folder in Finder to prove real files moved.
- Click **Undo last batch** and show the restored inbox.
- Optional: after the model is installed, temporarily turn off Wi-Fi to show the local inference path. Do not claim this if untested.
- Upload video as **Unlisted** on YouTube or an openly viewable Google Drive video. Test the shared link in an incognito window.

## 3. Publish your GitHub repository

Create an empty **public** repository named `slothdesk` at https://github.com/new and push the project files.

In a terminal inside the extracted `SlothDesk` folder:

```bash
git init
 git add .
git commit -m "Build SlothDesk local AI file organizer"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/slothdesk.git
git push -u origin main
```

Replace `YOUR_USERNAME`. If you initialized Git or added an origin already, inspect `git remote -v` rather than blindly rerunning those steps. The `.gitignore` excludes your personal inbox contents and history; still review the files you're committing.

## 4. Finish the DEV post

Open `DEV_SUBMISSION_DRAFT.md`. Replace `[ADD ...]` placeholders with:

- Actual public repository URL.
- Demo video URL (required; screenshots alone are not enough under the published rules unless you have a deployed link instead).
- Screenshot(s) from your own working app, including genuine AI suggestions.
- Real measured performance and your personal testing observations, or **delete the optional measured-payoff claims**.

Open https://dev.to/new?prefill=---%0Atitle%3A%20%0Apublished%3A%20%0Atags%3A%20devchallenge%2C%20hf26challenge%0A--- and paste/edit the draft. Ensure the tags `devchallenge` and `hf26challenge` are present. Publish during the entry period. You should also verify the completed post shows up in the contest entries.

## 5. Avoid these mistakes

- Don't claim you measured time saved unless you timed a real manual comparison.
- Don't claim offline success unless you actually tested it.
- Don't claim a partner prize category unless you meaningfully incorporated that partner's technology.
- Do not publish private notes, real receipts, secrets, or logs; the synthetic sample documents are safe to show.
- A GitHub repo URL alone isn't the complete entry; **publish the DEV submission post**.
- The model is Qwen2.5 **1.5B**, not 3B. The 1.5B variant is in the Apache-2.0 group; 3B is Qwen-licensed.
