import {
  ApplicationConfig,
  importProvidersFrom,
  provideBrowserGlobalErrorListeners
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import {BciCoreModule} from '@bci-web-core/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    importProvidersFrom([
      BciCoreModule.forRoot({}),
    ]),
    provideRouter(routes)
  ]
};
