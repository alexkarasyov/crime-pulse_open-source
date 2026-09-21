# /project/ — project operations

How this project is run. The spec lives in [`../docs/`](../docs/); AI skills live in [`../ai/`](../ai/). This folder is for direction, todo state, decisions, and measurement.

## Layout

| File / dir | What it is | Owned by |
|------------|------------|----------|
| [`charter.md`](charter.md) | What / why / who, in one page | PM / lead |
| [`roadmap.md`](roadmap.md) | Phases — where we are, where we're going | PM / lead |
| [`backlog.md`](backlog.md) | Itemized work for the current phase + parking lot | Anyone proposing work |
| [`decisions/`](decisions/) | ADRs — one file per non-trivial decision | Anyone making one |
| [`metrics.md`](metrics.md) | KPIs, success measures, current numbers | PM / lead |

## Rules of the road

1. **Before non-trivial work**: check [`backlog.md`](backlog.md). If your work isn't on it, add it first.
2. **When you ship**: append to [`../docs/changelog.md`](../docs/changelog.md) and mark the matching backlog item done.
3. **When you make a non-trivial design, architecture, or scope call**: write an ADR in [`decisions/`](decisions/).
4. **When you change `../docs/overview.md` substantially**: add an entry to [`../docs/specs-history.md`](../docs/specs-history.md).
5. **When you verify a feature manually**: drop a dated note in [`../docs/tests/`](../docs/tests/).

AI agents follow the same rules. Mechanics in [`../ai/`](../ai/).
