// Inline text that mirrors the active unit — used where static copy would
// otherwise claim one unit while the toggle shows the other (e.g. the
// Overview hero eyebrow). Reads the shared `unit` signal.

import { unit } from '../../lib/state';

interface Props {
  /** Text when the unit is counts (the site default, ADR-009). */
  count?: string;
  /** Text when the unit is rate per 10K. */
  rate?: string;
}

export default function UnitPhrase({
  count = 'incident counts',
  rate = 'per 10,000 residents',
}: Props) {
  return <>{unit.value === 'rate' ? rate : count}</>;
}
