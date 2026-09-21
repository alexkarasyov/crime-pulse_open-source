# Test run — production deployment of the reviewed release

**Date**: 2026-09-12  
**Backlog item**: [P2.23](../../project/backlog.md)  
**Production URL**: https://crimepulse.ca  
**Tested on**: macOS; Wrangler 4.131.1; Chrome 152.0.7977.65 at 1280×900 and 375×812 with touch emulation.

## What was deployed

The locally verified P2.17–P2.22 release: package updates and reviewed fixes,
optional Compare baseline with shared preferences, accessible chart/calendar
data, clear index scope controls, maintained QA, staged source-refresh review,
and the related responsive/font corrections.

Cloudflare's existing `crime-pulse` Workers Static Assets service already owned
the `crimepulse.ca` production domain; the domain mapping was confirmed through
the authenticated provider API. No hosting migration was performed. The live
site had no analytics beacon before publication, matching the verified build.

## How

- Prerequisite release verification passed: 302 unit/data tests, 85 local browser
  checks, 22 accessibility scans, 163 generated pages, and zero known npm audit
  vulnerabilities. See the [follow-up QA record](2026-09-12-review-followups.md).
- Published the existing verified `dist/` with Wrangler 4.131.1 using
  `deploy --keep-vars --strict`, tag `review-2026-09-12`, and a release message.
- Cloudflare uploaded 224 changed assets, reusing 377 previously uploaded
  assets. Deployment status confirms **100%** traffic on the new version.

| Deployment field | Value |
| --- | --- |
| Published at | 2026-09-12 16:22:44 UTC |
| Current version | `c130947c-f709-48f3-b289-feae4d0296c0` |
| Previous version | `a4f0a68e-30be-40c5-99cb-b60396d7b978` |
| Service | `crime-pulse` |
| Custom domain | `crimepulse.ca` |
| Production URL | `https://crimepulse.ca` |

## Passed

The independent production HTTP sweep passed **105/105 checks** at 16:24:19 UTC:

- Overview, Compare, About, neighbourhood index and Moss Park detail all return
  200 and match the local build byte for byte.
- Tested JavaScript, CSS, fonts, runtime aggregates, favicon, robots, sitemaps,
  Open Graph images and Leaflet CSS match their built files.
- Deployed CSP, security headers, HTML revalidation, immutable asset caching,
  data caching and OG caching are correct.
- `/nope`, `/project/`, and `/styleguide/` return the branded 404.
- Data coverage remains through **2026-06-30**, imported **2026-07-27**; accepted
  source data was not refreshed. Analytics remains disabled.

The live browser sweep verified desktop/mobile public flows, unit/theme and
category/year controls, Compare slots and data tables, calendar touch/keyboard
inspection, feed pagination, search/sort, and navigation through 158 real map
polygons. **22 accessibility scans reported zero violations**, with no
application JavaScript, console or unexpected resource errors.

The broad production harness passed 79 of 84 checks; its global network-idle
wait timed out on five shared-link checks. Repeating with fresh browser fetches
produced the same wait failures. Those five behaviors were then independently
retested against actual rendered state, without the network-idle heuristic:
**5/5 passed**, including baseline preferences after copy/open/reload and
category-scope persistence on desktop/mobile, plus copied defaults overriding
recipient preferences on open/reload. The targeted run recorded no JavaScript
errors. Thus every tested behavior was verified; the original harness timeout
results are preserved rather than counted as passing runs.

## Notes

Production browser verification uses actual CARTO tiles, unlike the fixture
tiles in repeatable local QA. Expected cancelled tile requests during map
replacement/navigation are separated from application and resource errors.
Clipboard capture uses a page-local stub; copied URLs are opened and reloaded
through the live application. Missing-route checks use the independent HTTP
sweep, keeping expected 404s out of the browser error collection.

HTTP evidence is in `/private/tmp/crime-pulse-prod-http/results.json`;
production browser evidence and screenshots are under `test-results/production/`
(ignored by Git). This dated record preserves the release outcome.

Publication used the authenticated Cloudflare CLI directly. Source changes
remain local and uncommitted; no GitHub push was performed.
