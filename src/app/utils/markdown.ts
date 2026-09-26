import { Marked } from 'marked';

/** A piece of rich text: rendered markdown, or a fenced code block shown by `CodeBlock`. */
export type RichSegment =
  | { kind: 'html'; html: string }
  | { kind: 'code'; code: string; language: string };

const markdown = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    // Raw HTML in model output is shown as text. Otherwise placeholders such as
    // `<uuid>` are treated as tags and silently removed by Angular's sanitizer.
    html({ text }) {
      return escapeHtml(text);
    },
    link({ href, title, tokens }) {
      const label = this.parser.parseInline(tokens);
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${escapeHtml(href)}"${titleAttr} target="_blank" rel="noopener noreferrer">${label}</a>`;
    }
  }
});

/**
 * Splits text into markdown and fenced code segments, so code blocks can be rendered
 * by an Angular component (with a copy button) instead of plain `<pre>` HTML.
 *
 * An unclosed fence runs to the end of the text, so code shows up correctly
 * while an answer is still being streamed.
 */
export function toRichSegments(text: string, inline = false): RichSegment[] {
  const segments: RichSegment[] = [];
  const buffer: string[] = [];
  let fence: { marker: string; indent: number; language: string; lines: string[] } | null = null;

  const flushMarkdown = () => {
    const source = buffer.join('\n');
    buffer.length = 0;
    if (source.trim()) {
      segments.push({ kind: 'html', html: renderMarkdown(source, inline) });
    }
  };

  for (const line of text.split(/\r?\n/)) {
    if (fence) {
      const trimmed = line.trim();
      const isClosing = trimmed.length >= fence.marker.length
        && trimmed === fence.marker[0].repeat(trimmed.length);

      if (isClosing) {
        segments.push({ kind: 'code', code: fence.lines.join('\n'), language: fence.language });
        fence = null;
      } else {
        fence.lines.push(removeIndent(line, fence.indent));
      }
      continue;
    }

    const opening = /^(\s*)(`{3,}|~{3,})\s*([\w+#.-]*)/.exec(line);
    if (opening) {
      flushMarkdown();
      fence = { indent: opening[1].length, marker: opening[2], language: opening[3].toLowerCase(), lines: [] };
      continue;
    }

    buffer.push(line);
  }

  if (fence) {
    segments.push({ kind: 'code', code: fence.lines.join('\n'), language: fence.language });
  }
  flushMarkdown();

  return segments;
}

/** Renders markdown to HTML. The result is sanitized by Angular when bound with [innerHTML]. */
export function renderMarkdown(source: string, inline = false): string {
  const prepared = autoFormatInlineCode(source);
  return inline
    ? markdown.parseInline(prepared, { async: false })
    : markdown.parse(prepared, { async: false });
}

/** Parts of the text that must not be touched: existing code spans, links and URLs. */
const PROTECTED = /(`+)[\s\S]*?\1|\[[^\]\n]*\]\([^)\n]*\)|<https?:\/\/[^>\s]+>|https?:\/\/[^\s<>()]+|\bwww\.[^\s<>()]+/g;

/** Tokens that look like code and are wrapped in backticks. */
const CODE_TOKEN = new RegExp(
  [
    String.raw`<[A-Za-z_][\w.:-]*>`,                                         // placeholders: <uuid>
    String.raw`\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\(\)`,               // calls: getToken(), client.get()
    String.raw`\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b`,                          // snake_case
    String.raw`\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b`,                          // UPPER_SNAKE_CASE
    String.raw`\b[A-Za-z0-9_][\w-]*(?:\.[\w-]+)*\.(?:ts|js|mjs|json|ya?ml|xml|java|py|properties|sh|conf|html|scss|css|sql|env)\b`, // file names
    String.raw`\b(?=[A-Za-z0-9]*[a-z][A-Z])[A-Za-z][A-Za-z0-9]*\b`         // camelCase / PascalCase identifiers
  ].join('|'),
  'g'
);

/** Product names written in camel case that should stay plain text. */
const PLAIN_WORDS = new Set([
  'JavaScript', 'TypeScript', 'GitHub', 'GitLab', 'PowerShell', 'PowerPoint', 'PowerBI', 'SharePoint',
  'OneDrive', 'OneNote', 'LinkedIn', 'YouTube', 'WhatsApp', 'iPhone', 'iPad', 'iOS', 'macOS', 'DevOps',
  'DevSecOps', 'MLOps', 'FinOps', 'PostgreSQL', 'MySQL', 'MongoDB', 'NoSQL', 'GraphQL', 'NetWeaver',
  'SuccessFactors', 'ServiceNow', 'HashiCorp', 'OpenAI', 'ChatGPT', 'McAfee', 'eMail', 'eLearning',
  'Node.js', 'Vue.js', 'Next.js', 'Nuxt.js', 'Express.js', 'Chart.js', 'Three.js', 'D3.js'
]);

/**
 * Wraps identifiers such as `RedirectHelper`, `qrCodeRedirector`, `failed_qr_queue`
 * or `<uuid>` in backticks so they are displayed as inline code.
 */
export function autoFormatInlineCode(text: string): string {
  let result = '';
  let lastIndex = 0;

  for (const match of text.matchAll(PROTECTED)) {
    result += formatPlain(text.slice(lastIndex, match.index));
    result += match[0];
    lastIndex = match.index + match[0].length;
  }

  return result + formatPlain(text.slice(lastIndex));
}

function formatPlain(text: string): string {
  return text.replace(CODE_TOKEN, token => (PLAIN_WORDS.has(token) ? token : `\`${token}\``));
}

function removeIndent(line: string, indent: number): string {
  let index = 0;
  while (index < indent && line[index] === ' ') {
    index++;
  }
  return line.slice(index);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
