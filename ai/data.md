# Skill — add a new data source

Before importing a new dataset into `data/`, do the research + ADR in the open. Research lands before import; the two are separate backlog items.

## When to use this skill

- Adding a new crime data source (e.g., a non-TPS provincial feed).
- Adding a non-crime data source the dashboard depends on (e.g., population denominators per [ADR-002](../project/decisions/002-present-rates-not-counts.md)).
- Switching the source for an existing series. The old write-up moves to a "Parked" subsection; it is not patched in place.

## The workflow

1. **Research.** Identify the source, read its license/terms in full (not a summary), confirm coverage years, refresh cadence, geography basis, and fitness for the brief.
   - Output: a new section in [`../docs/data-sources.md`](../docs/data-sources.md) with the structure: source URL · license · coverage (years, geography, granularity) · refresh cadence · file format and columns we need · caveats · planned import path under `/data/<topic>/` · validation contract for the eventual importer.
2. **ADR if load-bearing.** If a real choice was made (which of two sources, which geography basis, what to do about missing years), write an ADR under [`../project/decisions/`](../project/decisions/). Use the next sequential number. Don't ADR everything — only choices future work will be tempted to relitigate.
3. **Backlog.** Add the research and the import as separate items (`P1.Xa · Research <source>` → `P1.Xb · Import <source>`), with the import blocked by the research. This keeps research reviewable on its own.
4. **Import.** Write the importer under [`../scripts/`](../scripts/). Land canonical data under `/data/<topic>/` with a validation file (JSON or Markdown) covering row count + geography spot-checks against the documented basis (e.g. the 158-neighbourhood IDs in `data/crimes/`).
5. **Verify.** Per [`testing.md`](testing.md), record a manual verification under [`../docs/tests/`](../docs/tests/) — at minimum, that the imported file matches a hand-counted spot check from the source.
6. **Changelog.** Append entries to [`../docs/changelog.md`](../docs/changelog.md) when the research lands and again when the import lands. Both are user-affecting because both change what the dashboard can claim.

## Anti-patterns

- Importing first, then back-filling research because "we already pulled the file."
- Skipping the license/terms read because the source "looked open."
- Documenting only the URL and skipping refresh cadence — cadence determines how fresh the dashboard can honestly claim to be (the site says "Updated periodically — no fixed schedule").
- One backlog item that bundles research + ADR + import + verify. Split them so research is reviewable independently.
- Updating an existing `data-sources.md` section in place when the source is being *replaced*. Move the old one to a "Parked" subsection so the trail is preserved.

## Reference shape

The Toronto Police Service Community Safety Indicators write-up in [`../docs/data-sources.md`](../docs/data-sources.md) is the template. New sources match its depth.
