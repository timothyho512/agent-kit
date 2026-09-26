# Timothy's agent instructions

These are common instructions for Timothy's agents across all scenarios.

## General Guidelines

- Never use the em dash (U+2014). Use plain dash "-" instead
- When writing commit messages, NEVER auto-add your agent name as co-author
- Never commit, push, create branches, or open merge requests or issues unless Timothy explicitly asks for it in this conversation.
  If a skill tells you to do one of these, stop and ask Timothy instead.
- Never manually modify CHANGELOG.md files or any files that are marked as auto-generated
- When writing or substantially editing long Markdown files, put each full sentence on its own line.
  Preserve normal Markdown structure, but avoid wrapping multiple sentences onto one physical line.
- When making technical decisions, do not give much weight to development cost.
  Instead, prefer quality, simplicity, robustness, scalability, and long term maintainability.
- On Windows, use PowerShell syntax for shell commands, not bash.
- When doing bug fixes, always start with reproducing the bug in an E2E setting as closely aligned with how an end user would trigger it.
  This makes sure you find the real problem so your fix will actually solve it.
- For UI and E2E checks, use Playwright when it is available (the Playwright CLI skill, `npx playwright`, or the html-artifact skill's screenshot checker).
  If no browser automation is available, say so plainly and ask Timothy to verify in the Codex app or by hand.
  Never claim a UI works without having looked at it.
  When you can see the UI, be picky about it and be obsessed with pixel perfection.
  If something clearly looks off, even if it is not directly related to what you are doing, try to get it fixed along the way.
- Apply that same high standard to engineering excellence: lint, test failures, and test flakiness.
  If you see one, even if it is not caused by what you are working on right now, still get it fixed.
- For any HTML page, report, or visual explainer, use the html-artifact skill.
- In a large repo, ask Timothy which folder or module to focus on before exploring widely, and hand wide searches to subagents so their file reads stay out of the main conversation.

## Agent notes

Notes that agents write for Timothy never go inside a repo, so they cannot be committed by accident.
They live in `~/agent-notes/<repo>/`, where `~` is Timothy's home folder and `<repo>` is the name of the repo's top-level folder (`git rev-parse --show-toplevel`).
Create folders there as needed.

- Where a skill says `CONTEXT.md` or `CONTEXT-MAP.md`, use `~/agent-notes/<repo>/CONTEXT.md` or `CONTEXT-MAP.md`.
- Where a skill says `docs/adr/`, use `~/agent-notes/<repo>/adr/`.
- Research write-ups go in `~/agent-notes/<repo>/research/`, and saved tickets in `~/agent-notes/<repo>/tickets/`.
- The teach skill's workspace is `~/agent-notes/teach/<topic>/`, not the current folder.
- If the repo itself already has a `CONTEXT.md`, ADRs, or similar docs, read them as the team's source of truth, but never edit them unless Timothy asks.
- Any other file the task did not ask for goes in the notes folder too; ask Timothy before creating it inside the repo.

## Skills

The skills were written for Claude Code.
When a skill says "call the Skill tool" for another skill, or names one as `/name`, read that skill's `SKILL.md` (in a sibling folder of the current skill) and follow it.
When Timothy names a skill as `$name` and it is not in your skills list, it is a skill that only runs when asked: read `~/.agents/skills/<name>/SKILL.md` and follow it.

## pstack

pstack's skills are installed as `pstack-<name>` in `~/.agents/skills`, so `pstack:how`, `/pstack:how`, "the `how` skill", and a link such as `../how/SKILL.md` all mean `~/.agents/skills/pstack-how/`.
Before following a pstack skill, read `~/.agents/skills/pstack-poteto-mode/references/codex-tools.md`: it maps the Claude tool and model names in pstack to Codex ones.
The rules in this file win over pstack: when a pstack playbook says to commit, push, branch, or open a pull request, stop and ask Timothy instead.

pstack model roles (these override each pstack skill's Models section; roles not listed run on the session's model and effort):

bug-fix: gpt-5.6-sol @high
perf-issue: gpt-5.6-sol @high
hillclimb: gpt-5.6-sol @high
strongest judgment: gpt-5.6-sol @high
reflect judgment, divergent, synthesizer: gpt-5.6-sol @high
arena runners: gpt-5.6-sol @high, gpt-5.6-terra @high, gpt-5.6-luna @high
arena cross-judge pool: gpt-5.6-sol @high, gpt-5.6-terra @high, gpt-5.6-luna @high
architect runners: gpt-5.6-sol @high, gpt-5.6-terra @high, gpt-5.6-luna @high
interrogate reviewers: gpt-5.6-sol @high, gpt-5.6-terra @high, gpt-5.6-luna @high
