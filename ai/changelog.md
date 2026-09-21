# Skill — update the changelog

The changelog lives at [`../docs/changelog.md`](../docs/changelog.md). Append-only, newest at top, grouped by date.

## When to update

Same commit as the shipping change. Not before, not after.

## Format

```
## YYYY-MM-DD

- **{Area or backlog ID}** — one-sentence "what changed and the user-visible effect." Link to files + backlog item + ADR if any.
- **{Area or backlog ID}** — …
```

## Anti-patterns

- Code-review-style entries ("refactored foo to use bar pattern"). Write what *users or the next agent* would notice.
- Reordering or rewriting past entries.
- Squashing several ship moments into one because "they're related."
- Skipping the changelog because "the diff explains it."
