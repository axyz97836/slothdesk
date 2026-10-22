# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| v2 (`improve/v2-modernization`) | ✅ Active |
| v1 (`main`, initial release) | ⚠️ Superseded |

## Threat model

SlothDesk is a **single-user, localhost-only** development tool. It is not designed for multi-user, public-facing, or production deployment.

### What SlothDesk protects against

- **Accidental data loss**: atomic no-clobber file moves prevent destination overwrites. Undo verifies inode identity before restoring files.
- **Path traversal**: all file paths are resolved and validated against the configured data directory. Symlinks are rejected.
- **AI-suggested unsafe filenames**: model output is sanitized to remove path separators, null bytes, and OS-reserved characters.
- **Concurrent HTTP thread races**: `FS_LOCK` serializes all filesystem-mutating operations within the Python process.
- **Multiple daemon instances**: advisory file locking on `data/.slothdesk.lock` prevents two SlothDesk processes from accessing the same data directory.

### Known limitations

- **Single-process protection only**: `FS_LOCK` does not protect against external programs modifying files in `data/inbox/` or `data/organized/` while SlothDesk is running. The advisory file lock prevents other SlothDesk instances but not arbitrary processes.
- **No authentication**: the HTTP server on `127.0.0.1:8765` has no login, tokens, or CORS restrictions. Any local process can call the API.
- **No TLS**: traffic between browser and server is unencrypted HTTP on localhost.
- **Model prompt injection**: file contents are passed as untrusted text in the model prompt. A malicious file could attempt to manipulate model output. All AI suggestions require human review before execution.
- **No audit logging beyond undo history**: `data/history.json` records file moves for undo, but does not provide a tamper-evident audit trail.

## Reporting a vulnerability

If you discover a security issue:

1. **Do not open a public GitHub issue.**
2. Email the maintainer at the address listed in the repository profile, or use GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability) feature.
3. Include a clear description of the issue, reproduction steps, and potential impact.
4. Allow reasonable time for a fix before public disclosure.

## Security-related configuration

- The server binds exclusively to `127.0.0.1` (not `0.0.0.0`).
- Ollama communication is restricted to `127.0.0.1:11434`.
- No external network requests are made by the frontend or backend.
- The `.gitignore` excludes user data (`data/inbox/*`, `data/organized/*`, `data/history.json`).
