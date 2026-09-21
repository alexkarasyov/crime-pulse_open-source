// Type-ahead combobox for jumping straight to a neighbourhood detail page.
// Diacritic-folded, token-AND substring match. Empty query lists every
// neighbourhood (scrollable); typing narrows to up to 8 results. Keyboard
// navigable (↑/↓/Enter/Esc).
//
// Used on the Overview hero (variant="hero") and atop the Neighbourhood
// index (variant="inline").

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

export interface PickerOption {
  id: string;
  name: string;
}

interface Props {
  options: PickerOption[];
  variant?: 'hero' | 'inline';
  placeholder?: string;
}

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function matches(name: string, tokens: string[]): boolean {
  const folded = fold(name);
  for (const t of tokens) if (!folded.includes(t)) return false;
  return true;
}

const MAX_RESULTS = 8;

export default function NeighbourhoodPicker({
  options,
  variant = 'inline',
  placeholder = 'Find your neighbourhood…',
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return options;
    const tokens = q.split(/\s+/).filter(Boolean);
    const hit: PickerOption[] = [];
    for (const o of options) {
      if (matches(o.name, tokens)) {
        hit.push(o);
        if (hit.length >= MAX_RESULTS) break;
      }
    }
    return hit;
  }, [options, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  // Keep the active row visible while arrowing through a list taller than
  // the dropdown's max-height.
  useEffect(() => {
    listRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function go(id: string) {
    window.location.href = `/neighbourhood/${id}/`;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      if (results[active]) {
        e.preventDefault();
        go(results[active]!.id);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const isHero = variant === 'hero';
  const inputClass = isHero ? 'nbhd-picker-input hero' : 'nbhd-picker-input';
  // ARIA 1.2 combobox: the roles/relations live on the INPUT, and
  // aria-activedescendant tells screen readers which option is highlighted
  // while focus stays in the input. Variant-scoped ids keep the pattern
  // valid if two pickers ever share a page.
  const listId = `nbhd-picker-list-${variant}`;

  return (
    <div class="nbhd-picker" ref={wrapRef}>
      <input
        ref={inputRef}
        type="search"
        class={inputClass}
        placeholder={placeholder}
        value={query}
        onInput={(e) => { setQuery((e.currentTarget as HTMLInputElement).value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown as unknown as (e: Event) => void}
        aria-label="Find a neighbourhood"
        aria-autocomplete="list"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={
          open && results.length > 0 ? `${listId}-opt-${active}` : undefined
        }
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <ul class="nbhd-picker-list" role="listbox" id={listId} ref={listRef}>
          {results.map((r, i) => (
            <li
              key={r.id}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              class={`nbhd-picker-item ${i === active ? 'active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); go(r.id); }}
              onMouseEnter={() => setActive(i)}
            >
              <span class="name">{r.name}</span>
              <span class="id">N° {r.id}</span>
            </li>
          ))}
        </ul>
      )}
      {open && query.trim() && results.length === 0 && (
        <ul class="nbhd-picker-list" role="listbox" id={listId}>
          <li class="nbhd-picker-empty">No match for "{query}".</li>
        </ul>
      )}
    </div>
  );
}
