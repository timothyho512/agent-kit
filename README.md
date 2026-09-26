# agent-kit

My personal setup for the Codex CLI: global instructions plus the skills I use.

## What this is

- `AGENTS.md` holds my global agent instructions.
  The installer copies it to `$CODEX_HOME/AGENTS.md` (default `~/.codex/AGENTS.md`).
- `skills/html-artifact` is my own skill for building HTML pages, reports, and visual explainers.
- `skills/bro` restates the last answer in plain words. It is copied from the `bro` skill in pstack (MIT, https://github.com/michael-denyer/pstack-claude, a port of Lauren Tan's pstack), and it only runs when invoked as `$bro`.
- `skills/vendor/mattpocock` holds skills vendored from Matt Pocock's repository, unchanged.
- `skills/local` holds my changed copies of vendored skills; `skills/local/README.md` says what changed and why.
- `skills.txt` lists the skills to install.
  The installer copies each listed skill to `~/.agents/skills/<name>`, taking `skills/local` first, then `skills/`, then `skills/vendor/mattpocock`.
  It removes a skill it installed earlier once that skill is taken off the list, and leaves every other skill alone.

## Install on Windows

```powershell
git clone https://github.com/timothyho512/agent-kit.git $HOME\agent-kit
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
Install it once; the installer keeps it across updates:

```powershell
npm install --prefix "$HOME\.agents\skills\html-artifact\scripts"
```

The package may need approval before you can install it.
Without it the skill still works, but it cannot see the pages it builds.

## Agent notes folder

Skills that write notes (`CONTEXT.md`, ADRs, research, prototypes, teach lessons) write them to `~/agent-notes/<repo>/`, never inside a repo, so they cannot be committed by accident.
`AGENTS.md` tells Codex this, and the installer creates the folder.
Codex's sandbox only lets it write inside the current project, so allow the notes folder once in `~\.codex\config.toml` (the installer prints the exact line for your machine):

```toml
[sandbox_workspace_write]
writable_roots = ["C:\\Users\\<you>\\agent-notes"]
```

## Using it in Codex

- Run `/skills` to list the installed skills.
- Invoke a skill by name, for example `$html-artifact`, `$teach`, or `$grilling`.

## Vendored skills

The skills I use from https://github.com/mattpocock/skills, pinned at commit `c55ee46073ed923f86ce59a5eb3b6d895095d1b7`.
They are MIT licensed and kept byte-identical to upstream.
The five I changed are also kept here unchanged, so `skills/local` can be diffed against them.
See `skills/vendor/mattpocock/SOURCE.md` and `skills/vendor/mattpocock/LICENSE`.
