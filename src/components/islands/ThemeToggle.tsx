// Topbar dark ⇄ light theme toggle. Both icons ship; base.css shows the one
// for the theme you'd switch TO (sun on light, moon on dark). Markup + icons
// per redesign THEMING.md §3b.

import { useEffect } from 'preact/hooks';
import { initTheme, toggleTheme } from '../../lib/theme';

export default function ThemeToggle() {
  // Sync the signal to the painted theme on mount so the first toggle is correct.
  useEffect(() => {
    initTheme();
  }, []);
  return (
    <button
      type="button"
      class="theme-toggle"
      aria-label="Switch light / dark theme"
      title="Switch theme"
      onClick={() => toggleTheme()}
    >
      <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
      <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
