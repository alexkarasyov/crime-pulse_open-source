# /ai/ — AI workflow skills

How an AI agent operates this project. Each file is a **skill** — a focused, repeatable meta-workflow. Facts about the project live in [`../docs/`](../docs/); project state lives in [`../project/`](../project/); this folder is about *how to do the recurring work*.

The top-level [`../AGENTS.md`](../AGENTS.md) is the entry point and links here for every workflow.

## Skills

| File | Skill | Read it before… |
|------|-------|-----------------|
| [`backlog.md`](backlog.md) | Manage the backlog | Adding, claiming, or marking-done items in [`../project/backlog.md`](../project/backlog.md) |
| [`changelog.md`](changelog.md) | Update the changelog | Appending to [`../docs/changelog.md`](../docs/changelog.md) |
| [`data.md`](data.md) | Add a new data source | Researching, adding, or switching anything that lands under [`../data/`](../data/) |
| [`decisions.md`](decisions.md) | Write an ADR | Adding a file to [`../project/decisions/`](../project/decisions/) |
| [`testing.md`](testing.md) | Verify a change manually | Marking a backlog item `done` or shipping a user-visible feature |

## Adding a new skill

Add a file here only when a recurring meta-workflow shows up that the four core skills don't cover (e.g. a project-specific voice guide, a citation style, a release procedure). Don't invent skills speculatively — they accumulate as the project teaches you what it needs.

If discovery surfaced a multi-step AI pipeline that produces project output (not just meta-work), document it as a separate sub-area — e.g. `/ai/pipeline/` — with one prompt per pipeline step. Skills govern process; pipeline prompts produce content. They can coexist.
