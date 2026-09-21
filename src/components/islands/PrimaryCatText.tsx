// Inline text that mirrors the active category name and unit.
// Tiny island used by section headers that read e.g.
//   "{Category} {unit-word}, 2025 · by neighbourhood".
//
// Template placeholders:
//   $   → category name      (e.g. "Auto Theft")
//   $L  → category lowercase (e.g. "auto theft")
//   $U  → unit word          ("rate" | "count")
//   $Y  → year-range end      (e.g. "2025") — tracks the view-rail year range
//   $N  → years in the window (e.g. "10") — tracks the year-range span
//
// `$U` comes second so a template like "$U, year by year" works without the
// category, and so that "$ $U" reads naturally as "Auto Theft rate".

import { CAT_BY_ID } from '../../lib/categories';
import { primaryCat, unit, yearRange } from '../../lib/state';
import { unitWord } from '../../lib/format';

interface Props {
  template: string;
}

export default function PrimaryCatText({ template }: Props) {
  const cat = CAT_BY_ID[primaryCat.value];
  const u = unit.value;
  const [startYear, endYear] = yearRange.value;
  // Single pass with a function replacer: chained .replace() calls re-scan
  // earlier output, so a category name containing a literal "$" (Theft Over
  // $5,000) would itself get $-substituted and render garbled text. Multi-char
  // tokens ($U/$L/$Y/$N) are listed before the bare "$" so they win the match.
  const text = template.replace(/\$U|\$L|\$Y|\$N|\$/g, (m) =>
    m === '$U' ? unitWord(u)
    : m === '$L' ? cat.name.toLowerCase()
    : m === '$Y' ? String(endYear)
    : m === '$N' ? String(endYear - startYear + 1)
    : cat.name,
  );
  return <>{text}</>;
}
