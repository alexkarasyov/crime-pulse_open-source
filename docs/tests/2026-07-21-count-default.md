# Test run — default unit flipped to counts (ADR-009)

**Date**: 2026-07-21
**Backlog item**: P2.14 ([`../../project/backlog.md`](../../project/backlog.md))
**Tested on**: macOS (Darwin 25.5.0), headless Google Chrome (system install) via puppeteer-core, fresh production build served by `astro preview` on port 4324

## What was tested

1. **Automated suites** — `npm test`: 233/233 green (156 Vitest + 77 unittest) after flipping the default-unit expectations in `state.test.ts` / `urlState.test.ts` (defaults, persistence round-trip, tamper-rejection, share-link encode/decode, popstate reset — all now assert `count` as default and `u=rate` as the encoded non-default). `astro check` clean.
2. **Browser sweep (95 checks)** — the standing sweep updated for the new default: a new explicit "Counts is the default unit" check on a cleared-storage first visit; the unit toggle exercised count→rate→count; shared-link hydration re-pointed at the now-non-default `?u=rate&c=as,ro&y=2018-2024`; mobile overflow re-checked in the rate (non-default) state on every surface. 95/95 pass, zero console/page/network errors.
3. **Visual** — Overview screenshot in the default state: rail leads with an active Counts segment, hero eyebrow reads INCIDENT COUNTS (the new `UnitPhrase` island), bigstat shows `39,901 INCIDENTS · 2025`, category eyebrow reads "2025 count".
4. **Sitemap lastmod behaviour under the change** — the full-copy build stamped 162/162 (every page's HTML legitimately changed); a follow-up single-page tweak (Overview eyebrow) stamped exactly 1/162. The per-page rule works.

## Passed

Everything above. Old `u=count` links keep working (param still parses); `?u=rate` hydrates rates.

## Notes

- Recorded trade-off (see ADR-009): pre-flip shared links that omitted `u=` now open in counts — the implied-default meaning of old links cannot be preserved across a default swap.
- ADR-002's dense-neighbourhood fairness argument is now carried by copy: About §02 leads with a warning caveat telling readers to switch to rates when comparing neighbourhoods.
