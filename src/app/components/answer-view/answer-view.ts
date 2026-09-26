import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ParsedAnswer } from '../../models/answer';
import { AnswerNodeView } from '../answer-node/answer-node';
import { CodeBlock } from '../code-block/code-block';
import { RichText } from '../rich-text/rich-text';
import { SeverityBadge } from '../severity-badge/severity-badge';

/**
 * Structured assistant answer: severity badge, lead summary, one section per
 * JSON field, a conclusion callout and a toggle to inspect the raw JSON.
 */
@Component({
  selector: 'app-answer-view',
  imports: [AnswerNodeView, CodeBlock, RichText, SeverityBadge],
  templateUrl: './answer-view.html',
  styleUrl: './answer-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnswerView {
  readonly answer = input.required<ParsedAnswer>();

  /** Lead text. Bound separately from `answer` so the chat can stream it word by word. */
  readonly summary = input('');

  /** False while the summary is still streaming; the sections appear once it completes. */
  readonly complete = input(true);
}
