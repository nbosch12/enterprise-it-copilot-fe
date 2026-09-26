import { autoFormatInlineCode, renderMarkdown, toRichSegments } from './markdown';

describe('markdown utils', () => {
  it('marks identifiers and placeholders as inline code', () => {
    expect(autoFormatInlineCode('RedirectHelper replaces the <uuid> placeholder'))
      .toBe('`RedirectHelper` replaces the `<uuid>` placeholder');
    expect(autoFormatInlineCode('Check failed_qr_queue and getToken()'))
      .toBe('Check `failed_qr_queue` and `getToken()`');
  });

  it('leaves links, existing code and product names alone', () => {
    const text = 'See https://example.com/some_path, `already_code` and GitHub';
    expect(autoFormatInlineCode(text)).toBe(text);
  });

  it('shows raw HTML as text instead of dropping it', () => {
    expect(renderMarkdown('before <b>bold</b> after', true)).toContain('&lt;b&gt;');
  });

  it('opens links in a new tab', () => {
    expect(renderMarkdown('[docs](https://example.com)')).toContain('target="_blank"');
  });

  it('splits fenced code blocks into their own segments', () => {
    const segments = toRichSegments('Run:\n\n```bash\nkubectl get pods\n```\n\nDone.');

    expect(segments.map(segment => segment.kind)).toEqual(['html', 'code', 'html']);
    expect(segments[1]).toEqual({ kind: 'code', code: 'kubectl get pods', language: 'bash' });
  });

  it('treats an unclosed fence as code while an answer is streaming', () => {
    const segments = toRichSegments('Run:\n```bash\nkubectl get');

    expect(segments[1]).toEqual({ kind: 'code', code: 'kubectl get', language: 'bash' });
  });
});
