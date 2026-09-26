# Local skill changes

Skills here replace the vendored skill of the same name at install time.
Each one is a copy of the upstream skill with the smallest change that fits Timothy's Codex setup.
The originals in `skills/vendor/` stay byte-identical to upstream, so updates stay a clean diff.

## grill-with-docs

Upstream: `skills/vendor/mattpocock/grill-with-docs/SKILL.md`.
Upstream says "Call the Skill tool twice, for grilling and domain-modeling".
Codex has no Skill tool, so this copy tells it to read both skills' `SKILL.md` files from the neighbouring folders instead.
`agents/openai.yaml` is unchanged.
