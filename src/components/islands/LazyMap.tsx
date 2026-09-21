// Lazy-mount wrapper for the Leaflet map. The map is the heaviest island on a
// page — it dynamically imports Leaflet (~38KB) and fetches the 158-polygon
// GeoJSON (~130KB) on mount — so we defer that until the map nears the viewport.
//
// This is a thin `client:load` wrapper (so it hydrates immediately and reserves
// layout height) that renders the real <TorontoMap> only once it scrolls into
// range. It uses a scroll listener + getBoundingClientRect rather than
// IntersectionObserver so the behaviour is robust and testable; TorontoMap keeps
// sharing the mapHover signal via src/lib/mapHover.ts, so the sidebar hover
// panel still works.

import { useEffect, useRef, useState } from 'preact/hooks';
import TorontoMap from './TorontoMap';

interface Props {
  selectedId?: string;
  silentHover?: boolean;
}

export default function LazyMap(props: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined') {
      setShow(true);
      return;
    }
    // Mount when the wrapper's top is within ~400px of the viewport bottom, so
    // the map is ready by the time the user reaches it.
    const near = () => el.getBoundingClientRect().top < window.innerHeight + 400;
    if (near()) {
      setShow(true);
      return;
    }
    const onScroll = () => {
      if (near()) {
        setShow(true);
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div ref={ref} style={{ width: '100%', height: '100%', minHeight: '460px' }}>
      {show ? <TorontoMap selectedId={props.selectedId} silentHover={props.silentHover} /> : null}
    </div>
  );
}
