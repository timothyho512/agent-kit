---
name: code-walkthrough
description: Walk the user line by line through code an agent generated, beside a map page showing how the pieces connect and which decisions were made. Use before opening a PR, or when the user says "walk me through" a diff, branch, or change, small or weeks long.
---

# Code walkthrough

The user is about to put their name on code they did not type.
The goal: after the walkthrough they can explain every changed line, and every decision behind it, to a reviewer.
They are a programmer: they read every line themselves.
You are the senior beside them: point at what they would trip on, answer what they ask, and show why the code is this way.
Explain; never test them.

You write a **spec**: a JSON plan of the flows, steps, and decisions.
The script `scripts/walkthrough.mjs` (Node 18+, no installs) owns everything mechanical: the diff, the coverage check, the code display, progress, and the map page.
You never write HTML and never copy code into the spec.

Below, `wt` means `node <this-skill-dir>/scripts/walkthrough.mjs`.
Step (`S1`) and decision (`D1`) numbers are the shared vocabulary between the map on one monitor and the walk in the terminal.

## 1. Start or resume

Run `wt init --base <base>` inside the repo, where `<base>` is the ref the user named, or else `main` or `master`.
Add `--head <ref>` for a committed branch or PR that is not checked out; without it, the working tree counts, including uncommitted and untracked files.
`init` prints the spec path, the changed files with their line counts, and whether the change is large.

If `init` says a spec already exists, this is a **resume**: run `wt status <spec>` and `wt check <spec>`.
Re-plan only the steps that `check` reports as changed or uncovered, then go to step 5 at the next step `status` names.

## 2. Plan the spec

Read `references/spec.md` for the format.

1. Read every changed file in full, plus the unchanged code each change calls into or is called from, far enough to explain it.
2. Add `ignore` entries for files nobody needs to read (lock files, generated code, snapshots, binaries), each with a reason.
3. Trace the **flows**: each starts at something a person or system triggers and follows the calls through the layers.
   Draw each flow's actors and messages.
4. Cut the code into **steps** in the order it runs.
   A **read** step is one function, method, or component section of 25 lines or fewer: core logic, anything with a decision, anything that can break.
   A **skim** step is code a reader takes in at a glance: DTOs and records, plain types, imports-only changes, config, migrations without logic, repetitive test setup.
   When unsure, choose read.
5. List the **decisions**: anywhere a reasonable engineer could have written it another way.
   Hunt for two implementations of similar things, where logic lives, data shape, error handling and defaults, new dependencies, and patterns copied from existing code (name the source file).
   Take the why from the code, comments, ticket, or this conversation; otherwise leave `why` null.

On a large change, plan every flow before walking any of them; the map has to show the whole feature.

## 3. Check until clean

Run `wt check <spec>` and fix every problem it lists, until it prints OK.
It proves every changed line belongs to exactly one step, read steps are short, and every id resolves.

## 4. Render and open the map

Run `wt render <spec>`, then open the printed `map.html` (`Start-Process` on Windows, `open` on macOS).
Tell the user the flows, the step count split into read and skim, and ask which flow to walk first when there is more than one.
On a large change, also tell them the walk can start in a fresh session, which resumes from the spec and leaves the planning out of the walk's context.

## 5. Walk one step at a time

For each step, run `wt show <spec> <step>`.
It prints the step header, any notes already saved on the step, and the code with real line numbers, changed lines marked `+`.
Print the header and the code (skip the code when the user has said they see it elsewhere, for example in a diff view).

A **skim** step then gets one to three sentences on what the block holds and anything unusual in it.

A **read** step then gets these sections.
Lines the user can read for themselves get no comment: narrating them buries the hard ones.

- **Key lines**: the one to three lines that make the step non-trivial: an ordering or race, an edge case, a non-obvious API, a line whose absence would break something.
  For each, give a concrete case with real values (a short timeline when order matters), then what goes wrong without the line, then the syntax only where it is unusual.
  A step with nothing hard says so in one sentence.
- **You might not know**: each language or framework feature the step relies on that has not come up earlier in the walk (an Angular signal, an RxJS subscription, a JPA annotation), one sentence each.
  Check a claim about a language or framework against the code or its docs before stating it; when unsure, say so.
- **Decisions**: each `D` number the step carries: what was chosen, the alternative, and the why, or "unknown, decide whether you agree".
- **Watch out** (only when true): a bug, a missing case, dead code, or a mismatch with the rest of the codebase.
  Record each with `wt watch <spec> <step> "<text>"`.

End with "Ask about any line by number, or say next.", run `wt mark <spec> <step> walked` (it re-renders the map), and wait.
The user can say:

- A line number or range (`262`, `253-255`): explain those lines the way key lines are explained.
- Any other question: answer it for this step.
- "I don't get it", or the same line again: switch to an approach not yet used for that line, never a reworded version.
  The approaches: trace real values through it; show the code without it and what breaks; break the syntax down token by token; compare it with code in this repo the user already knows.
- `explain all`: explain the step line by line, one bullet per line or group of 2 to 3 lines doing one thing, starting with the line numbers (`44-45: ...`).
  For an unfamiliar language or file.
- `next` / `back`, or a step id (`S12`) to jump.
- `deeper`: walk the unchanged code this step calls, as sub-steps (`S3.1`, `S3.2`), without adding them to the spec.
- `skip <step, flow, or file>`: mark those steps `skipped`.
- `stop`: run `wt status <spec>` and tell them where they will resume.

After answering a line or a question, save the answer in one line with `wt note <spec> <step> "<text>"`.
Notes are the user's crib sheet for review, and the walk's memory after context compaction.

At the end of a flow, offer the next flow.

## 6. Close

When every step is walked or skipped, run `wt status <spec>` and print:

- Steps walked and skipped, per flow.
- Every watch-out, as a list to fix before the PR (they are on the map too).
- Every note, as a crib sheet for questions a reviewer may ask.
- The decisions with an unknown why, so the user can settle them before a reviewer asks.
