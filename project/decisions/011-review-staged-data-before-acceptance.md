# ADR-011 — Review staged data before replacing the accepted archive

**Status**: accepted · 2026-09-12

## Context

The refresh command previously replaced each source in turn. A late population
or context failure could leave a mixture of old and new imports. A successful
download also said little about revised incident totals or neighbourhood
coverage. The owner requested a reviewable refresh workflow (P2.21), while
retaining the static Markdown archive and manual deployment decisions.

## Decision

Make `npm run refresh` prepare an isolated candidate under `.refresh/`. Import
TPS, population, CSI and CMA sources there, reuse the vendored boundary, validate
the complete candidate, and produce `review.md` plus `review.json`. Compare
incident rows by year/category, unresolved coverage, source dates, population
and context values, and boundary changes. Validate monthly sums against annual
totals, including unresolved city records and the partial year.

Require a separate `npm run refresh:apply -- <review.json>` to accept a reviewed
candidate. Hash the accepted source directories and candidate files; reject a
stale or altered review. Revalidate a private candidate copy and its comparison
before replacing only the five source directories under an exclusive apply
lock. Roll back ordinary replacement failures and preserve original backups if
rollback cannot finish. Generated assets and unrelated data files remain outside
the source transaction. Run full release verification after acceptance.

Metadata-only fetch/release changes do not count as substantive data changes.
TPS has an event ID but no stable offence-row ID: identical rows cancel first,
then unmatched rows within an event are paired deterministically. Revision
counts are estimates under that pairing; before/after totals and coverage
deltas are exact. The report states this limitation.

## Consequences

- A maintainer can inspect actual data differences before accepting them.
- Late import failures leave the accepted archive intact; stale reviews cannot
  overwrite later edits. Offline replay can test the full workflow.
- Staging and revalidation require temporary disk space and extra processing.
- Acceptance spans several directory renames, so it is not one filesystem-wide
  atomic transaction. An abrupt process kill can leave a lock and backups under
  `.crime-pulse-accept-*/backup`. Stop source readers/builds, inspect the preserved
  directories, restore moved originals, then remove the stale lock only after
  confirming no apply process remains. Do not run a build concurrently with apply.

## When to revisit

Revisit if unattended refresh acceptance is approved, concurrent source writers
become necessary, or archive size makes local staging impractical. Until then,
keep the manual review/accept boundary and the static architecture.
