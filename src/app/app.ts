import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {BciLayoutModule} from '@bci-web-core/core';


@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    BciLayoutModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('Enterprise IT Copilot');
}
