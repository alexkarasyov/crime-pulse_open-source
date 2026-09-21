# Docs

Documentation for Crime Pulse. Start with [overview.md](overview.md).

## Layout

| File / dir | What it is |
|------------|------------|
| `overview.md` | The spec — what this project is, who it's for, how the pieces fit, how to use/run/build it, non-goals. Source of truth every subsystem doc references. |
| `changelog.md` | Append-only log of what shipped, dated, newest at top. |
| `data-sources.md` | Researched source inventory, coverage, fit for v1, and import notes. |
| `deploy.md` | Cloudflare Pages setup: build config, env vars, build-time deps, refresh + smoke checks. |
| `specs-history.md` | Notable changes to `overview.md` over time. |
| `tests/` | Dated manual test results, one file per run. |
| *(subsystem specs)* | Added one file per subsystem as the project grows. |

## Rules for subsystem specs

1. One markdown file per subsystem.
2. Link back to `overview.md` at the top.
3. Cover the subsystem in depth; don't duplicate the overview.
4. If a fact lives in both the overview and a subsystem spec, the overview wins — delete it from the subsystem.
