# agent-kit

My personal setup for the Codex CLI: global instructions plus the skills I use.

## What this is

- `AGENTS.md` holds my global agent instructions.
  The installer copies it to `$CODEX_HOME/AGENTS.md` (default `~/.codex/AGENTS.md`).
- `skills/html-artifact` is my own skill for building HTML pages, reports, and visual explainers.
- `skills/vendor/mattpocock` holds skills vendored from Matt Pocock's repository.
- The installer copies every skill to `~/.agents/skills/<name>`.
  It replaces only the skills it ships and leaves any other skills alone.

## Install on Windows

```powershell
git clone https://github.com/<github-user>/agent-kit.git $HOME\agent-kit
powershell -ExecutionPolicy Bypass -File $HOME\agent-kit\install.ps1
```

Company policy may restrict script execution.
The `-ExecutionPolicy Bypass` flag applies only to that one run and does not change any machine or user setting.
If an existing `AGENTS.md` differs from this one, the installer backs it up to `AGENTS.md.bak-<yyyyMMdd-HHmmss>` first.

On macOS or Linux, run `./install.sh` from the repository instead.

## Update

```powershell
git -C $HOME\agent-kit pull
powershell -ExecutionPolicy Bypass -File $HOME\agent-kit\install.ps1
```

Rerunning is safe.

## Optional: screenshot checker

The html-artifact skill can screenshot its pages to check them, using the `playwright-core` npm package.
Install it once, and again after each update because the installer replaces the skill folder:

```powershell
npm install --prefix "$HOME\.agents\skills\html-artifact\scripts"
```

The package may need approval before you can install it.
Without it the skill still works, but it cannot see the pages it builds.

## Using it in Codex

- Run `/skills` to list the installed skills.
- Invoke a skill by name, for example `$html-artifact`, `$teach`, or `$grilling`.

## Vendored skills

Every skill under `skills/engineering/` and `skills/productivity/` in https://github.com/mattpocock/skills, pinned at commit `c55ee46073ed923f86ce59a5eb3b6d895095d1b7`.
They are MIT licensed and kept byte-identical to upstream.
See `skills/vendor/mattpocock/SOURCE.md` and `skills/vendor/mattpocock/LICENSE`.
