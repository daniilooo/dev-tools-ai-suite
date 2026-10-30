import { provideHttpClient, withInterceptors } from "@angular/common/http";
import type { ApplicationConfig } from "@angular/core";
import { inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from "@angular/core";
import { provideRouter, withComponentInputBinding } from "@angular/router";
import { routes } from "./app.routes";
import { AuthService } from "./core/auth.service";
import { securityInterceptor } from "./core/security.interceptor";
import { ThemeService } from "./core/theme.service";

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([securityInterceptor])),
    provideAppInitializer(() => {
      inject(ThemeService).init();
      return inject(AuthService).init();
    }),
  ],
};
