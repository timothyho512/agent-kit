# Source

These skills are vendored from Michael Denyer's pstack port, which adapts Lauren Tan's (poteto's) pstack for Claude Code and Codex.

- Repository: https://github.com/michael-denyer/pstack-claude
- Pinned commit: `c02fd4922b25ee005f42042463d741d236c2c35e` (version 0.9.45)
- Included: the folders under `plugins/pstack/skills/`, except the ones this kit does not use:
  `babysit`, `fix-ci`, `get-pr-comments`, and `make-pr-easy-to-review` (they need the GitHub CLI),
  `fix-merge-conflicts` (it finishes the merge itself; this kit uses `resolving-merge-conflicts`),
  `bro` (this kit has its own copy in `skills/bro`),
  and `setup-pstack` (the model rows live in this kit's `AGENTS.md` instead).
- Not included: the plugin's SessionStart hook. It is a `/bin/sh` script that does not run on Windows; the routing rule is in `AGENTS.md` instead.
- License: MIT, see `LICENSE`, `LICENSE-cursor-team-kit`, `NOTICE.md`, and `NOTICE-skills.md` in this directory.

Files are byte-identical to upstream at the pinned commit.
The installer installs each skill as `pstack-<name>` and rewrites only the `name:` line of the installed copy, so pstack's `tdd` and `teach` do not clash with Matt Pocock's.
To update, check out a newer commit upstream, review the diff, recopy the folders, and update the commit above.
