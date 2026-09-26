import { Component, OnDestroy, signal } from '@angular/core';
import { ChatService, MessageEntry } from '../../services/chat.service';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AnswerView } from '../answer-view/answer-view';
import { RichText } from '../rich-text/rich-text';

interface ChatHistoryEntry {
  id: string;
  title: string;
  sessionId: string;
  messages: MessageEntry[];
}

@Component({
  selector: 'app-new-chatbot',
   imports: [
    FormsModule,
    MatIconModule,
    AnswerView,
    RichText
  ],
  templateUrl: './new-chatbot.html',
  styleUrl: './new-chatbot.scss',
})
export class NewChatbot implements OnDestroy {
  /** Delay between words of the streamed assistant answer, in ms. */
  private static readonly WORD_DELAY_MS = 40;

  private streamTimer?: ReturnType<typeof setInterval>;

  /** The assistant message currently being revealed, kept whole so it can be completed early. */
  private streamingMessage?: MessageEntry;

  /** Id of the message being streamed. Structured sections are shown once streaming ends. */
  streamingId = signal<string | null>(null);

 // User input
  userInput = signal('');

  // Chat messages
  messages = signal<MessageEntry[]>([]);
  currentSessionId = signal<string>(crypto.randomUUID());

  // UI state
  isTyping = signal(false);
  isHistoryOpen = signal(false);
  chatHistory = signal<ChatHistoryEntry[]>([]);

  // Change this according to how you get the logged-in user's name
  userName = signal('User');


  constructor(private chatService: ChatService) {}


  /**
   * Returns true when there are no messages.
   */
  isEmpty(): boolean {
    return this.messages().length === 0;
  }


  /**
   * Handles Enter / Shift + Enter.
   *
   * Enter       -> Send message
   * Shift+Enter -> New line
   */
  onKeydown(event: KeyboardEvent): void {

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();

      this.sendMessage();
    }
  }


  /**
   * Sends the user's message to the backend.
   */
  sendMessage(): void {

    const question = this.userInput().trim();

    // Do nothing if input is empty
    if (!question || this.isTyping()) {
      return;
    }


    // Create user message
    const userMessage: MessageEntry = {
    id: crypto.randomUUID(),
    question: question,
    repositoryId: 'f0bf939b-59ef-4211-b8f0-db053c46cbad',
    sessionId: 'user-123',
    useHistory: true,
    historyTurns: 6,
    topK: 10,
    content: question,
    role: 'user',
    createdAt: new Date(),
    isTable: false
  };


    // Add user message immediately to chat
    this.messages.update(messages => [
      ...messages,
      userMessage
    ]);


    // Clear input box
    this.userInput.set('');


    // Show typing indicator
    this.isTyping.set(true);


    // Call ChatService
   this.chatService.SendMessage(userMessage).subscribe({

  next: (assistantMessage: MessageEntry) => {

    this.isTyping.set(false);

    this.streamAssistantMessage(assistantMessage);

  },

  error: (error) => {

    console.error('Error while sending message:', error);

    this.isTyping.set(false);

  }

});
  }


  /**
   * Appends the assistant message and reveals its content one word at a time.
   */
  private streamAssistantMessage(assistantMessage: MessageEntry): void {

    this.stopStreaming();

    const words = assistantMessage.content.split(/(\s+)/);

    this.messages.update(messages => [
      ...messages,
      { ...assistantMessage, content: '' }
    ]);

    this.streamingMessage = assistantMessage;
    this.streamingId.set(assistantMessage.id);

    let index = 0;

    this.streamTimer = setInterval(() => {

      if (index >= words.length) {
        this.stopStreaming();
        return;
      }

      const chunk = words[index++];

      this.messages.update(messages =>
        messages.map(message =>
          message.id === assistantMessage.id
            ? { ...message, content: message.content + chunk }
            : message
        )
      );
    }, NewChatbot.WORD_DELAY_MS);
  }


  /**
   * Stops the word-by-word reveal and shows the full answer, so an answer
   * interrupted by "New chat" or opening a history entry is never saved half-written.
   */
  private stopStreaming(): void {

    if (this.streamTimer) {
      clearInterval(this.streamTimer);
      this.streamTimer = undefined;
    }

    const streamed = this.streamingMessage;

    if (streamed) {
      this.messages.update(messages =>
        messages.map(message =>
          message.id === streamed.id
            ? { ...message, content: streamed.content }
            : message
        )
      );
    }

    this.streamingMessage = undefined;
    this.streamingId.set(null);
  }


  ngOnDestroy(): void {
    this.stopStreaming();
  }


  /**
   * Clears the current conversation.
   */
  clearChat(): void {

    this.stopStreaming();

    const currentMessages = this.messages();

    if (currentMessages.length > 0) {
      const firstQuestion = currentMessages.find(message => message.role === 'user')?.content;
      const sessionId = this.currentSessionId();

      this.chatHistory.update(history => [
        {
          id: sessionId,
          title: firstQuestion || 'New conversation',
          sessionId,
          messages: [...currentMessages]
        },
        ...history
      ]);
    }

    this.currentSessionId.set(crypto.randomUUID());
    this.messages.set([]);

    this.userInput.set('');

    this.isTyping.set(false);
  }


  toggleChatHistory(): void {
    this.isHistoryOpen.update(isOpen => !isOpen);
  }


  openChat(history: ChatHistoryEntry): void {
    this.stopStreaming();
    this.currentSessionId.set(history.sessionId);
    this.messages.set([...history.messages]);
    this.userInput.set('');
    this.isTyping.set(false);
    this.isHistoryOpen.set(false);
  }




}
