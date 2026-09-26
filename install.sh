#!/usr/bin/env bash
# Install or update Timothy's Codex setup on macOS/Linux.
# Safe to rerun: skills are replaced wholesale, AGENTS.md is backed up before it changes.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skills_dest="$HOME/.agents/skills"
codex_home="${CODEX_HOME:-$HOME/.codex}"

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
  echo "  skill: $name -> $dest"
}

echo "Installing skills into $skills_dest"
mkdir -p "$skills_dest"
install_skill "$repo/skills/html-artifact"
for dir in "$repo"/skills/vendor/mattpocock/*/; do
  install_skill "${dir%/}"
done

echo "Installing AGENTS.md into $codex_home"
mkdir -p "$codex_home"
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

html_scripts="$skills_dest/html-artifact/scripts"
echo
echo "Done."
echo "Note: the html-artifact screenshot checker needs its dependency installed once (kept across updates):"
echo "  npm install --prefix \"$html_scripts\""
echo "It uses the playwright-core npm package, which may need approval."
echo "The skill works without it, but then it cannot see the pages it builds."
