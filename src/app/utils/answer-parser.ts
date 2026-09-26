import {
  AnswerNode,
  AnswerSection,
  CardItem,
  Field,
  ParsedAnswer,
  Severity,
  SeverityLevel,
  StepItem
} from '../models/answer';

type JsonRecord = Record<string, unknown>;

/** Keys holding the lead text of the answer. The first one found becomes the summary. */
const SUMMARY_KEYS = ['answer', 'summary', 'response', 'message', 'text', 'result'];

/** Keys rendered as the closing callout. */
const CONCLUSION_KEYS = ['conclusion', 'bottom_line', 'tldr', 'tl_dr', 'final_assessment'];

/** Keys rendered as a coloured badge when they hold a single word or number. */
const SEVERITY_KEYS = ['severity', 'priority', 'risk_level', 'risk', 'impact_level'];

/** Technical envelope fields that are never shown to the user. */
const META_KEYS = new Set([
  'session_id', 'repository_id', 'request_id', 'trace_id', 'conversation_id', 'correlation_id'
]);

/** Sections with these keys are rendered quieter (smaller, muted). */
const NOTE_KEY = /(^|_)(limitations?|caveats?|disclaimers?|assumptions?)(_|$)/;

/** Arrays under these keys are a sequence, so they get numbers instead of bullets. */
const ORDERED_KEY = /(^|_)(steps?|order|ordering|sequence|procedure|process|workflow|instructions|runbook)(_|$)/;

/** String values under these keys are always shown as code. */
const STRICT_CODE_KEY = /(^|_)(code|snippet|query|kql|sql|command|commands|cmd|script|stack_trace|stacktrace|regex|curl)$/;

/** String values under these keys are shown as code when they span several lines. */
const LOOSE_CODE_KEY = /(^|_)(config|configuration|yaml|yml|json|xml|payload|example|log_excerpt|logs?)$/;

const STEP_NUMBER_KEYS = ['step', 'step_number', 'step_no', 'order', 'sequence', 'index'];
const STEP_TITLE_KEYS = ['name', 'title', 'action', 'label', 'step_name'];
const STEP_BODY_KEYS = ['details', 'description', 'detail', 'text', 'summary'];
const CARD_TITLE_KEYS = ['title', 'name', 'component', 'service', 'label', 'category', 'type', 'id'];

/** Card titles taken from these keys are identifiers, so they are rendered in a code font. */
const CODE_TITLE_KEYS = new Set(['component', 'endpoint', 'class', 'method', 'function', 'file', 'queue', 'topic', 'id']);

/** Words kept upper-case when a key is turned into a heading. */
const ACRONYMS = new Set([
  'qr', 'url', 'urls', 'uri', 'ip', 'id', 'ids', 'api', 'apis', 'sql', 'kql', 'http', 'https', 'dxf',
  'uuid', 'json', 'xml', 'yaml', 'sap', 'btp', 'cpu', 'ram', 'ui', 'sla', 'slo', 'dns', 'tls', 'ssl',
  'jwt', 'msal', 'ntp', 'sdk', 'cli', 'ci', 'vm', 'os', 'db', 'kpi', 'faq', 'aws', 'gcp'
]);

const MAX_DEPTH = 6;
const FAILED = Symbol('json-parse-failed');

/**
 * Converts whatever the `/api/copilot/ask` endpoint returns into a renderable answer.
 *
 * Handles:
 *  - `{ answer: "<markdown>" }`                  → markdown answer
 *  - `{ answer: "{ \"answer\": ..., ... }" }`    → structured answer (JSON inside the answer string)
 *  - `{ answer: "...", workflow: [...], ... }`   → structured answer (JSON returned directly)
 *  - a JSON string, a double-encoded JSON string, a ```json fenced block,
 *    or text with literal `\n` / `\"` escapes (as copied from logs)
 */
export function parseAssistantPayload(payload: unknown): ParsedAnswer {
  const record = extractRecord(payload);

  if (record) {
    const answer = buildAnswer(record);
    if (answer.kind === 'structured' || answer.summary) {
      return answer;
    }
  }

  return markdownAnswer(extractText(payload));
}

