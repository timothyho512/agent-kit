# Design fundamentals

These apply to every page.
Precedence: the user's own words first, then the project's existing design system (tokens, theme files, component styles), then these rules.

## Document skeleton

Start every page from this shape and fill it in:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Short Specific Name</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=...&display=swap">
<style>
  :root {
    color-scheme: light;
    --bg: #...; --surface: #...; --text: #...; --muted: #...; --line: #...; --accent: #...;
  }
  @media (prefers-color-scheme: dark) {
    :root { color-scheme: dark; --bg: #...; --surface: #...; --text: #...; --muted: #...; --line: #...; --accent: #...; }
  }
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 var(--font-body); }
  .page { max-width: 72rem; margin-inline: auto; padding-inline: max(16px, 4vw); padding-block: 48px; }
</style>
</head>
<body>
<main class="page">...</main>
</body>
</html>
```

## Title

The `<title>` is a name: a short noun phrase of two to four words, specific to the subject.
Never a category label ("Report", "Overview"), and never a name plus an explanation after a dash or colon.

## Typography

- Pick faces deliberately for the subject, not the ones you would use on any project.
  Inter, Roboto, Space Grotesk, and Arial are the "safe default" tells.
- One or two families; if two, make them clearly different (for example a serif display with a sans body).
- Google Fonts may be blocked on corporate networks.
  Always give a real fallback stack, for example `"Source Serif 4", Georgia, "Times New Roman", serif`.
  If the checker reports fonts not loaded, the page must still look intentional with the fallback, or switch to a well-chosen system stack.
- Set a type scale (for example 14 / 16 / 20 / 28 / 40) and keep to it.
- Running text about 65 characters wide (`max-width: 65ch`).
- Headings get `text-wrap: balance`; body text gets line-height 1.5 to 1.7.
- Use `font-variant-numeric: tabular-nums` wherever digits line up.

## Color and both themes

- Define every color once as a token on bare `:root`; redefine only the tokens inside `@media (prefers-color-scheme: dark)`.
- Never give a color its only definition inside the dark block, and never hard-code a color on a component.
- `body` always sets `background: var(--bg)`.
- Neutrals: a grey with a slight hue bias toward the accent looks chosen; a pure mid-grey looks unconsidered.
- One accent hue, used sparingly for what matters.
  Semantic colors (success, warning, danger) are separate from the accent.
- Design the dark theme with the same care: keep contrast legible and make sure the accent still works on the dark ground.
  Do not just invert.

## Layout and spacing

- Lay out sibling groups with flex or grid and `gap`, not per-element margins.
- Keep at least a 16px side gutter at every width, set once on the outer wrapper.
- At 400px width, rows wrap or stack to one column.
  Nothing may have a `min-width` wider than the screen.
- Only wide tables, code blocks, and diagrams may be wider than the screen, each inside its own `overflow-x: auto` container.
  The page itself must never scroll sideways.
- Repeated elements (cards in a row, label/value pairs) share edges, baselines, and inner padding.
- Pick a column count the items actually fill; never leave one item alone in a row.
- Border, fill, radius, and shadow mark an element as a separate object.
  Apply them by role to set off what needs it, not uniformly to every block.

## Structure is information

- Numbered markers (01 / 02 / 03) only when the content is a real sequence.
- Eyebrow labels, dividers, badges only when they encode something true.
- Put the summary before the detail: the first screen should answer "what is this and what matters".
- Tables for records, figures for mechanisms and flows, prose only for rationale and trade-offs.
- Code, commands, and file paths in a monospace face with a subtle surface, copy-pasteable.

## The page is complete at rest

- Everything is visible on load; nothing sits at `opacity: 0` waiting for scroll.
- Size the opening to its content, never `100vh`.
- A tool or dashboard opens with realistic example data, clearly marked as example.
- Motion: at most one deliberate moment; respect `prefers-reduced-motion`.

## AI tells to avoid (unless the user asks for them)

- Warm cream background with a serif display and a terracotta accent.
- Near-black background with one acid-green or vermilion accent.
- Purple-to-blue gradient hero on white.
- Every block in an identical rounded card with the same soft shadow; `rounded-lg` everywhere; an accent rail on the left of rounded cards.
- Tracked-out ALL-CAPS eyebrow above every heading.
- Emoji as section markers or bullets.
- Everything centered.
- Meta strings joined with middle dots, labels like "WORD - fragment", an arrow appended to every link.
- A big-number stat row with a gradient, when the numbers are not the point.
- Fade-and-slide-up on every section, hover effects on every card.
- One word in the headline accented with a different color or italic.

## Copy

- Write from the reader's side: name things by what they recognize, not by internal system names.
- Active voice, plain verbs, sentence case, no filler.
- Specific beats clever.
  Avoid "not X, but Y" framing, colon-then-reveal sentences, and stock phrases like "worth noting" or "deep dive".
- Buttons say exactly what happens ("Copy command"), and the result uses the same word ("Copied").

## Build cleanly

- Close every element, double-quote attributes.
- Visible keyboard focus on every interactive element.
- Watch selector specificity so section and component rules do not cancel each other's spacing.
- No external images; inline SVG or data URIs only.
- Libraries only when they do substantial work; load a pinned version from cdnjs or jsdelivr and expect that the network may block it (the page must still read without it).
