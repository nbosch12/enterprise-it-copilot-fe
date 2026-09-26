import { ChangeDetectionStrategy, Component, OnDestroy, computed, input, signal } from '@angular/core';

const LANGUAGE_LABELS: Record<string, string> = {
  bash: 'Shell',
  sh: 'Shell',
  shell: 'Shell',
  powershell: 'PowerShell',
  ps1: 'PowerShell',
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  py: 'Python',
  python: 'Python',
  java: 'Java',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  xml: 'XML',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sql: 'SQL',
  kql: 'KQL',
  log: 'Log',
  http: 'HTTP'
};

/** Monospace code box with a language label and a copy button. */
@Component({
  selector: 'app-code-block',
  templateUrl: './code-block.html',
  styleUrl: './code-block.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CodeBlock implements OnDestroy {
  readonly code = input.required<string>();
  readonly language = input('');

  protected readonly copied = signal(false);

  protected readonly languageLabel = computed(() => {
    const language = this.language().trim().toLowerCase();
    if (!language || language === 'text' || language === 'plaintext') {
      return 'Code';
    }
    return LANGUAGE_LABELS[language] ?? language;
  });

  private resetTimer?: ReturnType<typeof setTimeout>;

  protected async copy(): Promise<void> {
    const copied = await copyToClipboard(this.code());
    if (!copied) {
      return;
    }

    this.copied.set(true);
    clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => this.copied.set(false), 2000);
  }

  ngOnDestroy(): void {
    clearTimeout(this.resetTimer);
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API is unavailable on plain http. Fall back to a hidden textarea.
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  }
}
