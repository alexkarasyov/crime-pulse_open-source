import { describe, expect, it } from 'vitest';
import { escapeHtml } from './html';

describe('escapeHtml', () => {
  it('encodes apostrophes used in neighbourhood names', () => {
    expect(escapeHtml("Tam O'Shanter-Sullivan")).toBe('Tam O&#39;Shanter-Sullivan');
  });

  it('leaves names without markup characters unchanged', () => {
    expect(escapeHtml('Moss Park')).toBe('Moss Park');
  });

  it('encodes characters that would be markup', () => {
    expect(escapeHtml('a<b>&"c"')).toBe('a&lt;b&gt;&amp;&quot;c&quot;');
  });
});
