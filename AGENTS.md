## Agent skills

### Issue tracker

Issues and specs are tracked in GitHub Issues (`Lolgend/vinyl-reddit-app`) using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default five canonical triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`GLOSSARY.md` and `docs/adr/` at the repo root). See `docs/agents/domain.md`.

## Environment & Tooling

### Toolchain & Commands

#### General

- GitHub CLI: `gh` (Always use `BypassSandbox: true`)
- Git commands (`git status`, `git diff`, `git log`, `git branch`, `git worktree`, and any `git` operation inside`.worktrees/`): Always use `BypassSandbox: true`
- PowerShell: Chain commands with `;`, not `&&`

#### Backend

Package manager & runner is `uv`
- Run commands: `uv run <cmd>` (e.g. `uv run python script.py`)
- Manage packages: `uv add <pkg>` or `uv pip list`
- Run tests: `uv run pytest` (Always use `BypassSandbox: true`)
- Type check: `uv run mypy src tests` (Always use `BypassSandbox: true`)
- Lint / format: `uv run ruff check .` (Always use `BypassSandbox: true`)

#### Frontend

Package manager & runner is `npm`
- Playwright CLI: `playwright-cli`
