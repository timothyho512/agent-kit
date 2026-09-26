---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, use /code-review to review the work.

Give Timothy a short summary of what changed (files, behaviour, and which checks ran with their results). Then commit following the local commit rule in `AGENTS.md`: show the files and message, feature branch only, and Timothy approves the commit.
