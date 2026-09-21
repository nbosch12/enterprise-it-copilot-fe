import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { NewChatbot } from './new-chatbot';
import { ChatService, MessageEntry } from '../../services/chat.service';

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
