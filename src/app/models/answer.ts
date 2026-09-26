/**
 * View model for assistant answers.
 *
 * The backend returns free-form JSON whose keys change from question to question
 * (e.g. `workflow`, `exceptions_observed`, `recommended_actions`). The parser in
 * `utils/answer-parser.ts` turns any such object into this small set of node types,
 * so the UI can render every response shape without knowing its keys in advance.
 */

export type SeverityLevel = 'info' | 'low' | 'medium' | 'high' | 'critical' | 'unknown';

export interface Severity {
  /** Human readable label, e.g. "Low severity". */
  label: string;
  level: SeverityLevel;
}

/** A paragraph of text. May contain markdown and inline code. */
export interface TextNode {
  type: 'text';
  text: string;
}

/** A block of code, shown in a monospace box with a copy button. */
export interface CodeNode {
  type: 'code';
  code: string;
  language: string;
}

/** Bulleted (or numbered, when the content is a sequence) list. */
export interface ListNode {
  type: 'list';
  ordered: boolean;
  items: AnswerNode[];
}

/** A numbered process, e.g. the `workflow` array. */
export interface StepsNode {
  type: 'steps';
  steps: StepItem[];
}

/** A list of records, e.g. the `exceptions_observed` array. */
export interface CardsNode {
  type: 'cards';
  cards: CardItem[];
}

/** Label / value pairs of a nested object. */
export interface FieldsNode {
  type: 'fields';
  fields: Field[];
}

export type AnswerNode = TextNode | CodeNode | ListNode | StepsNode | CardsNode | FieldsNode;

export interface Field {
  key: string;
  label: string;
  node: AnswerNode;
}

export interface StepItem {
  number: string;
  title: string;
  description: string;
  fields: Field[];
}

export interface CardItem {
  title: string;
  /** True when the title is an identifier (component, endpoint, queue...) and should look like code. */
  titleIsCode: boolean;
  severity: Severity | null;
  fields: Field[];
}

export interface AnswerSection {
  key: string;
  title: string;
  /** `note` sections (limitations, caveats) are rendered quieter than the main content. */
  tone: 'default' | 'note';
  node: AnswerNode;
}

export interface ParsedAnswer {
  /** `markdown` when the backend returned plain text, `structured` when it returned JSON. */
  kind: 'structured' | 'markdown';
  /** Lead text of the answer (the `answer` field, or the whole text for markdown answers). */
  summary: string;
  severity: Severity | null;
  sections: AnswerSection[];
  conclusion: string;
  /** Pretty-printed source JSON, for the "View JSON response" toggle. Empty for markdown. */
  rawJson: string;
}
