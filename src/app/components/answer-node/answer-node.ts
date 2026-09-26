import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AnswerNode } from '../../models/answer';
import { CodeBlock } from '../code-block/code-block';
import { RichText } from '../rich-text/rich-text';
import { SeverityBadge } from '../severity-badge/severity-badge';

/**
 * Renders one node of a structured answer: text, code, list, numbered steps,
 * record cards or label/value fields. Nested values render recursively.
 */
@Component({
  selector: 'app-answer-node',
  imports: [CodeBlock, RichText, SeverityBadge],
  templateUrl: './answer-node.html',
  styleUrl: './answer-node.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnswerNodeView {
  readonly node = input.required<AnswerNode>();
}
