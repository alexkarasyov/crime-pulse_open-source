# Skill — write an ADR

ADRs live in [`../project/decisions/`](../project/decisions/). One file per decision, named `NNN-kebab-case-title.md`.

## When to write

Both conditions must hold:
1. The decision closes off other reasonable options.
2. It's expensive to reverse, OR hard to reconstruct from the diff alone.

If a decision is cheap to reverse and obvious from the code, skip the ADR.

## Format

```
# ADR-NNN — {short imperative title}

**Status**: proposed · accepted · superseded by ADR-XXX · YYYY-MM-DD

## Context
{What forced the decision. What constraints applied.}

## Decision
{What you chose. State it as a directive.}

## Consequences
{Force yourself to list at least two + and two −.}

## When to revisit
{A specific trigger, not "someday." e.g. "If we add a second consumer of this API," "If P95 exceeds 200ms."}
```

## Numbering and supersession

- Numbering: highest existing `NNN` + 1, always three digits. Never renumber.
- Superseding: the new ADR links back to the old one. The old one's status becomes `superseded by ADR-XXX`. Never delete.

## Anti-patterns

- ADRs that narrate code with no tradeoff articulated.
- `proposed` status sitting for weeks.
- Stacking decisions into one ADR ("we also decided to…").
- Writing an ADR for a decision nobody disagreed with.
