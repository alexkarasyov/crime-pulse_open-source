# Handoff — open-source snapshot of Toronto Crime Pulse

**Backlog**: [P3.0](../backlog.md)

Make a **new public GitHub repo** with a fresh history. Same app, same data. Do not rewrite this private repo.

## Prompt

```
Open-source this dashboard as a new repo. Read AGENTS.md, then this file.

Source: the private working copy.
Put the public copy in a sibling folder.
Do not copy .git. git init there. Do not change remotes on the private repo.
Do not push until I ask.

Keep the crime Markdown as-is (including lat/lng). Keep AGENTS.md as the agent entry.
Add MIT LICENSE, a short NOTICE for the open-data licences, and a README that
explains clone + npm run build and points at https://crimepulse.ca.
Drop operator-only bits (Cloudflare workers.dev hostnames, Codex task ids).
Stop when a clean clone of the new folder can npm run build.
```

## Do this

1. Copy the project **without** `.git`, `node_modules/`, `dist/`, `.astro/`, `public/data/`, `public/og/`, `.refresh/`, `.wrangler/`, `test-results/`. Include `data/crimes/*.md` (they are in git even if search hides them). Use `git archive HEAD` from the private repo, then add any uncommitted files the owner wants.
2. `git init -b main` in the new folder.
3. Add **`LICENSE`** (MIT) and **`NOTICE`**: code is MIT; TPS/City data is Open Government Licence – Toronto (`Contains information licensed under the Open Government Licence – Toronto.`); StatCan tables keep `Source: Statistics Canada, Table …`. Not an official TPS/City product.
4. Rewrite **`README.md`** for a stranger: what it is, live site, how to install/build, `AGENTS.md` for agents, `NOTICE` for data terms.
5. Remove Cloudflare `workers.dev` preview hostnames and similar account ids if they appear.
6. Confirm `npm run build` works. Stop. Push only when asked.

The private GitHub repo already uses the short name, so the public repo needs another name (or the private one renamed). Ask once.

## Do not

CoC, issue templates, GitHub Actions, CSV/LFS/gzip, coordinate rounding, stripping lat/lng, extra ADRs, rewriting automations, dual-maintaining both repos after this ships.
