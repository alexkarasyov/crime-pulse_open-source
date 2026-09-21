# ADR-009 — Default unit is raw incident counts, rates on toggle

**Status**: accepted · 2026-07-20 · supersedes [ADR-002](002-present-rates-not-counts.md)

## Context

ADR-002 (2026-05-26) made rate per 10,000 residents the default unit everywhere, reasoning that raw counts visually penalize high-population neighbourhoods and mislead non-expert readers. Its own "when to revisit" clause anticipated the counter-pressure: *"Counts are still what most journalists and residents have intuition for."*

On 2026-07-20 the project owner directed that counts become the default. Counts are the unfiltered record of what was reported; they need no denominator caveats (the 25%-sample and stale-2021-denominator caveats of ADR-006/007 apply only to rates), and they match the intuition most readers bring.

## Decision

The default unit everywhere on the dashboard is **raw incident counts**. Rate per 10,000 residents remains one toggle away (view rail on data pages, topbar on Compare), and the toggle state still drives chart axes, map legend, headline copy, and the feed at once.

Everything else ADR-002 established stays: rates remain first-class (computed, published in the aggregates, and encoded in share links), the denominators are unchanged (ADR-006/007), and partial (YTD) years still publish no rate.

Mechanics: `DEFAULT_UNIT` in `src/lib/state.ts` is the single switch; share links encode `u=` only for the non-default unit; a returning visitor's persisted unit choice still wins over the default.

## Consequences

+ The default view is the raw record — no denominator caveats attached to what a first-time visitor sees.
+ Matches the count-based intuition of the general-public audience ADR-002 itself acknowledged.
− Cross-neighbourhood comparisons at the default setting favour low-population neighbourhoods optically; the About page and an inline caveat now instruct readers to switch to rates when comparing. ADR-002's fairness argument was real — it is now handled by copy and affordance instead of by the default.
− Old shared links that omitted the `u=` param (minted when rate was the default) now open in counts. Links that encoded `u=count` explicitly are unaffected.
− The "reported by default as incidents per 10,000 residents" framing in the charter/spec/README/AGENTS.md had to be rewritten; per-10K remains the framing for *comparability*, not the default presentation.

## When to revisit

If user testing shows count-default materially misleads cross-neighbourhood comparisons (the exact failure ADR-002 guarded against), or a newer universal denominator (2026 Census) removes the rate caveats that motivated this flip.
