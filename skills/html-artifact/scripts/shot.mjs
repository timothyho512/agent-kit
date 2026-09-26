#!/usr/bin/env node
// Render an HTML file in the locally installed Chrome or Edge and report what a reviewer would see.
// Usage: node shot.mjs <page.html> [outDir]
// Writes desktop/phone x light/dark PNGs plus report.json, and prints the report.

import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";
import { pathToFileURL } from "node:url";

const [, , input, outArg] = process.argv;
if (!input || !existsSync(input)) {
  console.error("Usage: node shot.mjs <page.html> [outDir]");
  process.exit(2);
}
const page = resolve(input);
const outDir = resolve(outArg ?? join(dirname(page), ".shots", basename(page, ".html")));
mkdirSync(outDir, { recursive: true });

async function launch() {
  const errors = [];
  // Prefer an installed browser (laptops); fall back to Playwright's own Chromium (containers).
  for (const channel of ["chrome", "msedge", undefined]) {
    try {
      return await chromium.launch(channel ? { channel } : {});
    } catch (e) {
      errors.push(`${channel ?? "playwright chromium"}: ${e.message.split("\n")[0]}`);
    }
  }
  throw new Error(
    `No usable browser found.\n${errors.join("\n")}\n` +
      `In a container, install one with: npx --prefix <skill>/scripts playwright-core install --with-deps chromium`,
  );
}

const VIEWS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "phone", width: 400, height: 860 },
];
const THEMES = ["light", "dark"];
// Full-page shots of very long pages become unreadable thumbnails; cap the height.
const MAX_SHOT_HEIGHT = 4000;

const browser = await launch();
const report = { page, outDir, screenshots: [], consoleErrors: [], failedRequests: [], checks: {} };

