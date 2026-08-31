import { Component, signal, computed, inject, ElementRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatMessage } from '../../services/chat.service';
import {MatIcon} from '@angular/material/icon';

@Component({
  selector: 'app-btp-chatbot',
  imports: [FormsModule, MatIcon],
  templateUrl: './btp-chatbot.html',
  styleUrl: './btp-chatbot.scss',
})
export class BtpChatbot {
  private chatService = inject(ChatService);
  private chatInput = viewChild<ElementRef<HTMLTextAreaElement>>('chatInput');

  // Use the service signal directly — it's reactive
  get messages(): () => ChatMessage[] {
    return this.chatService.getMessages();
  }

  userInput = signal('');
  isTyping = signal(false);
  userName = signal('userName');

  isEmpty = computed(() => this.messages().length === 0);

  sendMessage(): void {
    const text = this.userInput().trim();
    if (!text) return;

    this.chatService.addMessage('user', text);
    this.userInput.set('');

    this.isTyping.set(true);

    setTimeout(() => {
      const reply = this.chatService.getResponse(text);
      this.chatService.addMessage('assistant', reply);
      this.isTyping.set(false);
    }, 500 + Math.random() * 1000);
  }

  clearChat(): void {
    this.chatService.clearMessages();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  sendQuickMessage(text: string): void {
    this.userInput.set(text);
    this.sendMessage();
    // Focus textarea after sending
    setTimeout(() => {
      this.chatInput()?.nativeElement.focus();
    }, 100);
  }

  highlightContent(text: string): string {
    // Simple markdown-like bold highlighting
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }
}
