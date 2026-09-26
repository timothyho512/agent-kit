# Local skill changes

Skills here replace the vendored skill of the same name at install time.
Each one is a copy of the upstream skill with the smallest change that fits Timothy's work setup:
he is new to the team, commits himself, receives Jira tickets rather than creating issues, and works on a network that may block CDNs.
The originals in `skills/vendor/` stay byte-identical to upstream, so updates stay a clean diff.
To see a change exactly, diff the two folders, for example `git diff --no-index skills/vendor/mattpocock/implement skills/local/implement`.

Rules that apply to every skill (no commits, where notes go, how "call the Skill tool" works in Codex) live in `AGENTS.md`, not here.

## implement

The last step said "Commit your work to the current branch".
Now it stops and summarises the changes and check results so Timothy can review and commit.

## code-review

Upstream requires `docs/agents/issue-tracker.md` from the setup skill and fetches specs from the issue tracker.
Now the spec is ticket text Timothy passes in, a ticket file in `~/agent-notes/<repo>/tickets/`, or a spec file in the repo, and otherwise it asks for the ticket.
With no fixed point given, it proposes the merge-base with `main` or `master`.

## improve-codebase-architecture

Upstream infers where to look from the whole commit history, and builds its report with Tailwind and Mermaid from CDNs.
Now it asks which folder or module to focus on (work repos are large) and limits history to that path.
The report is built with the html-artifact skill: inline CSS and SVG, no CDN.
`HTML-REPORT.md` keeps the card layout, diagram patterns, and vocabulary rules, minus the CDN scaffold and the ALL-CAPS labels.

## prototype

Upstream places prototypes in the repo and commits them to a throwaway branch.
Now a logic prototype lives in `~/agent-notes/<repo>/prototypes/<name>/`.
A UI prototype still has to live in the repo to run, so it asks first, never commits, copies the variants and a `VERDICT.md` to the notes folder at the end, and lists the repo files to delete.

## resolving-merge-conflicts

The last step staged, committed, and continued the rebase.
Now it stops after resolving and running the checks, and reports which side it kept per file and why; Timothy finishes the merge or rebase.
