import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {BciLayoutModule} from '@bci-web-core/core';
import {BtpChatbot} from './components/btp-chatbot/btp-chatbot';


@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    BciLayoutModule,
    BtpChatbot
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('Enterprise IT Copilot');
}
