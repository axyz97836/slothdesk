# Contributing to SlothDesk

Thank you for considering a contribution to SlothDesk.

## Getting started

1. **Fork and clone** the repository.
2. **Install Ollama** from <https://ollama.com/download> and pull a model:
   ```bash
   ollama pull qwen2.5:1.5b
   ```
3. **Run the app** (no pip dependencies):
   ```bash
   python3 app.py
   ```
4. Open **http://127.0.0.1:8765** in your browser.

## Running tests

```bash
python3 -m unittest discover -s tests -v
```

Tests use mocked model responses and do not require a running Ollama instance.

## Code style

- **Python**: standard library only — no third-party pip packages.
- **Frontend**: vanilla HTML, CSS, and JavaScript — no build tools, frameworks, or external CDNs.
- **Commits**: use [Conventional Commits](https://www.conventionalcommits.org/) format (`feat:`, `fix:`, `docs:`, `test:`).

## Pull request checklist

- [ ] All existing tests pass (`python3 -m unittest discover -s tests -v`).
- [ ] New functionality includes tests.
- [ ] Python compiles without errors (`python3 -m py_compile app.py`).
- [ ] JavaScript has no syntax errors when loaded in a browser console.
- [ ] No external dependencies, fonts, analytics, or API calls added.
- [ ] The server still binds only to `127.0.0.1`.

## Filesystem safety rules

SlothDesk enforces strict filesystem safety. Any code that moves, renames, or deletes files must:

- Use the existing `FS_LOCK` for thread safety.
- Never overwrite an existing destination file.
- Reject symlinks and paths outside the data directory.
- Record moves in `data/history.json` for undo support.
- Include a test covering the new behavior.

## Reporting issues

Open a GitHub issue with:

- Your OS and Python version.
- Steps to reproduce the problem.
- Expected vs. actual behavior.
- Ollama version and model name (if relevant).

## Security vulnerabilities

See [SECURITY.md](SECURITY.md) for responsible disclosure instructions.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
