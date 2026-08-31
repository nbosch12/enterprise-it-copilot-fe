import { Injectable, signal } from '@angular/core';

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private messages = signal<ChatMessage[]>([]);
  private messageCounter = 0;

  // Get the signal directly — use .read() or pass to toSignal in components
  getMessages() {
    return this.messages;
  }

  addMessage(role: 'user' | 'assistant', content: string): void {
    this.messageCounter++;
    this.messages.update(msgs => [
      ...msgs,
      {
        id: this.messageCounter,
        role,
        content,
        timestamp: new Date()
      }
    ]);
  }

  clearMessages(): void {
    this.messages.set([]);
    this.messageCounter = 0;
  }

  getResponse(userMessage: string): string {
    const lower = userMessage.toLowerCase();

    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
      return 'Hello! 👋 Welcome to Enterprise IT Copilot. How can I help you today?';
    }
    if (lower.includes('help')) {
      return 'I can help you with:\n• General IT queries\n• System information\n• Troubleshooting tips\n• Navigation guidance\n\nJust ask me anything!';
    }
    if (lower.includes('what can you do') || lower.includes('capabilities')) {
      return 'I\'m your Enterprise IT Copilot assistant! I can help with:\n• Answering IT-related questions\n• Providing system guidance\n• Assisting with navigation\n• Troubleshooting common issues';
    }
    if (lower.includes('angular')) {
      return '🅰️ This application is built with **Angular 21.2.0** using standalone components, signals, and the @bci-web-core framework. It features a modern chatbot interface with real-time messaging.';
    }
    if (lower.includes('who made you') || lower.includes('who created') || lower.includes('developer')) {
      return 'I was built as part of the SAP BTP Hackathon project by the enterprise IT team. We used modern Angular technologies to create this intelligent assistant.';
    }
    if (lower.includes('thank')) {
      return 'You\'re welcome! 😊 Feel free to ask if you need anything else.';
    }
    if (lower.includes('bye')) {
      return 'Goodbye! 👋 Have a great day. Don\'t hesitate to come back if you need help!';
    }

    const responses = [
      `Great question! Based on my knowledge about "${userMessage}", I'd suggest exploring the enterprise IT documentation for detailed information. Is there anything specific you'd like to know?`,
      `I appreciate your query about "${userMessage}". Let me connect you with the relevant resources. Could you provide more details so I can assist you better?`,
      `Thanks for reaching out! About "${userMessage}" — our IT support team has comprehensive guides on this topic. Would you like me to point you in the right direction?`,
      `That's an interesting question regarding "${userMessage}". In the context of our enterprise systems, I'd recommend checking the knowledge base for the most up-to-date information.`
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }
}
