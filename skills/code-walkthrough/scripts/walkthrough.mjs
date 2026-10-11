#!/usr/bin/env node
// Builds and checks a code walkthrough from a JSON spec. The agent writes the spec;
// this script owns the diff, coverage, code display, progress, and the map page.
// Commands: init, check, render, show, mark, watch, note, status. No dependencies beyond Node 18 and git.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const USAGE = `Usage:
  walkthrough.mjs init --base <ref> [--head <ref>] [--title <text>]   (run inside the repo)
  walkthrough.mjs check  <spec.json>
  walkthrough.mjs render <spec.json>
  walkthrough.mjs show   <spec.json> <step>
  walkthrough.mjs mark   <spec.json> <step> walked|skipped|todo
  walkthrough.mjs watch  <spec.json> <step> <text>
  walkthrough.mjs note   <spec.json> <step> <text>
  walkthrough.mjs status <spec.json>`;

// ---------- git and diff ----------

function git(cwd, args, opts = {}) {
  return execFileSync("git", ["-c", "core.quotePath=false", ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["ignore", "pipe", opts.quiet ? "ignore" : "pipe"],
  });
}

// head === null means the working tree, including uncommitted and untracked files.
function resolveRange(repo, base, head) {
  const headRef = head ?? "HEAD";
  const mergeBase = git(repo, ["merge-base", base, headRef]).trim();
  const headSha = head ? git(repo, ["rev-parse", head]).trim() : null;
  return { mergeBase, headSha };
}

function parseDiff(text) {
  const files = new Map();
  let cur = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("diff --git ")) {
      cur = { path: null, oldPath: null, added: new Set(), removed: 0, anchors: [], deleted: false, binary: false };
      continue;
    }
    if (!cur) continue;
    if (line.startsWith("--- ")) {
      cur.oldPath = line === "--- /dev/null" ? null : line.slice(6);
    } else if (line.startsWith("+++ ")) {
      if (line === "+++ /dev/null") {
        cur.deleted = true;
        cur.path = cur.oldPath;
      } else {
        cur.path = line.slice(6);
      }
      files.set(cur.path, cur);
    } else if (line.startsWith("Binary files ")) {
      const m = line.match(/ and (?:b\/)?(.+) differ$/);
      cur.binary = true;
      cur.path = m && m[1] !== "/dev/null" ? m[1] : cur.path ?? "(binary)";
      files.set(cur.path, cur);
    } else if (line.startsWith("@@")) {
      const m = line.match(/^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      const oldCount = m[1] === undefined ? 1 : Number(m[1]);
      const start = Number(m[2]);
      const newCount = m[3] === undefined ? 1 : Number(m[3]);
      for (let i = 0; i < newCount; i++) cur.added.add(start + i);
      cur.removed += oldCount;
      if (newCount === 0 && oldCount > 0) cur.anchors.push(Math.max(start, 1));
    }
  }
  return files;
}

function loadDiff(spec) {
  const repo = spec.repo;
  const { mergeBase, headSha } = resolveRange(repo, spec.base, spec.head ?? null);
  const args = ["diff", "-U0", "-M", "--no-color", "--no-ext-diff", mergeBase];
  if (headSha) args.push(headSha);
  const files = parseDiff(git(repo, args));
  if (!headSha) {
    const untracked = git(repo, ["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean);
    for (const p of untracked) {
      const buf = fs.readFileSync(path.join(repo, p));
      const entry = { path: p, oldPath: null, added: new Set(), removed: 0, anchors: [], deleted: false, binary: buf.includes(0) };
      if (!entry.binary) {
        const n = splitLines(buf.toString("utf8")).length;
        for (let i = 1; i <= n; i++) entry.added.add(i);
      }
      files.set(p, entry);
    }
  }
  return { mergeBase, headSha, files };
}

function splitLines(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

const fileCache = new Map();
function fileLines(spec, headSha, p) {
  const key = `${headSha}:${p}`;
  if (!fileCache.has(key)) {
    let text = null;
    try {
      text = headSha ? git(spec.repo, ["show", `${headSha}:${p}`], { quiet: true }) : fs.readFileSync(path.join(spec.repo, p), "utf8");
    } catch {
      text = null;
    }
    fileCache.set(key, text === null ? null : splitLines(text));
  }
  return fileCache.get(key);
}

// ---------- spec helpers ----------

function readSpec(specPath) {
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  for (const k of ["flows", "steps", "decisions", "watchouts", "notes", "ignore"]) spec[k] ??= [];
  spec.progress ??= {};
  return spec;
}

function writeSpec(specPath, spec) {
  fs.writeFileSync(specPath, JSON.stringify(spec, null, 2) + "\n");
}

// "10-42, 50-60" | "12" | "all" | "deleted" -> [[10,42],[50,60]] | "all" | "deleted"
function parseLines(value) {
  const v = String(value ?? "").trim();
  if (v === "all" || v === "deleted") return v;
  const ranges = [];
  for (const part of v.split(",")) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) return null;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (b < a) return null;
    ranges.push([a, b]);
  }
  return ranges.length ? ranges : null;
}

function stepRanges(spec, headSha, step) {
  const parsed = parseLines(step.lines);
  if (parsed === "all") {
    const lines = fileLines(spec, headSha, step.file);
    return lines ? [[1, Math.max(lines.length, 1)]] : null;
  }
  return parsed;
}

function globToRegex(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      re += ".*";
      i++;
      if (glob[i + 1] === "/") i++;
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

function ignoredReason(spec, p) {
  for (const ig of spec.ignore) if (globToRegex(ig.pattern).test(p)) return ig.reason || "ignored";
  return null;
}

function compact(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const out = [];
  for (const n of sorted) {
    const last = out[out.length - 1];
    if (last && n === last[1] + 1) last[1] = n;
    else out.push([n, n]);
  }
  return out.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(", ");
}

function hashStep(spec, headSha, step, ranges) {
  const lines = fileLines(spec, headSha, step.file);
  if (!lines || ranges === "deleted") return null;
  const h = createHash("sha1");
  for (const [a, b] of ranges) h.update(lines.slice(a - 1, b).join("\n") + "\n--\n");
  return h.digest("hex").slice(0, 12);
}

// ---------- check ----------

// Returns { problems, stale, diff }. Records a fingerprint per step so later runs can spot code that changed under a walked step.
function analyse(spec) {
  const diff = loadDiff(spec);
  const problems = [];
  const stale = [];
  const stepIds = new Set();
  const flowIds = new Set(spec.flows.map((f) => f.id));
  const decisionIds = new Set(spec.decisions.map((d) => d.id));
  const coverage = new Map(); // file -> Map(line -> stepId)

  for (const step of spec.steps) {
    if (!step.id) { problems.push(`A step has no id: ${JSON.stringify(step).slice(0, 80)}`); continue; }
    if (stepIds.has(step.id)) problems.push(`${step.id}: duplicate step id.`);
    stepIds.add(step.id);
    if (!flowIds.has(step.flow)) problems.push(`${step.id}: flow "${step.flow}" does not exist.`);
    if (!["read", "skim"].includes(step.depth)) problems.push(`${step.id}: depth must be "read" or "skim".`);
    for (const d of step.decisions ?? []) if (!decisionIds.has(d)) problems.push(`${step.id}: decision ${d} does not exist.`);
    const ranges = stepRanges(spec, diff.headSha, step);
    if (ranges === null) { problems.push(`${step.id}: cannot read lines "${step.lines}" of ${step.file}.`); continue; }
    if (ranges === "deleted") {
      const f = diff.files.get(step.file);
      if (!f || !f.deleted) problems.push(`${step.id}: lines "deleted" but ${step.file} is not deleted in this diff.`);
      continue;
    }
    const lines = fileLines(spec, diff.headSha, step.file);
    if (!lines) { problems.push(`${step.id}: ${step.file} does not exist at the head.`); continue; }
    for (const [a, b] of ranges) if (b > lines.length) problems.push(`${step.id}: ${step.file} has ${lines.length} lines, the step asks for ${a}-${b}.`);
    if (step.depth === "read") {
      const size = ranges.reduce((n, [a, b]) => n + b - a + 1, 0);
      if (size > 40) problems.push(`${step.id}: a read step spans ${size} lines; split it into steps of 25 lines or fewer, or mark it skim.`);
    }
    const map = coverage.get(step.file) ?? new Map();
    coverage.set(step.file, map);
    const f = diff.files.get(step.file);
    const clashes = new Map(); // other step -> lines
    for (const [a, b] of ranges) {
      for (let n = a; n <= b; n++) {
        if (!f || !f.added.has(n)) continue;
        const owner = map.get(n);
        if (owner && owner !== step.id) clashes.set(owner, [...(clashes.get(owner) ?? []), n]);
        else map.set(n, step.id);
      }
    }
    for (const [other, ns] of clashes) problems.push(`${step.id}: ${step.file} lines ${compact(ns)} are already in ${other}; each changed line belongs to one step.`);
    const fp = hashStep(spec, diff.headSha, step, ranges);
    if (step.seen && step.seen.lines === step.lines && fp && step.seen.hash !== fp) stale.push(step.id);
    else if (fp) step.seen = { lines: step.lines, hash: fp };
  }

  for (const d of spec.decisions) for (const s of d.steps ?? []) if (!stepIds.has(s)) problems.push(`${d.id}: step ${s} does not exist.`);
  for (const flow of spec.flows) {
    const actorIds = new Set((flow.actors ?? []).map((a) => a.id));
    for (const m of flow.messages ?? []) {
      if (!actorIds.has(m.from) || !actorIds.has(m.to)) problems.push(`Flow ${flow.id}: message "${m.label}" uses an actor that is not in actors.`);
      if (m.step && !stepIds.has(m.step)) problems.push(`Flow ${flow.id}: message "${m.label}" points at missing step ${m.step}.`);
    }
  }

  const uncovered = [];
  for (const [p, f] of diff.files) {
    if (ignoredReason(spec, p)) continue;
    if (f.binary) { uncovered.push(`${p}: binary file; add an ignore entry with a reason.`); continue; }
    if (f.deleted) {
      if (!spec.steps.some((s) => s.file === p && String(s.lines).trim() === "deleted")) uncovered.push(`${p}: deleted file; add a step with lines "deleted".`);
      continue;
    }
    const map = coverage.get(p) ?? new Map();
    const missing = [...f.added].filter((n) => !map.has(n));
    if (missing.length) uncovered.push(`${p}: changed lines ${compact(missing)} are in no step.`);
    const ranges = spec.steps.filter((s) => s.file === p).flatMap((s) => {
      const r = stepRanges(spec, diff.headSha, s);
      return Array.isArray(r) ? r : [];
    });
    for (const a of f.anchors) {
      if (!ranges.some(([x, y]) => a >= x - 1 && a <= y + 1)) uncovered.push(`${p}: lines removed after line ${a} are in no step; widen the nearest step to include line ${a}.`);
    }
  }
  for (const s of spec.steps) {
    if (s.file && !diff.files.has(s.file) && !String(s.lines).includes("deleted")) problems.push(`${s.id}: ${s.file} has no changes in this diff; context code belongs in the walk, not in a step.`);
  }
  for (const id of Object.keys(spec.progress)) if (!stepIds.has(id)) delete spec.progress[id];

  return { problems: [...problems, ...uncovered], stale, diff };
}

function cmdCheck(specPath) {
  const spec = readSpec(specPath);
  const { problems, stale } = analyse(spec);
  writeSpec(specPath, spec);
  for (const id of stale) problems.push(`${id}: its code changed since it was planned; re-plan it, then clear its "seen" field.`);
  if (!problems.length) {
    console.log(`OK: every changed line belongs to exactly one step (${spec.steps.length} steps).`);
    return;
  }
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log(`- ${p}`);
  process.exitCode = 1;
}

// ---------- init ----------

function slug(s) {
  return s.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "head";
}

function cmdInit(args) {
  const opts = {};
  for (let i = 0; i < args.length; i += 2) opts[args[i].replace(/^--/, "")] = args[i + 1];
  if (!opts.base) throw new Error("init needs --base <ref>.");
  const repo = git(process.cwd(), ["rev-parse", "--show-toplevel"]).trim();
  const branch = opts.head ?? (git(repo, ["branch", "--show-current"]).trim() || "detached");
  const dir = path.join(os.homedir(), "agent-notes", path.basename(repo), "walkthrough", slug(branch));
  const specPath = path.join(dir, "spec.json");
  if (fs.existsSync(specPath)) {
    console.log(`A spec already exists: ${specPath}`);
    console.log("Resume it: run status, then check.");
    return;
  }
  const spec = {
    title: opts.title ?? branch,
    repo,
    base: opts.base,
    head: opts.head ?? null,
    summary: "",
    ignore: [],
    flows: [],
    steps: [],
    decisions: [],
    watchouts: [],
    notes: [],
    progress: {},
  };
  const diff = loadDiff(spec);
  fs.mkdirSync(dir, { recursive: true });
  writeSpec(specPath, spec);
  let added = 0;
  let removed = 0;
  console.log(`Spec: ${specPath}`);
  console.log(`Range: ${diff.mergeBase.slice(0, 7)} (merge-base with ${opts.base}) to ${diff.headSha ? diff.headSha.slice(0, 7) : "working tree"}`);
  console.log("Changed files (+added -removed):");
  for (const [p, f] of [...diff.files].sort()) {
    added += f.added.size;
    removed += f.removed;
    console.log(`  ${f.deleted ? "deleted " : ""}${f.binary ? "binary " : ""}${p}  +${f.added.size} -${f.removed}`);
  }
  console.log(`Total: ${diff.files.size} files, +${added} -${removed}`);
  if (added > 600 || diff.files.size > 20) console.log("Size: large. Plan every flow in the spec, then walk one flow at a time.");
}

// ---------- show / mark / watch / note / status ----------

function findStep(spec, id) {
  const step = spec.steps.find((s) => s.id === id);
  if (!step) throw new Error(`No step ${id}.`);
  return step;
}

function cmdShow(specPath, id) {
  const spec = readSpec(specPath);
  const step = findStep(spec, id);
  const head = spec.head ? git(spec.repo, ["rev-parse", spec.head]).trim() : null;
  const diff = loadDiff(spec);
  const changed = diff.files.get(step.file)?.added ?? new Set();
  const flow = spec.flows.find((f) => f.id === step.flow);
  const bits = [step.id, `${step.file}:${step.lines}`, step.depth, flow ? `flow ${flow.id}` : null, (step.decisions ?? []).join(" ") || null];
  console.log(bits.filter(Boolean).join(" · "));
  for (const n of spec.notes.filter((n) => n.step === id)) console.log(`Note: ${n.text}`);
  const ranges = stepRanges(spec, head, step);
  if (!Array.isArray(ranges)) return;
  const lines = fileLines(spec, head, step.file) ?? [];
  const width = String(ranges[ranges.length - 1][1]).length;
  ranges.forEach(([a, b], i) => {
    if (i) console.log(`${" ".repeat(width)}   ...`);
    for (let n = a; n <= b && n <= lines.length; n++) console.log(`${String(n).padStart(width)} ${changed.has(n) ? "+" : " "} ${lines[n - 1]}`);
  });
}

function cmdMark(specPath, id, state) {
  const spec = readSpec(specPath);
  findStep(spec, id);
  if (state === "todo") delete spec.progress[id];
  else if (state === "walked" || state === "skipped") spec.progress[id] = state;
  else throw new Error('State must be walked, skipped, or todo.');
  writeSpec(specPath, spec);
  renderTo(specPath, spec);
  console.log(`${id}: ${state}. ${nextStepLine(spec, id)}`);
}

// Records a watch-out or a note against a step; both are shown on the map and survive context compaction.
function cmdRecord(specPath, list, id, text) {
  const spec = readSpec(specPath);
  findStep(spec, id);
  if (!text) throw new Error(`${list === "notes" ? "note" : "watch"} needs text.`);
  spec[list].push({ step: id, text });
  writeSpec(specPath, spec);
  renderTo(specPath, spec);
  console.log(`Recorded a ${list === "notes" ? "note" : "watch-out"} on ${id}.`);
}

// Prefers the next open step in the same flow as `after`, so a walk finishes one flow before moving on.
function nextStepLine(spec, after) {
  const flow = after ? spec.steps.find((s) => s.id === after)?.flow : null;
  const open = spec.steps.filter((s) => !spec.progress[s.id]);
  const next = open.find((s) => s.flow === flow) ?? open[0];
  if (next && flow && next.flow !== flow) return `Flow ${flow} is done. Next: ${next.id} in flow ${next.flow} (${next.title ?? next.file}).`;
  return next ? `Next: ${next.id} (${next.title ?? next.file}).` : "Every step is walked or skipped.";
}

function cmdStatus(specPath) {
  const spec = readSpec(specPath);
  const { problems, stale } = analyse(spec);
  writeSpec(specPath, spec);
  for (const flow of spec.flows) {
    const steps = spec.steps.filter((s) => s.flow === flow.id);
    const done = steps.filter((s) => spec.progress[s.id]).length;
    console.log(`Flow ${flow.id} ${flow.title}: ${done}/${steps.length} done`);
  }
  const skipped = spec.steps.filter((s) => spec.progress[s.id] === "skipped").map((s) => s.id);
  if (skipped.length) console.log(`Skipped: ${skipped.join(", ")}`);
  if (stale.length) console.log(`Changed since planned: ${stale.join(", ")}`);
  if (problems.length) console.log(`Check problems: ${problems.length} (run check).`);
  console.log(`Watch-outs: ${spec.watchouts.length}`);
  console.log(`Notes: ${spec.notes.length}`);
  console.log(nextStepLine(spec));
}

// ---------- render ----------

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Inline `code` spans in spec prose.
const prose = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");

const MONO_CHAR = 7.3;
const LABEL_CHAR = 7.9;
const SUB_CHAR = 6.9;

function sequenceSvg(flow, idx) {
  const actors = flow.actors ?? [];
  const messages = flow.messages ?? [];
  if (!actors.length) return "";
  const boxW = actors.map((a) => Math.max(150, a.label.length * LABEL_CHAR + 28, (a.sub ?? "").length * SUB_CHAR + 28));
  const gaps = actors.slice(1).map((_, i) => (boxW[i] + boxW[i + 1]) / 2 + 36);
  const col = new Map(actors.map((a, i) => [a.id, i]));
  const labelW = (m) => ((m.step ? m.step + "  " : "") + m.label).length * MONO_CHAR + 28;
  const sorted = [...messages].sort((x, y) => Math.abs(col.get(x.to) - col.get(x.from)) - Math.abs(col.get(y.to) - col.get(y.from)));
  let tail = 0;
  for (const m of sorted) {
    const a = Math.min(col.get(m.from), col.get(m.to));
    const b = Math.max(col.get(m.from), col.get(m.to));
    if (a === b) {
      const need = labelW(m) + 44;
      if (a < gaps.length) gaps[a] = Math.max(gaps[a], need + boxW[a + 1] / 2);
      else tail = Math.max(tail, need - boxW[a] / 2);
      continue;
    }
    let span = 0;
    for (let i = a; i < b; i++) span += gaps[i];
    const deficit = labelW(m) - span;
    if (deficit > 0) for (let i = a; i < b; i++) gaps[i] += deficit / (b - a);
  }
  const margin = 12;
  const xs = [margin + boxW[0] / 2];
  gaps.forEach((g) => xs.push(xs[xs.length - 1] + g));
  const width = Math.ceil(xs[xs.length - 1] + boxW[boxW.length - 1] / 2 + margin + Math.max(tail, 0));
  const top = 8;
  const boxH = 54;
  const firstY = top + boxH + 42;
  const rowH = 46;
  const height = firstY + Math.max(messages.length - 1, 0) * rowH + 30;
  const marker = `arrow-${idx}`;
  const parts = [];
  parts.push(`<defs><marker id="${marker}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>`);
  actors.forEach((a, i) => {
    const x = xs[i];
    parts.push(`<line x1="${x}" y1="${top + boxH}" x2="${x}" y2="${height - 8}" stroke="var(--line-strong)" stroke-dasharray="3 4"/>`);
    parts.push(`<rect x="${x - boxW[i] / 2}" y="${top}" width="${boxW[i]}" height="${boxH}" rx="6" fill="var(--surface)" stroke="currentColor"/>`);
    parts.push(`<text x="${x}" y="${top + 23}" text-anchor="middle" font-size="13.5" font-weight="600" fill="var(--text)">${esc(a.label)}</text>`);
    if (a.sub) parts.push(`<text x="${x}" y="${top + 42}" text-anchor="middle" font-size="12" fill="var(--muted)">${esc(a.sub)}</text>`);
  });
  messages.forEach((m, k) => {
    const y = firstY + k * rowH;
    const x1 = xs[col.get(m.from)];
    const x2 = xs[col.get(m.to)];
    const dash = m.kind === "return" ? ` stroke-dasharray="5 4"` : "";
    const label = `${m.step ? `<tspan fill="var(--accent)" font-weight="600">${esc(m.step)}</tspan>  ` : ""}${esc(m.label)}`;
    const linked = (inner) => (m.step ? `<a href="#${esc(m.step)}">${inner}</a>` : inner);
    if (x1 === x2) {
      parts.push(`<path d="M${x1},${y - 10} h28 v20 h-26" fill="none" stroke="currentColor" stroke-width="1.4"${dash} marker-end="url(#${marker})"/>`);
      parts.push(linked(`<text class="msg" x="${x1 + 36}" y="${y + 4}">${label}</text>`));
    } else {
      parts.push(`<line x1="${x1}" y1="${y}" x2="${x2 + (x2 > x1 ? -1 : 1)}" y2="${y}" stroke="currentColor" stroke-width="1.4"${dash} marker-end="url(#${marker})"/>`);
      parts.push(linked(`<text class="msg" x="${Math.min(x1, x2) + 12}" y="${y - 8}">${label}</text>`));
    }
  });
  const aria = `Sequence of calls in flow ${flow.id}: ${messages.map((m) => `${m.from} to ${m.to}, ${m.label}`).join("; ")}`;
  return `<svg class="seq" role="img" aria-label="${esc(aria)}" viewBox="0 0 ${width} ${height}" style="color: var(--text); width: 100%; max-width: ${width}px; height: auto;">${parts.join("")}</svg>`;
}

