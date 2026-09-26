# Timothy's agent instructions

These are common instructions for Timothy's agents across all scenarios.

## General Guidelines

- Never use the em dash (U+2014). Use plain dash "-" instead
- When writing commit messages, NEVER auto-add your agent name as co-author
- Never commit, push, create branches, or open merge requests or issues unless Timothy explicitly asks for it in this conversation.
  If a skill tells you to do one of these, stop and ask Timothy instead.
- Before creating files in a repo that the task did not ask for (notes, research write-ups, `CONTEXT.md`, ADRs), ask Timothy where to save them.
  Suggest a location outside the repo by default, so nothing ends up committed by accident.
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
