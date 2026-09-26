import { CardsNode, ListNode, StepsNode } from '../models/answer';
import { humanizeKey, parseAssistantPayload } from './answer-parser';

const WORKFLOW_ANSWER = {
  answer: 'The QR Code Redirect Service resolves a scanned QR code UUID into the most appropriate destination URL.',
  workflow: [
    { step: 1, name: 'QR code scan', details: 'The QR code invokes the qrCodeRedirector endpoint.' },
    {
      step: 2,
      name: 'Destination selection',
      details: 'RedirectHelper determines the destination URL.',
      selection_order: ['Use a direct country URL.', 'Try a DXF locale.']
    }
  ],
  operational_notes: ['The redirect path is designed for low latency.']
};

const EXCEPTIONS_ANSWER = {
  answer: 'No explicit exceptions were logged by the QR Codes reader today.',
  severity: 'LOW',
  exceptions_observed: [
    { component: 'redirect', issue: 'MSAL cache miss.', outcome: 'Token acquired.', impact: 'None.' }
  ],
  recommended_actions: ['Verify clock synchronization.'],
  data_limitations: ['The documentation grounding search failed.'],
  conclusion: 'Only recoverable authentication cache failures were found.'
};

describe('parseAssistantPayload', () => {
  it('parses JSON returned as a string inside "answer"', () => {
    const result = parseAssistantPayload({ answer: JSON.stringify(WORKFLOW_ANSWER) });

    expect(result.kind).toBe('structured');
    expect(result.summary).toBe(WORKFLOW_ANSWER.answer);
    expect(result.sections.map(section => section.title)).toEqual(['Workflow', 'Operational notes']);

    const steps = result.sections[0].node as StepsNode;
    expect(steps.type).toBe('steps');
    expect(steps.steps[1].title).toBe('Destination selection');
    expect(steps.steps[1].description).toBe('RedirectHelper determines the destination URL.');
    expect(steps.steps[1].fields[0].label).toBe('Selection order');
    expect((steps.steps[1].fields[0].node as ListNode).ordered).toBeTrue();

    const notes = result.sections[1].node as ListNode;
    expect(notes.type).toBe('list');
    expect(notes.ordered).toBeFalse();
  });

  it('parses JSON returned directly as the response body', () => {
    const result = parseAssistantPayload(EXCEPTIONS_ANSWER);

    expect(result.kind).toBe('structured');
    expect(result.severity).toEqual({ label: 'Low severity', level: 'low' });
    expect(result.conclusion).toBe(EXCEPTIONS_ANSWER.conclusion);
    expect(result.rawJson).toContain('"exceptions_observed"');

    const cards = result.sections[0].node as CardsNode;
    expect(cards.type).toBe('cards');
    expect(cards.cards[0].title).toBe('redirect');
    expect(cards.cards[0].titleIsCode).toBeTrue();
    expect(cards.cards[0].fields.map(field => field.label)).toEqual(['Issue', 'Outcome', 'Impact']);

    const limitations = result.sections.find(section => section.key === 'data_limitations');
    expect(limitations?.tone).toBe('note');
  });

  it('parses double-encoded, fenced and escaped JSON text', () => {
    const json = JSON.stringify(EXCEPTIONS_ANSWER, null, 2);
    const escaped = JSON.stringify(json).slice(1, -1); // `{\n  \"answer\": ...}` as seen in logs

    for (const payload of [JSON.stringify(json), { answer: '```json\n' + json + '\n```' }, { answer: escaped }]) {
      const result = parseAssistantPayload(payload);
      expect(result.kind).toBe('structured');
      expect(result.summary).toBe(EXCEPTIONS_ANSWER.answer);
    }
  });

  it('keeps plain text answers as markdown and removes chunk references', () => {
    const result = parseAssistantPayload({ answer: 'Restart the pod [Chunk #3].\n\n```bash\nkubectl get pods\n```' });

    expect(result.kind).toBe('markdown');
    expect(result.summary).toBe('Restart the pod.\n\n```bash\nkubectl get pods\n```');
    expect(result.sections).toEqual([]);
  });

  it('does not treat markdown that mentions braces as JSON', () => {
    const result = parseAssistantPayload({ answer: 'Use {uuid} in the URL template.' });

    expect(result.kind).toBe('markdown');
    expect(result.summary).toBe('Use {uuid} in the URL template.');
  });

  it('shows text fields returned next to "answer" as sections', () => {
    const result = parseAssistantPayload({ answer: 'The service is healthy.', root_cause: 'None found.' });

    expect(result.kind).toBe('structured');
    expect(result.sections[0].title).toBe('Root cause');
    expect(result.sections[0].node).toEqual({ type: 'text', text: 'None found.' });
  });

  it('shows code-like fields as code blocks', () => {
    const result = parseAssistantPayload({
      answer: 'Run this query.',
      kql_query: 'AppExceptions\n| where TimeGenerated > ago(1d)'
    });

    expect(result.sections[0].node).toEqual({
      type: 'code',
      code: 'AppExceptions\n| where TimeGenerated > ago(1d)',
      language: 'kql'
    });
  });
});

describe('humanizeKey', () => {
  it('turns keys into sentence-case headings', () => {
    expect(humanizeKey('exceptions_observed')).toBe('Exceptions observed');
    expect(humanizeKey('recommendedActions')).toBe('Recommended actions');
    expect(humanizeKey('qr_code_url')).toBe('QR code URL');
  });
});
