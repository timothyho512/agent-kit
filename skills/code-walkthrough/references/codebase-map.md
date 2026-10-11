# Codebase map

The user is new to this code and needs to start a ticket in it.
The goal: after the map and the walk they know the main flows, where things live, the conventions a change must follow, and the traps.
Every line is the wrong goal here; the places that teach the area are the right one.

## 1. Start or resume

Run `wt init --map --scope <path>[,<path>...]` inside the repo, scoped to the area the user named (a feature folder, a module, a backend and its frontend).
Leave out `--scope` only for a small repo or a whole-repo overview.
The spec is pinned to the current commit, so line numbers stay true while the user keeps working.
`init` prints the spec path and the files and lines per folder.

If `init` says a spec already exists, this is a resume: run `wt status <spec>` and `wt check <spec>`, then go to step 5 of the skill at the next step `status` names.

## 2. Plan the spec

Read `references/spec.md` for the format; a codebase spec adds `areas` and has no `ignore`.

1. Read the area's README and docs, the build file (its dependencies name the frameworks), the entry points (controllers, routes, handlers, `main`), and the config.
2. Write the **areas**: 5 to 15 folders or files, in layer order, each with a one-line `role`: what it holds, then which kind of change starts there ("Change here to add a browse parameter").
   Include the tests worth reading first.
   An area path that holds no step is fine: it tells the user where to look.
3. Trace 2 to 5 **flows**: the most important things the area does, each from its trigger through the layers, drawn as actors and messages exactly as for a change.
4. Pick 10 to 30 **steps**: the places in those flows worth reading, in the order the code runs.
   A read step is one function or section of 25 lines or fewer, where the work happens or something is non-obvious; wiring and config are skim.
   A step may sit in any file at the pinned commit, inside or outside the scope.
   Every message's `step` points at the step holding that call.
5. Write the **conventions** in `decisions`: patterns this code follows that a newcomer's change must follow too, or would get wrong.
   `chosen` is what this code does, `alternative` is what a newcomer would likely do instead, `why` comes from docs, comments, or ADRs, else null.
   Link each to the steps that show it.
6. Record each **gotcha** with `wt watch <spec> <step> "<text>"`: what would bite someone on their first change, such as hidden coupling, a surprising default, or generated code that must not be edited.

Base every claim on code you read at the pinned commit, never on what the framework or project usually does.
