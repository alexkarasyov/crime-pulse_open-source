# Skill — manage the backlog

The backlog lives at [`../project/backlog.md`](../project/backlog.md). It's the source of truth for what work is in flight, queued, or parked.

## When to update

- **Before starting non-trivial work**: confirm an item exists. If not, add one.
- **On pickup**: change status to `in-progress`.
- **On ship**: change status to `done` and append a matching entry to [`../docs/changelog.md`](../docs/changelog.md).
- **On scope creep**: split into a new item; don't silently expand the original.
- **On park**: change status to `parked` with a one-line reason.

## Item format

```
### {phase}.{n} · {short imperative title}
**Status**: todo · in-progress · done · parked
**What**: One paragraph. What ships, where the change lands, any interface or contract that must be honored.
**Why**: One sentence. The externally-visible or strategic reason — not "because the spec says so."
**Done when**: A concrete, externally observable check. "It works" is not acceptable.
```

Phase IDs are conventional (e.g. `P1.4`, `1.4`, `M2.3`, `v0.3.1`). Pick one shape and use it consistently. The exact prefix doesn't matter; consistency does.

## Anti-patterns

- Items with no `Done when`.
- Bumping phases to clear the board.
- Skipping the backlog because "it's just a small change."
- Editing past `done` items instead of writing a new follow-up.