for (const view of VIEWS) {
  for (const theme of THEMES) {
    const ctx = await browser.newContext({
      viewport: { width: view.width, height: view.height },
      colorScheme: theme,
      deviceScaleFactor: 1,
    });
    const tab = await ctx.newPage();
    const first = report.screenshots.length === 0;
    if (first) {
      tab.on("console", (m) => m.type() === "error" && report.consoleErrors.push(m.text()));
      tab.on("pageerror", (e) => report.consoleErrors.push(String(e)));
      tab.on("requestfailed", (r) => report.failedRequests.push(`${r.url()} (${r.failure()?.errorText})`));
    }
    await tab.goto(pathToFileURL(page).href, { waitUntil: "networkidle", timeout: 30000 }).catch((e) => {
      report.consoleErrors.push(`load: ${e.message.split("\n")[0]}`);
    });
    await tab.evaluate(() => document.fonts.ready);

    const checks = await tab.evaluate((vw) => {
      const doc = document.documentElement;
      const overflowPx = doc.scrollWidth - vw;
      // Elements whose right edge passes the viewport, excluding ones inside a horizontal scroller.
      const inScroller = (el) => {
        for (let p = el.parentElement; p; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === "auto" || ox === "scroll" || ox === "hidden") return true;
        }
        return false;
      };
      const describe = (el) =>
        el.tagName.toLowerCase() + (el.id ? `#${el.id}` : "") + (el.classList.length ? "." + [...el.classList].join(".") : "");
      const offenders = [...document.body.querySelectorAll("*")]
        .filter((el) => el.getBoundingClientRect().right > vw + 1 && !inScroller(el))
        .slice(0, 8)
        .map(describe);

      // Text clipped inside its own box.
      const clipped = [...document.body.querySelectorAll("*")]
        .filter((el) => {
          const s = getComputedStyle(el);
          return (s.overflow === "hidden" || s.textOverflow === "ellipsis") && el.scrollWidth > el.clientWidth + 1 && el.textContent.trim();
        })
        .slice(0, 8)
        .map(describe);

      // Fonts the CSS asks for that never loaded, so the browser silently fell back.
      const generic = new Set(["serif", "sans-serif", "monospace", "system-ui", "cursive", "fantasy", "ui-sans-serif", "ui-serif", "ui-monospace", "-apple-system", "blinkmacsystemfont", "inherit", "initial"]);
      const firstFamilies = new Set();
      for (const el of document.querySelectorAll("body, h1, h2, h3, p, code, pre, button, th, td, figcaption")) {
        const fam = getComputedStyle(el).fontFamily.split(",")[0].trim().replace(/["']/g, "");
        if (!generic.has(fam.toLowerCase())) firstFamilies.add(fam);
      }
      // document.fonts.check() returns true for unknown families, so measure instead:
      // a face that renders identically to both generic fallbacks is not actually available.
      const ctx2d = document.createElement("canvas").getContext("2d");
      const sample = "The quick brown fox 0123456789 WMwm";
      const width = (font) => ((ctx2d.font = `32px ${font}`), ctx2d.measureText(sample).width);
      const missingFonts = [...firstFamilies].filter(
        (f) => width(`"${f}", monospace`) === width("monospace") && width(`"${f}", serif`) === width("serif"),
      );

      const transparent = (c) => c === "rgba(0, 0, 0, 0)" || c === "transparent";
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      const htmlBg = getComputedStyle(doc).backgroundColor;

      // SVG labels that collide with other labels or with markers (circles, small rects).
      const overlap = (a, b, pad = 1) =>
        a.left < b.right - pad && b.left < a.right - pad && a.top < b.bottom - pad && b.top < a.bottom - pad;
      const svgCollisions = [];
      for (const svg of document.querySelectorAll("svg")) {
        const texts = [...svg.querySelectorAll("text")].filter((t) => t.textContent.trim());
        const marks = [...svg.querySelectorAll("circle, ellipse")];
        const tb = texts.map((t) => t.getBoundingClientRect());
        for (let i = 0; i < texts.length; i++) {
          for (let j = i + 1; j < texts.length; j++) {
            if (texts[i].contains(texts[j]) || texts[j].contains(texts[i])) continue;
            if (overlap(tb[i], tb[j])) svgCollisions.push(`"${texts[i].textContent.trim()}" overlaps "${texts[j].textContent.trim()}"`);
          }
          for (const m of marks) {
            const mb = m.getBoundingClientRect();
            // A label centered inside its own marker (e.g. a step number) is intended.
            const inside = tb[i].left >= mb.left - 2 && tb[i].right <= mb.right + 2 && tb[i].top >= mb.top - 2 && tb[i].bottom <= mb.bottom + 2;
            if (!inside && overlap(tb[i], mb, 2)) svgCollisions.push(`"${texts[i].textContent.trim()}" overlaps a circle marker`);
          }
        }
      }

      // Tracked-out ALL-CAPS labels are the commonest generated-page tell.
      const capsLabels = [...document.body.querySelectorAll("*")].filter((el) => {
        if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return false;
        const s = getComputedStyle(el);
        if (el.closest("svg, code, pre, kbd, table")) return false;
        const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
        const typedInCaps = own.length >= 4 && /[A-Z]{3}/.test(own) && !/[a-z]/.test(own) && parseFloat(s.fontSize) <= 14;
        return (s.textTransform === "uppercase" && parseFloat(s.letterSpacing) > 0.5) || typedInCaps;
      }).length;

      // Horizontal scrollers that actually hide content. Fine on a phone, a layout bug on desktop.
      const scrollersHiding = [...document.body.querySelectorAll("*")]
        .filter((el) => {
          const ox = getComputedStyle(el).overflowX;
          return (ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + 4;
        })
        .slice(0, 8)
        .map(describe);

      return {
        scrollersHiding,
        svgCollisions: svgCollisions.slice(0, 10),
        uppercaseTrackedLabels: capsLabels,
        horizontalOverflowPx: Math.max(0, overflowPx),
        overflowingElements: offenders,
        clippedText: clipped,
        missingFonts,
        bodyBackgroundTransparent: transparent(bodyBg) && transparent(htmlBg),
        colorScheme: getComputedStyle(doc).colorScheme,
        bgColor: transparent(bodyBg) ? htmlBg : bodyBg,
        pageHeightPx: doc.scrollHeight,
        title: document.title,
      };
    }, view.width);
    report.checks[`${view.name}-${theme}`] = checks;

    const file = join(outDir, `${view.name}-${theme}.png`);
    const fullHeight = Math.min(checks.pageHeightPx, MAX_SHOT_HEIGHT);
    await tab.setViewportSize({ width: view.width, height: fullHeight });
    await tab.screenshot({ path: file, clip: { x: 0, y: 0, width: view.width, height: fullHeight } });
    report.screenshots.push(file);
    await ctx.close();
  }
}
await browser.close();

const problems = [];
for (const [k, c] of Object.entries(report.checks)) {
  if (c.horizontalOverflowPx > 0) problems.push(`${k}: page scrolls sideways by ${c.horizontalOverflowPx}px (${c.overflowingElements.join(", ")})`);
  if (c.clippedText.length) problems.push(`${k}: clipped text in ${c.clippedText.join(", ")}`);
  if (c.bodyBackgroundTransparent) problems.push(`${k}: body has no background color`);
  if (k.startsWith("desktop") && c.scrollersHiding.length)
    problems.push(`${k}: content cut off inside a sideways scroller at desktop width: ${c.scrollersHiding.join(", ")}`);
  if (c.svgCollisions.length) problems.push(`${k}: diagram labels collide: ${c.svgCollisions.join("; ")}`);
}
const d = report.checks;
if (d["desktop-light"].uppercaseTrackedLabels >= 3)
  problems.push(`${d["desktop-light"].uppercaseTrackedLabels} tracked ALL-CAPS labels: an AI-design tell; use sentence case or remove labels that do not encode information`);
if (d["desktop-light"].bgColor === d["desktop-dark"].bgColor)
  problems.push(`light and dark render the same background (${d["desktop-light"].bgColor}): the page ignores the viewer's theme`);
const fonts = new Set(Object.values(report.checks).flatMap((c) => c.missingFonts));
if (fonts.size) problems.push(`fonts not loaded, browser fell back: ${[...fonts].join(", ")}`);
if (!report.checks["desktop-light"].title) problems.push("page has no <title>");
if (report.consoleErrors.length) problems.push(`console errors: ${report.consoleErrors.length}`);
if (report.failedRequests.length) problems.push(`failed requests: ${report.failedRequests.length} (blocked network or bad URL)`);
if (Object.values(report.checks).some((c) => c.pageHeightPx > MAX_SHOT_HEIGHT)) problems.push(`page is taller than ${MAX_SHOT_HEIGHT}px; screenshots show only the top`);
report.problems = problems;

writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ screenshots: report.screenshots, problems, consoleErrors: report.consoleErrors, failedRequests: report.failedRequests }, null, 2));