function flowList(flow) {
  const name = new Map((flow.actors ?? []).map((a) => [a.id, a.label]));
  return `<ol class="seq-list">${(flow.messages ?? [])
    .map((m) => `<li>${m.step ? `<a href="#${esc(m.step)}">${esc(m.step)}</a> ` : ""}<b>${esc(name.get(m.from))}</b> to <b>${esc(name.get(m.to))}</b>: <code>${esc(m.label)}</code></li>`)
    .join("")}</ol>`;
}

function renderHtml(spec, analysis) {
  const { diff, problems, stale } = analysis;
  const staleSet = new Set(stale);
  let added = 0;
  let removed = 0;
  for (const f of diff.files.values()) { added += f.added.size; removed += f.removed; }
  const readSteps = spec.steps.filter((s) => s.depth === "read");
  const done = spec.steps.filter((s) => spec.progress[s.id]).length;
  const stepCount = (s) => {
    const r = stepRanges(spec, diff.headSha, s);
    return Array.isArray(r) ? r.reduce((n, [a, b]) => n + b - a + 1, 0) : 0;
  };
  const statusCell = (s) => {
    if (staleSet.has(s.id)) return `<span class="st st-stale">changed</span>`;
    const p = spec.progress[s.id];
    return p ? `<span class="st st-${p}">${p}</span>` : `<span class="st">to do</span>`;
  };
  const decisionLinks = (ids) => (ids ?? []).map((d) => `<a href="#${esc(d)}">${esc(d)}</a>`).join(", ");
  const stepLinks = (ids) => (ids ?? []).map((s) => `<a href="#${esc(s)}">${esc(s)}</a>`).join(", ");

  const flowsHtml = spec.flows.map((flow, i) => {
    const steps = spec.steps.filter((s) => s.flow === flow.id);
    const rows = steps.map((s) => `<tr id="${esc(s.id)}" class="${s.depth}">
      <td class="sid">${esc(s.id)}</td>
      <td><div class="title">${prose(s.title)}</div><div class="loc">${esc(s.file)}:${esc(s.lines)}</div></td>
      <td>${prose(s.what)}${spec.notes.filter((n) => n.step === s.id).map((n) => `<div class="rownote"><b>Note</b> ${prose(n.text)}</div>`).join("")}</td>
      <td><span class="depth depth-${esc(s.depth)}">${esc(s.depth)}</span><div class="n">${stepCount(s)} lines</div></td>
      <td>${decisionLinks(s.decisions) || ""}</td>
      <td>${statusCell(s)}</td></tr>`).join("");
    const doneHere = steps.filter((s) => spec.progress[s.id]).length;
    return `<section class="flow" id="flow-${esc(flow.id)}">
      <h2><span class="fid">Flow ${esc(flow.id)}</span> ${prose(flow.title)}</h2>
      <p class="trigger">${prose(flow.trigger)}</p>
      <p class="meta">${steps.length} steps, ${doneHere} done</p>
      ${(flow.messages ?? []).length ? `<figure><div class="fig-wide">${sequenceSvg(flow, i)}</div><div class="fig-narrow">${flowList(flow)}</div>
      <figcaption>Calls run top to bottom. Solid arrows are calls, dashed arrows are returns. Click a step number to jump to its row.</figcaption></figure>` : ""}
      <div class="table-wrap"><table class="steps"><thead><tr><th>Step</th><th>Code</th><th>What it does</th><th>Depth</th><th>Decisions</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
    </section>`;
  }).join("");

  const decisionsHtml = spec.decisions.map((d) => `<li id="${esc(d.id)}"><h3><span class="did">${esc(d.id)}</span>${prose(d.title)}</h3><dl>
      <dt>Chosen</dt><dd>${prose(d.chosen)}</dd>
      <dt>Alternative</dt><dd>${prose(d.alternative)}</dd>
      <dt>Why</dt><dd>${d.why ? prose(d.why) : `<b class="unknown">Unknown: decide whether you agree.</b>`}</dd>
      <dt>Steps</dt><dd>${stepLinks(d.steps)}</dd></dl></li>`).join("");

  const recordList = (sectionId, heading, items) => items.length
    ? `<section id="${sectionId}"><h2>${heading}</h2><ul class="watch">${items.map((w) => `<li><a href="#${esc(w.step)}">${esc(w.step)}</a> ${prose(w.text)}</li>`).join("")}</ul></section>`
    : "";
  const watchHtml = recordList("watch", "Watch-outs", spec.watchouts);
  // Notes follow walk order, so the list reads like the walk did.
  const order = new Map(spec.steps.map((s, i) => [s.id, i]));
  const notesHtml = recordList("notes", "Notes", spec.notes.map((n, i) => ({ ...n, i })).sort((a, b) => (order.get(a.step) ?? 0) - (order.get(b.step) ?? 0) || a.i - b.i));

  const fileRows = [...diff.files].sort(([a], [b]) => a.localeCompare(b)).map(([p, f]) => {
    const reason = ignoredReason(spec, p);
    const steps = spec.steps.filter((s) => s.file === p).map((s) => s.id);
    return `<tr><td class="loc">${esc(p)}${f.deleted ? " (deleted)" : ""}</td><td class="num">+${f.added.size}</td><td class="num">-${f.removed}</td><td>${reason ? `<span class="muted">Not walked: ${prose(reason)}</span>` : stepLinks(steps)}</td></tr>`;
  }).join("");

  const problemsHtml = problems.length || stale.length
    ? `<div class="problems" role="alert"><b>The plan does not match the code yet.</b><ul>${[...problems, ...stale.map((s) => `${s}: code changed since it was planned.`)].map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>`
    : "";

  const range = `${diff.mergeBase.slice(0, 7)} to ${diff.headSha ? diff.headSha.slice(0, 7) : "working tree"}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(spec.title)} Walkthrough</title>
<style>
:root {
  color-scheme: light;
  --bg: #f5f6f4; --surface: #ffffff; --text: #1c2321; --muted: #5c6763; --line: #d8ddd9; --line-strong: #aab3ae;
  --accent: #0f6a64; --accent-soft: #e2efec; --code-bg: #ebeeec; --target: #fff3c9;
  --ok: #2f6b2f; --ok-bg: #e4f0e1; --warn: #8a4b00; --warn-bg: #fdf0dc; --skip-bg: #ecebf3; --skip: #4b4870;
  --font-body: system-ui, "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;
  --font-mono: "Cascadia Mono", Consolas, ui-monospace, "SF Mono", Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --bg: #121715; --surface: #1a201e; --text: #e3e8e5; --muted: #98a49e; --line: #2d3633; --line-strong: #4a5551;
    --accent: #56c2b6; --accent-soft: #1d3330; --code-bg: #232b28; --target: #3b3519;
    --ok: #9fd39a; --ok-bg: #213321; --warn: #f0b764; --warn-bg: #3a2b14; --skip-bg: #282739; --skip: #b9b5e6;
  }
}
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.55 var(--font-body); }
.page { max-width: 80rem; margin-inline: auto; padding: 32px max(16px, 3vw) 64px; }
h1 { font-size: 28px; line-height: 1.2; margin: 0 0 8px; text-wrap: balance; }
h2 { font-size: 21px; line-height: 1.3; margin: 0 0 6px; text-wrap: balance; }
h3 { font-size: 16px; margin: 0 0 8px; }
p { margin: 0 0 10px; max-width: 75ch; }
a { color: var(--accent); }
code, .loc, .sid, .did, .fid { font-family: var(--font-mono); }
code { font-size: 0.9em; background: var(--code-bg); padding: 1px 5px; border-radius: 4px; }
.meta, .muted, .n { color: var(--muted); }
.n { font-size: 12px; }
.facts { display: flex; flex-wrap: wrap; gap: 6px 22px; list-style: none; padding: 0; margin: 14px 0 0; font-variant-numeric: tabular-nums; }
.facts b { font-weight: 600; }
nav.flows { margin: 24px 0 8px; display: flex; flex-wrap: wrap; gap: 8px; }
nav.flows a { text-decoration: none; padding: 4px 10px; border: 1px solid var(--line); border-radius: 999px; background: var(--surface); }
.problems { margin: 20px 0; padding: 14px 16px; border: 1px solid var(--warn); background: var(--warn-bg); color: var(--text); border-radius: 8px; }
.problems ul { margin: 6px 0 0; padding-left: 20px; }
section { margin-top: 44px; }
.fid { color: var(--accent); margin-right: 6px; }
.trigger { font-size: 16px; }
figure { margin: 14px 0 16px; padding: 14px; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; overflow-x: auto; }
figcaption { color: var(--muted); font-size: 13px; margin-top: 8px; }
svg.seq { display: block; font-family: var(--font-body); }
svg.seq .msg { font-family: var(--font-mono); font-size: 12px; fill: var(--text); paint-order: stroke; stroke: var(--surface); stroke-width: 5px; stroke-linejoin: round; }
svg.seq a:hover .msg, svg.seq a:focus-visible .msg { text-decoration: underline; }
.fig-narrow { display: none; }
.seq-list { margin: 0; padding-left: 22px; }
.seq-list li { margin-bottom: 4px; }
.table-wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; }
table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; vertical-align: top; padding: 9px 12px; border-bottom: 1px solid var(--line); }
th { font-size: 12.5px; font-weight: 600; color: var(--muted); background: var(--bg); white-space: nowrap; }
tbody tr:last-child td { border-bottom: 0; }
tr:target td { background: var(--target); }
td.sid { font-weight: 600; color: var(--accent); white-space: nowrap; }
.steps .title { font-weight: 600; }
.loc { font-size: 12.5px; color: var(--muted); overflow-wrap: anywhere; }
.steps td:nth-child(2) { min-width: 16rem; }
.steps td:nth-child(3) { min-width: 18rem; }
tr.skim .title { font-weight: 400; }
.depth { font-size: 12px; font-weight: 600; padding: 1px 8px; border-radius: 999px; white-space: nowrap; }
.depth-read { background: var(--accent-soft); color: var(--accent); }
.depth-skim { background: var(--code-bg); color: var(--muted); }
.st { font-size: 12px; white-space: nowrap; color: var(--muted); }
.st-walked { color: var(--ok); background: var(--ok-bg); padding: 1px 8px; border-radius: 999px; font-weight: 600; }
.st-skipped { color: var(--skip); background: var(--skip-bg); padding: 1px 8px; border-radius: 999px; font-weight: 600; }
.st-stale { color: var(--warn); background: var(--warn-bg); padding: 1px 8px; border-radius: 999px; font-weight: 600; }
.decisions { list-style: none; padding: 0; margin: 12px 0 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 30rem), 1fr)); gap: 12px; }
.decisions li { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; }
.decisions li:target { background: var(--target); }
.did { color: var(--accent); margin-right: 8px; }
.decisions dl { display: grid; grid-template-columns: 6.5rem 1fr; gap: 4px 12px; margin: 0; }
.decisions dt { color: var(--muted); font-size: 13.5px; }
.decisions dd { margin: 0; }
.unknown { color: var(--warn); }
.watch { margin: 10px 0 0; padding-left: 20px; }
.watch li { margin-bottom: 6px; max-width: 90ch; }
.rownote { margin-top: 6px; font-size: 13.5px; color: var(--muted); }
.rownote b { color: var(--accent); font-weight: 600; margin-right: 4px; }
td.num { font-variant-numeric: tabular-nums; white-space: nowrap; }
@media (max-width: 720px) {
  .fig-wide { display: none; } .fig-narrow { display: block; }
  table.steps thead { display: none; }
  table.steps tr, table.steps td { display: block; }
  table.steps tr { border-bottom: 1px solid var(--line); padding: 8px 0; }
  table.steps td { border: 0; padding: 2px 12px; min-width: 0 !important; }
  .decisions dl { grid-template-columns: 1fr; }
}
</style></head>
<body><main class="page">
<header>
  <h1>${esc(spec.title)}</h1>
  ${spec.summary ? `<p>${prose(spec.summary)}</p>` : ""}
  <p class="meta">Range ${esc(range)}. The terminal walk uses the same step (S) and decision (D) numbers as this page. Refresh after each step to see progress.</p>
  <ul class="facts">
    <li><b>${diff.files.size}</b> files</li>
    <li><b>+${added}</b> / <b>-${removed}</b> lines</li>
    <li><b>${spec.flows.length}</b> flow${spec.flows.length === 1 ? "" : "s"}</li>
    <li><b>${spec.steps.length}</b> steps (${readSteps.length} read, ${spec.steps.length - readSteps.length} skim)</li>
    <li><b>${spec.decisions.length}</b> decision${spec.decisions.length === 1 ? "" : "s"}</li>
    <li><b>${done}</b> of ${spec.steps.length} done</li>
  </ul>
</header>
${problemsHtml}
<nav class="flows" aria-label="Flows">${spec.flows.map((f) => `<a href="#flow-${esc(f.id)}">Flow ${esc(f.id)}: ${esc(f.title)}</a>`).join("")}<a href="#decisions">Decisions</a>${spec.watchouts.length ? `<a href="#watch">Watch-outs</a>` : ""}${spec.notes.length ? `<a href="#notes">Notes</a>` : ""}<a href="#files">Files</a></nav>
${flowsHtml}
<section id="decisions"><h2>Decisions</h2><ul class="decisions">${decisionsHtml}</ul></section>
${watchHtml}
${notesHtml}
<section id="files"><h2>Changed files</h2><div class="table-wrap"><table><thead><tr><th>File</th><th>Added</th><th>Removed</th><th>Steps</th></tr></thead><tbody>${fileRows}</tbody></table></div></section>
</main></body></html>
`;
}

