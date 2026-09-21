# AGENTS.md — instructions for AI agents working on Toronto Crime Pulse

Three folders run this project:

| Folder | Purpose | Read it before… |
|--------|---------|-----------------|
| [`docs/`](docs/) | **What this project is.** Spec, changelog, test results, spec history. | Making any non-trivial change. Start with `docs/overview.md`. |
| [`project/`](project/) | **How the work is run.** Charter, roadmap, backlog, ADRs, metrics. Dated kickoffs live under [`project/handoffs/`](project/handoffs/) when one exists. | Starting any work — confirm a backlog item exists. |
| [`ai/`](ai/) | **AI workflow skills.** How to update the backlog, write an ADR, verify. | The first time you're updating one of those things. |

## What this repo is

Toronto Crime Pulse is a built, working static Astro dashboard for public Toronto crime-trend awareness. The Markdown archive under [`data/crimes/`](data/crimes/) is the canonical source; a build step aggregates it into JSON the dashboard reads at runtime to render trend views (hand-rolled SVG/Preact charts — not Chart.js), a chronological feed, and a Leaflet neighbourhood choropleth. The production build emits four public surfaces (Overview, Compare, About, and the neighbourhood index) plus one static page per neighbourhood for each of the 158 neighbourhoods. Numbers are reported by default as raw incident counts, with rates per 10,000 residents one toggle away (ADR-009, superseding ADR-002's rate default). The current spec lives in [`docs/overview.md`](docs/overview.md), the load-bearing v1 decisions live as ADRs under [`project/decisions/`](project/decisions/), and the implementation sequence starts from [`project/roadmap.md`](project/roadmap.md).

## Repository layout

| Path | What's there |
|------|--------------|
| [`AGENTS.md`](AGENTS.md) | Entry point for AI agents working in the repo. |
| [`README.md`](README.md) | Human-facing overview, quick start status, and project ops links. |
| [`ai/`](ai/) | AI workflow skills for backlog, changelog, ADR, and manual verification process. |
| [`docs/`](docs/) | Project spec, changelog, spec history, and manual test records. |
| [`project/`](project/) | Charter, roadmap, backlog, decisions, metrics, and dated handoffs. |

## Local development

```bash
npm install
npm run dev      # Astro dev server on http://127.0.0.1:41690 (dev routes on)
npm run build    # build aggregates → OG images → static site into dist/
npm run refresh  # stage TPS/population/CSI/CMA imports and produce a review
npm run refresh:apply -- .refresh/<run>/review.json  # accept a reviewed candidate
npm run verify   # check, build, unit/data tests, responsive Chrome QA
```

The aggregate builder and TPS importer use Python's standard library;
`scripts/import_population.py` additionally requires `openpyxl` from
`requirements.txt`. `scripts/import_tps_csi.py` downloads
the official Toronto Police Service Community Safety Indicators CSV and writes
yearly Markdown tables under `data/crimes/`; `scripts/build_aggregates.py` rolls
those up into the JSON the Astro app reads. The Astro app, package manifest, and
the static Cloudflare Pages build (`npm run build`) all exist now.

## What you must do on every change

1. **Check `project/backlog.md`** before starting. If your work isn't on it, add it first (skill: `ai/backlog.md`).
2. **Update `docs/changelog.md`** in the same commit as the shipping change (skill: `ai/changelog.md`).
3. **Write an ADR** in `project/decisions/` if you're making a non-trivial design, architecture, or scope call (skill: `ai/decisions.md`).
4. **Update `docs/specs-history.md`** if you substantially changed `docs/overview.md`.
5. **Record a manual test run** in `docs/tests/` if you shipped a user-visible feature (skill: `ai/testing.md`).

Forgetting one of these isn't a "process violation" — it's a real cost. The next agent (or next-you in a month) loads context from these files. If they're out of date, work gets redone or undone.

## Do not

Avoid YAML, agent-heavy product workflows, Supabase, real-time infrastructure, and LLM news-link features until the static v1 proves value and the user reviews the premise. Do not reintroduce GTA-wide framing or incident-level map dots — those are closed off by ADRs 001 and 003. The default unit is raw counts per ADR-009 (which superseded ADR-002's rate default on 2026-07-20); do not flip it back without a new ADR.

## Running / using

```bash
npm run dev     # local dev server (localhost:41690)
npm run build   # full static build into dist/
```

## Known soft spots

The imported Markdown data is large because it stores incident-level rows for 10 full years. `2026` source data is imported but intentionally excluded from the comparable 10-year graph set because it is year-to-date (a "+ Include 2026 YTD" toggle surfaces it with an inline disclaimer).
