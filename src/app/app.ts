import { Component, signal } from '@angular/core';
import {BciLayoutModule} from '@bci-web-core/core';
import { HeaderComponent } from "./components/header-component/header-component";
import { NewChatbot } from './components/new-chatbot/new-chatbot';


@Component({
  selector: 'app-root',
  imports: [
    BciLayoutModule,
    NewChatbot,
    HeaderComponent
],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {
  protected readonly title = signal('Enterprise IT Copilot');
}
