// Neighbourhood detail page header — links to the index for browsing,
// and to /compare. No window.prompt — picker UX lives on the index page.

interface Props {
  /** Not used yet; kept for future deep-link "back to this nbhd" behaviour. */
  currentId?: string;
  /** Kept for API parity with earlier implementations. */
  ids?: string[];
}

export default function NeighbourhoodChange(_props: Props) {
  return (
    <div style="display: flex; gap: 8px; margin-top: 20px; flex-wrap: wrap;">
      <a
        href="/neighbourhood/"
        class="filter-chip"
        style="color: var(--ink); border-color: var(--border);"
      >
        ◇ Pick another neighbourhood
      </a>
      <a
        href="/compare/"
        class="filter-chip"
        style="color: var(--ink); border-color: var(--border);"
      >
        ↔ Compare with others
      </a>
    </div>
  );
}
