import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { CodeBlock } from '../code-block/code-block';
import { toRichSegments } from '../../utils/markdown';

/** Text that looks like block markdown (paragraph breaks, lists, fences) can't be rendered inline. */
const BLOCK_MARKDOWN = /\n\s*\n|```|~~~|^\s*([-*+]|\d+\.)\s|^\s*#{1,6}\s|^\s*\|/m;

/**
 * Renders markdown text from the assistant: paragraphs, lists, tables, links and
 * inline code via `marked`, and fenced code blocks via `CodeBlock`.
 *
 * Use `inline` inside list items and field values to avoid paragraph margins.
 */
@Component({
  selector: 'app-rich-text',
  imports: [CodeBlock],
  templateUrl: './rich-text.html',
  styleUrl: './rich-text.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.rich-text-inline]': 'isInline()'
  }
})
export class RichText {
  readonly text = input('');
  readonly inline = input(false, { transform: booleanAttribute });

  protected readonly isInline = computed(() => this.inline() && !BLOCK_MARKDOWN.test(this.text()));

  protected readonly segments = computed(() => toRichSegments(this.text(), this.isInline()));
}