function renderTo(specPath, spec) {
  const analysis = analyse(spec);
  const out = path.join(path.dirname(specPath), "map.html");
  fs.writeFileSync(out, renderHtml(spec, analysis));
  return { out, analysis };
}

function cmdRender(specPath) {
  const spec = readSpec(specPath);
  const { out, analysis } = renderTo(specPath, spec);
  writeSpec(specPath, spec);
  console.log(`Map: ${out}`);
  if (analysis.problems.length) console.log(`The map shows ${analysis.problems.length} check problem(s) at the top; run check.`);
}

// ---------- main ----------

const [cmd, ...rest] = process.argv.slice(2);
try {
  switch (cmd) {
    case "init": cmdInit(rest); break;
    case "check": cmdCheck(rest[0]); break;
    case "render": cmdRender(rest[0]); break;
    case "show": cmdShow(rest[0], rest[1]); break;
    case "mark": cmdMark(rest[0], rest[1], rest[2]); break;
    case "watch": cmdRecord(rest[0], "watchouts", rest[1], rest.slice(2).join(" ")); break;
    case "note": cmdRecord(rest[0], "notes", rest[1], rest.slice(2).join(" ")); break;
    case "status": cmdStatus(rest[0]); break;
    default: console.log(USAGE); process.exitCode = cmd ? 1 : 0;
  }
} catch (e) {
  console.error(`walkthrough: ${e.message}`);
  process.exitCode = 1;
}
