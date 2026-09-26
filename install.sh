#!/usr/bin/env bash
# Install or update Timothy's Codex setup on macOS/Linux.
# Safe to rerun: installs the skills listed in skills.txt, removes ones taken off the list,
# and backs up AGENTS.md before it changes.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skills_dest="$HOME/.agents/skills"
codex_home="${CODEX_HOME:-$HOME/.codex}"
# Names of the skills this kit installed last time, so skills taken off the list get removed.
manifest="$codex_home/agent-kit-skills.txt"

# A local change wins over the plain skill, which wins over the vendored original.
resolve_skill() {
  local base
  for base in "skills/local" "skills" "skills/vendor/mattpocock"; do
    if [ -f "$repo/$base/$1/SKILL.md" ]; then
      echo "$repo/$base/$1"
      return 0
    fi
  done
  return 1
}

install_skill() {
  local src="$1"
  local name
  name="$(basename "$src")"
  local dest="$skills_dest/$name"
  # Keep installed npm packages (the html-artifact checker) so updates don't force a reinstall.
  local keep=""
  if [ -d "$dest/scripts/node_modules" ]; then
    keep="$(mktemp -d)"
    mv "$dest/scripts/node_modules" "$keep/"
  fi
  rm -rf "$dest"
  cp -R "$src" "$dest"
  if [ -n "$keep" ]; then
    mv "$keep/node_modules" "$dest/scripts/"
    rmdir "$keep"
  fi
  echo "  skill: $name <- ${src#"$repo"/}"
}

wanted=()
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%%#*}"
  line="$(echo "$line" | tr -d '[:space:]')"
  if [ -n "$line" ]; then
    wanted+=("$line")
  fi
done < "$repo/skills.txt"

# Check every name before touching anything.
sources=()
for name in "${wanted[@]}"; do
  if ! src="$(resolve_skill "$name")"; then
    echo "skills.txt lists '$name', but no skill folder has that name." >&2
    exit 1
  fi
  sources+=("$src")
done

if [ -f "$manifest" ]; then
  previous="$(cat "$manifest")"
else
  # Before the manifest existed, the installer copied every bundled skill.
  previous="$(ls "$repo/skills/vendor/mattpocock"; echo html-artifact)"
fi

echo "Installing skills into $skills_dest"
mkdir -p "$skills_dest" "$codex_home"
while IFS= read -r old; do
  if [ -n "$old" ] && [[ " ${wanted[*]} " != *" $old "* ]] && [ -f "$skills_dest/$old/SKILL.md" ]; then
    rm -rf "${skills_dest:?}/$old"
    echo "  removed: $old (not in skills.txt)"
  fi
done <<< "$previous"
for src in "${sources[@]}"; do
  install_skill "$src"
done
printf '%s\n' "${wanted[@]}" > "$manifest"

echo "Installing AGENTS.md into $codex_home"
agents_src="$repo/AGENTS.md"
agents_dest="$codex_home/AGENTS.md"
if [ -f "$agents_dest" ] && cmp -s "$agents_src" "$agents_dest"; then
  echo "  AGENTS.md: unchanged"
else
  if [ -f "$agents_dest" ]; then
    backup="$agents_dest.bak-$(date +%Y%m%d-%H%M%S)"
    cp "$agents_dest" "$backup"
    echo "  AGENTS.md: backed up existing file to $backup"
  fi
  cp "$agents_src" "$agents_dest"
  echo "  AGENTS.md: installed $agents_dest"
fi

notes="$HOME/agent-notes"
if [ ! -d "$notes" ]; then
  mkdir -p "$notes"
  echo "Created the agent notes folder $notes"
fi

html_scripts="$skills_dest/html-artifact/scripts"
echo
echo "Done."
echo "To let Codex write to the notes folder without asking each time, add this to $codex_home/config.toml once:"
echo "  [sandbox_workspace_write]"
echo "  writable_roots = [\"$notes\"]"
echo "Note: the html-artifact screenshot checker needs its dependency installed once (kept across updates):"
echo "  npm install --prefix \"$html_scripts\""
echo "It uses the playwright-core npm package, which may need approval."
echo "The skill works without it, but then it cannot see the pages it builds."