/** Turns an object key into a sentence-case heading: `exceptions_observed` → "Exceptions observed". */
export function humanizeKey(key: string): string {
  const words = normalizeKey(key)
    .split('_')
    .filter(Boolean)
    .map(word => (ACRONYMS.has(word) ? word.toUpperCase() : word));

  const label = words.join(' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// ---------------------------------------------------------------------------
// Payload extraction
// ---------------------------------------------------------------------------

function extractRecord(payload: unknown): JsonRecord | null {
  if (typeof payload === 'string') {
    return parseJsonText(payload);
  }

  if (!isRecord(payload)) {
    return null;
  }

  // Most common case: the model's JSON arrives as a string inside `answer`.
  const summaryKey = findKey(payload, SUMMARY_KEYS, value => typeof value === 'string');
  if (summaryKey) {
    const inner = parseJsonText(payload[summaryKey] as string);
    if (inner) {
      return inner;
    }
  }

  // Structured fields returned directly next to `answer` (objects, arrays or text fields).
  const hasStructuredContent = Object.keys(payload).some(key => {
    const normalized = normalizeKey(key);
    const value = payload[key];
    return !META_KEYS.has(normalized)
      && !SUMMARY_KEYS.includes(normalized)
      && (typeof value === 'object' || typeof value === 'string')
      && !isEmpty(value);
  });

  return hasStructuredContent ? payload : null;
}

function extractText(payload: unknown): string {
  if (typeof payload === 'string') {
    return payload;
  }

  if (isRecord(payload)) {
    const key = findKey(payload, SUMMARY_KEYS, value => typeof value === 'string');
    if (key) {
      return payload[key] as string;
    }
  }

  if (payload === null || payload === undefined) {
    return '';
  }

  return '```json\n' + JSON.stringify(payload, null, 2) + '\n```';
}

/**
 * Parses text that should contain a JSON object. Returns null for anything else,
 * so ordinary markdown answers are never mistaken for JSON.
 */
function parseJsonText(text: string, depth = 0): JsonRecord | null {
  if (depth > 3) {
    return null;
  }

  const candidate = stripCodeFence(text.trim());

  if (!candidate.startsWith('{') && !candidate.startsWith('"')) {
    return null;
  }

  let parsed = tryJson(candidate);

  if (parsed === FAILED && /\\["n]/.test(candidate)) {
    // Text copied from a serialized payload, e.g. `{\n  \"answer\": \"...\"}`.
    const unescaped = tryJson(`"${candidate.replace(/\r?\n/g, '\\n')}"`);
    if (typeof unescaped === 'string') {
      parsed = tryJson(unescaped.trim());
    }
  }

  if (isRecord(parsed)) {
    return parsed;
  }

  if (typeof parsed === 'string') {
    return parseJsonText(parsed, depth + 1);
  }

  return null;
}

function stripCodeFence(text: string): string {
  const match = /^(```|~~~)[\w-]*[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*\1[ \t]*$/.exec(text);
  return match ? match[2].trim() : text;
}

function tryJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return FAILED;
  }
}

// ---------------------------------------------------------------------------
// View model construction
// ---------------------------------------------------------------------------

function buildAnswer(record: JsonRecord): ParsedAnswer {
  let summary = '';
  let severity: Severity | null = null;
  let conclusion = '';
  const sections: AnswerSection[] = [];

  for (const [key, value] of Object.entries(record)) {
    const normalized = normalizeKey(key);

    if (META_KEYS.has(normalized) || isEmpty(value)) {
      continue;
    }

    if (!summary && SUMMARY_KEYS.includes(normalized) && typeof value === 'string') {
      summary = cleanText(value);
      continue;
    }

    if (!severity && SEVERITY_KEYS.includes(normalized) && isScalar(value)) {
      severity = toSeverity(value, key);
      continue;
    }

    if (!conclusion && CONCLUSION_KEYS.includes(normalized) && typeof value === 'string') {
      conclusion = cleanText(value);
      continue;
    }

    const node = toNode(value, normalized, 0);
    if (node) {
      sections.push({
        key,
        title: humanizeKey(key),
        tone: NOTE_KEY.test(normalized) ? 'note' : 'default',
        node
      });
    }
  }

  const structured = sections.length > 0 || severity !== null || conclusion !== '';

  return {
    kind: structured ? 'structured' : 'markdown',
    summary,
    severity,
    sections,
    conclusion,
    rawJson: structured ? JSON.stringify(record, null, 2) : ''
  };
}

function markdownAnswer(text: string): ParsedAnswer {
  return {
    kind: 'markdown',
    summary: cleanText(text),
    severity: null,
    sections: [],
    conclusion: '',
    rawJson: ''
  };
}

function toNode(value: unknown, key: string, depth: number): AnswerNode | null {
  if (isEmpty(value)) {
    return null;
  }

  if (depth > MAX_DEPTH) {
    return { type: 'code', code: JSON.stringify(value, null, 2), language: 'json' };
  }

  if (typeof value === 'string') {
    return stringNode(value, key);
  }

  if (Array.isArray(value)) {
    return arrayNode(value, key, depth);
  }

  if (isRecord(value)) {
    return recordNode(value, key, depth);
  }

  return { type: 'text', text: String(value) };
}

function stringNode(value: string, key: string): AnswerNode {
  const text = cleanText(value);

  // A string that is itself JSON is shown as formatted JSON.
  if (/^[{[]/.test(text)) {
    const parsed = tryJson(text);
    if (parsed !== FAILED && typeof parsed === 'object' && parsed !== null) {
      return { type: 'code', code: JSON.stringify(parsed, null, 2), language: 'json' };
    }
  }

  const isCode = STRICT_CODE_KEY.test(key) || (LOOSE_CODE_KEY.test(key) && text.includes('\n'));

  if (isCode && !text.includes('```')) {
    return { type: 'code', code: text, language: guessLanguage(key, text) };
  }

  return { type: 'text', text };
}

function arrayNode(items: unknown[], key: string, depth: number): AnswerNode | null {
  const values = items.filter(item => !isEmpty(item));

  if (values.length === 0) {
    return null;
  }

  if (values.every(isRecord)) {
    const records = values as JsonRecord[];

    if (records.every(isCodeRecord)) {
      return { type: 'list', ordered: false, items: records.map(codeRecordNode) };
    }

    if (isStepList(records, key)) {
      return { type: 'steps', steps: records.map((record, index) => toStep(record, index, depth)) };
    }

    return { type: 'cards', cards: records.map(record => toCard(record, depth)) };
  }

  const nodes = values
    .map(value => toNode(value, key, depth + 1))
    .filter((node): node is AnswerNode => node !== null);

  return { type: 'list', ordered: ORDERED_KEY.test(key), items: nodes };
}

function recordNode(record: JsonRecord, key: string, depth: number): AnswerNode | null {
  if (isCodeRecord(record)) {
    return codeRecordNode(record);
  }

  if (STRICT_CODE_KEY.test(key) || LOOSE_CODE_KEY.test(key)) {
    return { type: 'code', code: JSON.stringify(record, null, 2), language: 'json' };
  }

  const fields = toFields(record, new Set(), depth);
  return fields.length > 0 ? { type: 'fields', fields } : null;
}

function toStep(record: JsonRecord, index: number, depth: number): StepItem {
  const numberKey = findKey(record, STEP_NUMBER_KEYS, isScalar);
  const titleKey = findKey(record, STEP_TITLE_KEYS, isShortString);
  const bodyKey = findKey(record, STEP_BODY_KEYS, value => typeof value === 'string', titleKey);

  return {
    number: numberKey ? String(record[numberKey]) : String(index + 1),
    title: titleKey ? cleanText(record[titleKey] as string) : '',
    description: bodyKey ? cleanText(record[bodyKey] as string) : '',
    fields: toFields(record, new Set([numberKey, titleKey, bodyKey]), depth)
  };
}

function toCard(record: JsonRecord, depth: number): CardItem {
  const titleKey = findKey(record, CARD_TITLE_KEYS, value => isShortString(value) || typeof value === 'number');
  const severityKey = findKey(record, SEVERITY_KEYS, isScalar);

  return {
    title: titleKey ? cleanText(String(record[titleKey])) : '',
    titleIsCode: titleKey ? CODE_TITLE_KEYS.has(normalizeKey(titleKey)) : false,
    severity: severityKey ? toSeverity(record[severityKey] as string | number, severityKey) : null,
    fields: toFields(record, new Set([titleKey, severityKey]), depth)
  };
}

function toFields(record: JsonRecord, exclude: Set<string | undefined>, depth: number): Field[] {
  const fields: Field[] = [];

  for (const [key, value] of Object.entries(record)) {
    const normalized = normalizeKey(key);

    if (exclude.has(key) || META_KEYS.has(normalized)) {
      continue;
    }

    const node = toNode(value, normalized, depth + 1);
    if (node) {
      fields.push({ key, label: humanizeKey(key), node });
    }
  }

  return fields;
}

function isStepList(records: JsonRecord[], key: string): boolean {
  const numbered = records.every(record => {
    const numberKey = findKey(record, STEP_NUMBER_KEYS, isScalar);
    return numberKey !== undefined && !Number.isNaN(Number(record[numberKey]));
  });

  if (numbered) {
    return true;
  }

  return ORDERED_KEY.test(key)
    && records.every(record => findKey(record, STEP_TITLE_KEYS, isShortString) !== undefined);
}

/** `{ "code": "...", "language": "java" }` style objects. */
function isCodeRecord(record: JsonRecord): boolean {
  const keys = Object.keys(record).map(normalizeKey);
  const codeKey = findKey(record, ['code', 'snippet'], value => typeof value === 'string');
  return codeKey !== undefined && keys.every(key => ['code', 'snippet', 'language', 'lang'].includes(key));
}

function codeRecordNode(record: JsonRecord): AnswerNode {
  const codeKey = findKey(record, ['code', 'snippet'], value => typeof value === 'string');
  const languageKey = findKey(record, ['language', 'lang'], value => typeof value === 'string');
  const code = codeKey ? String(record[codeKey]) : '';
  const language = languageKey ? String(record[languageKey]) : guessLanguage('code', code);
  return { type: 'code', code, language };
}

function toSeverity(value: string | number | boolean, key: string): Severity {
  const text = String(value).trim();
  const lower = text.toLowerCase();

  let level: SeverityLevel = 'unknown';

  if (/\b(crit|critical|blocker|emergency|sev ?1|p0)\b/.test(lower)) {
    level = 'critical';
  } else if (/\b(high|major|severe|sev ?2|p1)\b/.test(lower)) {
    level = 'high';
  } else if (/\b(med|medium|moderate|warn|warning|sev ?3|p2)\b/.test(lower)) {
    level = 'medium';
  } else if (/\b(low|minor|trivial|sev ?4|p3)\b/.test(lower)) {
    level = 'low';
  } else if (/\b(info|informational|none|ok|healthy|normal|negligible)\b/.test(lower)) {
    level = 'info';
  }

  const valueLabel = lower.charAt(0).toUpperCase() + lower.slice(1);
  return { label: `${valueLabel} ${humanizeKey(key).toLowerCase()}`, level };
}

function guessLanguage(key: string, code: string): string {
  if (/kql/.test(key) || /\|\s*(where|project|summarize|extend|take|order by|render)\b/i.test(code)) {
    return 'kql';
  }
  if (/sql/.test(key) || /^\s*(select|with|insert|update|delete)\b/i.test(code)) {
    return 'sql';
  }
  if (/(command|commands|cmd|script|curl)$/.test(key)) {
    return 'bash';
  }
  if (/(stack_trace|stacktrace|logs?|log_excerpt)$/.test(key)) {
    return 'log';
  }
  if (/(yaml|yml)$/.test(key)) {
    return 'yaml';
  }
  if (/json$/.test(key)) {
    return 'json';
  }
  if (/xml$/.test(key)) {
    return 'xml';
  }
  return '';
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** `exceptionsObserved`, `Exceptions-Observed` and `exceptions_observed` all become `exceptions_observed`. */
function normalizeKey(key: string): string {
  return key
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s.-]+/g, '_')
    .toLowerCase();
}

/**
 * Returns the original key of `record` whose normalized form is the first match
 * in `candidates` (candidate order = preference) and whose value passes `accept`.
 */
function findKey(
  record: JsonRecord,
  candidates: string[],
  accept: (value: unknown) => boolean = () => true,
  exclude?: string
): string | undefined {
  const byNormalized = new Map<string, string>();
  for (const key of Object.keys(record)) {
    byNormalized.set(normalizeKey(key), key);
  }

  for (const candidate of candidates) {
    const key = byNormalized.get(candidate);
    if (key !== undefined && key !== exclude && accept(record[key])) {
      return key;
    }
  }

  return undefined;
}

/** Removes retrieval artefacts such as `[Chunk #3]` from model output. */
function cleanText(value: string): string {
  return value.replace(/[ \t]*\[Chunk\s*#?\d+\]/gi, '').trim();
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isScalar(value: unknown): value is string | number | boolean {
  return (typeof value === 'string' && value.trim().length > 0 && value.length <= 40)
    || typeof value === 'number'
    || typeof value === 'boolean';
}

function isShortString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 120;
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim().length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (isRecord(value)) {
    return Object.keys(value).length === 0;
  }
  return false;
}
