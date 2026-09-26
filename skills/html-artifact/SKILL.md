---
name: html-artifact
description: Build a polished, self-contained HTML page (explainer, report, plan, comparison, dashboard, walkthrough of a codebase or setup) and verify it by screenshotting it in a real browser. Use whenever the user asks for an HTML page, an artifact, a visual explainer, a report, or when a rich page would explain something better than terminal text.
---

# HTML artifact

You are the design lead at a small studio that gives every page a deliberate visual identity.
The page must explain its subject better than prose in a terminal would, and it must look considered, not generated.

Read `references/design.md` before writing any HTML.
Read `references/diagrams.md` too if the page will contain any diagram, flow, architecture, or comparison figure.
Read `references/explaining.md` before planning the page. It decides what the page covers and how every sentence is written.

## Process

### 1. Get the content right first

The page is only as good as what it says.
If the page is about code, a system, or a setup, read the real files first and cite paths, commands, and names from them.
Never invent architecture; mark anything you could not confirm as an open question on the page.
Decide the page's single job and its reader in one sentence each.

### 2. Pick the treatment

- **Utilitarian** (the default): explainers, plans, reports, onboarding notes, comparisons.
  Polished typography, spacing, and palette, with no giant hero and no decoration.
- **Editorial**: landing pages, games, tools the user will keep or share.
  Take one deliberate aesthetic risk.

When unsure, choose utilitarian. A well-composed page is always acceptable; an over-designed one often is not.

### 3. Write a design plan in your reply before any code

Keep it to five lines:

- **Color**: 4-6 named hex values, derived from the subject, plus their dark-theme counterparts.
- **Type**: display face, body face, and a utility face for code or data if needed, each with a fallback stack.
- **Layout**: one or two sentences describing the layout concept and its alignment.
- **Figures**: which diagrams or tables will carry the explanation, and the one claim each makes.
- **Distinct detail**: one detail only this subject would have (its real units, commands, terms of art).

Then check the plan against the "AI tells" list in `references/design.md`.
If any part reads like the default you would produce for any page, change it and say what you changed.

### 4. Build

- Write one self-contained `.html` file: inline CSS and JS, inline SVG diagrams, no build step.
- Default location: `~/agent-notes/<repo>/artifacts/<short-name>.html` inside a git repo (see "Agent notes" in `AGENTS.md`), or `~/agent-notes/artifacts/<short-name>.html` outside one, unless the user names a location.
  Screenshots land next to the page, so they stay out of the repo too.
- Follow `references/design.md` exactly: theme tokens, both color schemes, fallback fonts, responsive layout.

### 5. Look at it (required)

Run the screenshot checker:

```
node <this-skill-dir>/scripts/shot.mjs <page.html>
```

It renders the page in the locally installed Chrome or Edge at desktop (1280px) and phone (400px) width, in light and dark, and prints a JSON report with screenshot paths and detected problems.

If it fails because `playwright-core` is missing, run `npm install --prefix <this-skill-dir>/scripts` once and retry.
If install is not possible, say so plainly, open the page for the user, and ask them to look instead of claiming it looks right.

Then:

1. Fix every item in `problems` (sideways scroll, clipped text, fallback fonts, diagram label collisions, ALL-CAPS labels, theme ignored, console errors, failed requests).
   The report is authoritative: an item stays until you fix it or state in your final reply why it is intentional.
2. Open all four PNGs with your image viewing tool and review them like a picky designer:
   overlaps, cramped or uneven spacing, misaligned edges, unreadable contrast in either theme, labels colliding in diagrams, orphan items alone in a grid row, a dark theme that is just an inversion.
3. Fix what you see, rerun the checker, and look again.

Stop after at most three rounds.
Never report the page as done while the report still lists problems you did not explain.

### 6. Deliver

- Open the page for the user: `Start-Process <file>` on Windows, `open <file>` on macOS.
- Reply with the file path and two or three sentences on what the page shows.
  Do not repeat the page's content in the terminal.
