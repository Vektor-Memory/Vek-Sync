# Changelog

All notable changes to `@vektormemory/vek-sync` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.3.1] — 2026-06-15

### Added
- **Interactive TUI** — running `vek-sync` with no arguments now launches a full arrow-key command palette powered by [Ink](https://github.com/vadimdemedes/ink). Each command has a guided wizard with step-by-step prompts instead of requiring flag memorisation.
- **Guided wizards** for all 11 commands: `init`, `sync`, `status`, `diff`, `export`, `add`, `ping`, `share`, `profile`, `search`, `vault` — each wizard builds the correct command from user input and runs it.
- **`--version` / `-v` flag** — prints `vek-sync v0.3.1` and exits cleanly. Was previously falling through to the unknown-command error.
- **`vault delete`** — fixed; the underlying util exports `remove()` not `del()`. Delete now works correctly.
- **TTY guard** — TUI only launches in an interactive terminal. CI environments, pipes, and scripted usage fall through to plain-text output unchanged.
- **Comprehensive test suite** (`test_vek_sync.py`) — 55 tests covering every command, all subcommands, error cases, module resolution, and the full vault cycle.

### Fixed
- `conn.diff is not a function` — `diff` and `sync` commands now check `typeof conn.diff === 'function'` before calling it. Connectors that only implement `sync()` and `status()` (windsurf, claudeCode, cline, rooCode, gemini, copilot, continue, codex) no longer throw; they fall back to `status()` for the diff preview and `sync()` for the write path.
- `conn.write is not a function` — `cmdSync` was calling `conn.write()` which does not exist on any connector. Corrected to `conn.sync(servers, credentialResolver)`.
- `pingStdio(cfg)` — `cmdPing` was passing the entire server config object as the first argument. Corrected to `pingStdio(cfg.command, cfg.args ?? [], cfg.env ?? {})` matching the function signature.
- Ink render warning (`triggering nested component updates from render`) — `ping`, `status`, `diff`, `export`, and `share` wizards were calling `onRun([])` directly in the render body. Moved into `useEffect(() => { onRun([]); }, [])` so they fire after mount.
- `await import('fs')` inside non-async `cmdProfile` — caused `SyntaxError: Unexpected reserved word` on every invocation. Added `mkdirSync` and `readdirSync` to the static import at the top of the file and removed the dynamic imports.
- `vault.del is not a function` — renamed to `vault.remove()` to match the actual export from `utils/vault.js`.
- Shell deprecation warning on Node 24 — removed `shell: true` from the TUI's internal `spawnSync` call.
- `cmdAdd` argument guard — the no-name/no-url check now runs before `getMcpFile()` so it fires correctly even when `--file` is supplied without a server name.

### Changed
- `cmdDiff` — connectors without a `diff()` method now show `(diff N/A)` alongside their `status()` path instead of throwing.
- `cmdSync --dry-run` — uses `diff()` when available; falls back to `status()` for connectors that only implement the write path.
- `cmdPing` — now shows response time in milliseconds alongside online/offline status.

---

## [0.3.0] — 2026-05-01

### Added
- Initial public release.
- 11 connectors: Claude Desktop, Cursor, VS Code, Windsurf, Claude Code, Cline, Roo Code, Gemini CLI, GitHub Copilot CLI, Continue, Codex.
- Commands: `init`, `sync`, `export`, `status`, `diff`, `add`, `ping`, `share`, `profile`, `search`, `vault`.
- Vault encryption for secrets via `utils/vault.js`.
- Curated MCP server registry with npm fallback search.
- `--watch` mode on `sync` for live re-sync on `.mcp.json` change.
- `--dry-run` on `sync` for preview without writing.
- Named profiles (save/use/list) stored in `~/.vek-sync/profiles/`.
- `--only <connector,...>` flag to limit sync/status/diff to specific editors.
- `--from <connector>` on `init` to seed from an existing editor config.
- `--from-url <url>` on `init` to seed from a shared remote config.
