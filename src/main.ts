/**
 * @fileoverview Main entry point for the SKI+ Train Formation Visualization application
 * 
 * This is the application bootstrapping file that:
 * - Initializes the Angular application
 * - Loads the root AppComponent
 * - Applies the configuration from app.config.ts
 * - Sets up error handling for bootstrap failures
 */

import { bootstrapApplication } from '@angular/platform-browser';
import { OverlayScrollbars, ClickScrollPlugin } from 'overlayscrollbars';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Initialize OverlayScrollbars plugins
OverlayScrollbars.plugin(ClickScrollPlugin);

/**
 * Application entry point
 * Bootstraps the AppComponent with the provided configuration
 */
bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));

// Patch for missing __spreadValues helper (used by DarkReader ESM bundle)
// Fix for: Uncaught ReferenceError: __spreadValues / j is not defined
// See: https://github.com/darkreader/darkreader/issues/13645
(window as unknown as Record<string, unknown>)['__spreadValues'] = (first: Record<string, unknown>, second: Record<string, unknown>) => {
  for (const prop in second) {
    if (Object.prototype.hasOwnProperty.call(second, prop)) {
      first[prop] = second[prop];
    }
  }
  return first;
};

// Additional polyfills for minified variable names that Dark Reader might expect
// In production builds, TypeScript helpers get minified to single letters
const globalWindow = window as unknown as Record<string, unknown>;
if (!globalWindow['j']) {
  globalWindow['j'] = globalWindow['__spreadValues'];
}

// Also ensure other common TypeScript helpers are available
if (!globalWindow['__assign']) {
  globalWindow['__assign'] = Object.assign || function(target: Record<string, unknown>, ...sources: Record<string, unknown>[]) {
    for (const source of sources) {
      for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }
    return target;
  };
}
