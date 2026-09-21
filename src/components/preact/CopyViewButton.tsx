import { useEffect, useRef, useState } from 'preact/hooks';
import { buildShareUrl } from '../../lib/urlState';

export default function CopyViewButton() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy(): Promise<void> {
    const url = buildShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt('Copy this link', url);
    }
  }
  return (
    <button type="button" class={`vrail-btn ${copied ? 'on' : ''}`} onClick={copy}
      aria-label="Copy a shareable link to this view"
      title="Copy this view, including filters, Compare picks, and baseline visibility"
      style={copied ? 'color: var(--accent); border-color: var(--accent-line);' : ''}>
      <span aria-live="polite">{copied ? '✓ Link copied' : '⧉ Copy view'}</span>
    </button>
  );
}
