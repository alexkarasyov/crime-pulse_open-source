// Headless island that wires the URL hash <-> signals sync exactly once.
// Lives in the Site layout so every page hydrates filter state from a
// shared link, even pages without a visible view rail.

import { useEffect } from 'preact/hooks';
import { initUrlSync } from '../../lib/urlState';

export default function UrlSync() {
  useEffect(() => {
    initUrlSync();
  }, []);
  return null;
}
