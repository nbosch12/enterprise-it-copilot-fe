import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';

import { NewChatbot } from './new-chatbot';
import { ChatService, MessageEntry } from '../../services/chat.service';
import { parseAssistantPayload } from '../../utils/answer-parser';

describe('NewChatbot', () => {
  let component: NewChatbot;
  let fixture: ComponentFixture<NewChatbot>;
  let chatService: jasmine.SpyObj<ChatService>;

  beforeEach(async () => {
    chatService = jasmine.createSpyObj<ChatService>('ChatService', ['SendMessage']);
    chatService.SendMessage.and.returnValue(of());

    await TestBed.configureTestingModule({
      imports: [NewChatbot],
      providers: [
        {
          provide: ChatService,
          useValue: chatService
        }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewChatbot);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show chat history below the history button', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.sidebar-btn') as NodeListOf<HTMLButtonElement>;

    buttons[1].click();
    fixture.detectChanges();

    expect(buttons[1].getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('.history-empty')?.textContent).toContain('No chat history');
  });

  it('should archive and restore a conversation', () => {
    const message = createMessage('How do I reset my password?');
    const originalSessionId = component.currentSessionId();
    component.messages.set([message]);

    component.clearChat();
    expect(component.currentSessionId()).not.toBe(originalSessionId);

    component.toggleChatHistory();
    fixture.detectChanges();

    const historyItem = fixture.nativeElement.querySelector('.sidebar-item') as HTMLButtonElement;
    expect(historyItem.textContent).toContain(message.content);

    historyItem.click();

    expect(component.messages()).toEqual([message]);
    expect(component.currentSessionId()).toBe(originalSessionId);
    expect(component.isHistoryOpen()).toBeFalse();
  });

  it('should send messages using the active backend session', () => {
    component.userInput.set('What is my device status?');

    component.sendMessage();

    expect(chatService.SendMessage).toHaveBeenCalledWith(
      jasmine.objectContaining({ sessionId: component.currentSessionId() })
    );
  });

  it('should show sections of a JSON answer once the summary has streamed', fakeAsync(() => {
    const parsed = parseAssistantPayload({
      answer: JSON.stringify({
        answer: 'The redirect service resolves a QR code UUID.',
        severity: 'LOW',
        workflow: [
          { step: 1, name: 'QR code scan', details: 'The QR code calls the redirect endpoint.' },
          { step: 2, name: 'Browser redirect', details: 'The user is redirected.' }
        ],
        recommended_actions: ['Verify the country URL configuration.']
      })
    });
    chatService.SendMessage.and.returnValue(of({
      ...createMessage('How does the redirect work?'),
      id: 'answer-1',
      role: 'assistant',
      content: parsed.summary,
      structured: parsed
    }));

    component.userInput.set('How does the redirect work?');
    component.sendMessage();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.answer-section').length).toBe(0);

    tick(5000);
    fixture.detectChanges();

    expect(element.querySelector('app-severity-badge')?.textContent).toContain('Low severity');
    expect(element.querySelectorAll('.answer-section-title').length).toBe(2);
    expect(element.querySelectorAll('.answer-step').length).toBe(2);
    expect(element.querySelector('.answer-summary')?.textContent).toContain('resolves a QR code UUID');
  }));

  it('should complete a streaming answer when a new chat is started', fakeAsync(() => {
    chatService.SendMessage.and.returnValue(of({
      ...createMessage('question'),
      id: 'answer-2',
      role: 'assistant',
      content: 'one two three four five'
    }));

    component.userInput.set('question');
    component.sendMessage();
    tick(50);
    component.clearChat();

    const archived = component.chatHistory()[0].messages;
    expect(archived[archived.length - 1].content).toBe('one two three four five');
    expect(component.streamingId()).toBeNull();
  }));

  it('should show user text literally', () => {
    component.messages.set([createMessage('Replace <uuid> in the URL')]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.user-text')?.textContent).toContain('Replace <uuid> in the URL');
  });
});

function createMessage(content: string): MessageEntry {
  return {
    id: 'message-1',
    question: content,
    repositoryId: 'repository-1',
    sessionId: 'session-1',
    useHistory: true,
    historyTurns: 6,
    topK: 10,
    content,
    role: 'user',
    createdAt: new Date(),
    isTable: false
  };
}
