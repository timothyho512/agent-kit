# Diagrams

Draw as the engineer who has to live with the decision, not as a decorator.
A diagram earns its place when it lets a cold reader see a mechanism they would otherwise assemble from prose: where data flows, which components talk, what changes between two options, what states a request moves through.
If a sentence says it faster, write the sentence.

## What to draw

- **The mechanism, not its name.** A box labeled "cache" says less than the path a request takes through it and the two stores it sits between.
- **One concept per figure.** A sequence of simple figures that builds understanding step by step beats one dense figure.
  For a large system, draw a small overview, then put detail in cards or tables below it.
- **Comparing options: draw the difference.** Before and after side by side, with the one edge each option adds or removes made obvious.
- **Label every arrow** with what flows or happens: `writes`, `reads token`, `polls every 30s`.
  An unlabeled arrow means "related somehow".
- **Lead with the question** the figure answers, in the caption.
- **Uncertain relationships** are drawn dashed and labeled as a question.
- Assume the reader knows nothing about the system.

## Inline SVG mechanics

Hand-author inline `<svg>` with native shapes (`rect`, `circle`, `line`, `path`, `polygon`) and `<text>`.
Do not build boxes-and-arrows from divs, and do not use Mermaid unless asked: it gives up control of position, size, and emphasis.

- Size by `viewBox="0 0 W H"` and CSS `width: 100%; height: auto; max-width: <natural width>px`.
  Keep every element inside the viewBox, including the outermost labels.
- Theme through `currentColor` and CSS variables.
  Put `style="color: var(--text)"` on the `<svg>` and use `stroke="currentColor"`, `fill="var(--surface)"`, `fill="var(--accent)"` inside, so both themes work.
  Give every shape an explicit fill (use `fill="none"` for outlines).
- Arrowheads: a `<marker>` in `<defs>` with `fill="currentColor"`, referenced by `marker-end="url(#arrow)"`.
  Use unique marker ids per figure when a page has several SVGs.
- Text: 12 to 14px at drawn scale, `text-anchor` for alignment, labels of one to three words.
  SVG text does not wrap, so explanations go in the `<figcaption>`, not in the drawing.
- Align to a grid: shared baselines and even gaps make a hand-drawn diagram read as deliberate.
- Reserve the accent color for the one element the figure is about.
- Wrap each figure as `<figure><svg role="img" aria-label="...">...</svg><figcaption>...</figcaption></figure>`, and put the figure inside an `overflow-x: auto` container if it has a large minimum readable width.
- Keep every label clear of other labels and of circle markers; the checker reports collisions.
  Put step-number circles beside a label, never on top of it.

## Phone width

A wide figure (viewBox wider than about 640) is unreadable when scaled to 400px, and a horizontal scroller shows only one slice of it.
For any figure that carries the explanation, draw a second, vertical variant for narrow screens and switch between them with CSS:

```css
.fig-narrow { display: none; }
@media (max-width: 640px) { .fig-wide { display: none; } .fig-narrow { display: block; } }
```

For a sequence of messages between actors, the narrow variant is a vertical list of steps, each showing `from → to`, the message, and its key values.
Use horizontal scrolling only for figures that are secondary.
