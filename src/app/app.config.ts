import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { SbbIconModule } from '@sbb-esta/angular/icon';
import { OverlayscrollbarsModule } from 'overlayscrollbars-ngx';
import { inject } from '@angular/core';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { ErrorInterceptor } from './interceptors/error.interceptor';
import { LoadingInterceptor } from './interceptors/loading.interceptor';

/**
 * Application configuration with providers
 * Sets up:
 * - Zone.js change detection with event coalescing
 * - Animations (loaded asynchronously)
 * - HTTP client with interceptors for auth, error handling, and loading state
 * - SBB Icon module for the SBB design system icons
 */
/**
 * Functional interceptor wrappers for class-based interceptors
 */
function authInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  return inject(AuthInterceptor).intercept(req, { handle: next });
}

function errorInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  return inject(ErrorInterceptor).intercept(req, { handle: next });
}

function loadingInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  return inject(LoadingInterceptor).intercept(req, { handle: next });
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideAnimationsAsync(),
    provideHttpClient(
      withInterceptors([
        authInterceptor,
        errorInterceptor,
        loadingInterceptor
      ])
    ),
    // Provide interceptor instances
    AuthInterceptor,
    ErrorInterceptor,
    LoadingInterceptor,
    importProvidersFrom(SbbIconModule, OverlayscrollbarsModule)
  ]
};
