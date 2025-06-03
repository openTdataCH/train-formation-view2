/**
 * @fileoverview Theme Management Service
 * 
 * This service handles application-wide theme switching using Dark Reader library.
 * Provides functionality to:
 * - Toggle between light and dark modes
 * - Persist theme preferences in localStorage
 * - Follow system color scheme preferences
 * - Apply custom styling fixes for dark mode compatibility
 * 
 * The service automatically initializes with user's saved preference or system default.
 */

import { Injectable } from '@angular/core';
import { enable as enableDarkMode, disable as disableDarkMode, auto as followSystemColorScheme, isEnabled } from 'darkreader';
import { BehaviorSubject } from 'rxjs';

/**
 * Core service for application theme management
 */
@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  // Static constants
  private static readonly DARK_MODE_STORAGE_KEY = 'darkMode';
  
  // Dark Reader configuration
  private static readonly DARK_READER_CONFIG = {
    brightness: 100,
    contrast: 100,
    sepia: 0
  };

  private static readonly DARK_READER_FIXES = {
    css: `
      /* Custom styling fixes for train visualization in dark mode */
      .boundary-line {
        background-color: #8faad7 !important;
      }
      .sector-horizontal-line {
        background-color: #373c3e !important;
      }
    `,
    invert: [],
    ignoreInlineStyle: [],
    ignoreImageAnalysis: [],
    disableStyleSheetsProxy: false
  };

  // State management
  private readonly darkModeSubject = new BehaviorSubject<boolean>(false);
  readonly darkMode$ = this.darkModeSubject.asObservable();

  constructor() {
    this.initializeTheme();
  }

  /**
   * Initializes theme based on saved preference or system default
   */
  private initializeTheme(): void {
    // Ensure polyfill is available before using Dark Reader
    this.ensureSpreadValuesPolyfill();
    
    // Initialize theme from localStorage or system preference
    const savedPreference = localStorage.getItem(ThemeService.DARK_MODE_STORAGE_KEY);
    if (savedPreference !== null) {
      this.setDarkMode(savedPreference === 'true');
    } else {
      this.followSystemPreference();
    }
  }

  /**
   * Toggles between dark and light mode and persists the preference
   */
  toggleDarkMode(): void {
    const newState = !this.darkModeSubject.value;
    this.setDarkMode(newState);
    localStorage.setItem(ThemeService.DARK_MODE_STORAGE_KEY, String(newState));
  }

  /**
   * Gets current dark mode state
   * @returns Current dark mode state
   */
  isDarkMode(): boolean {
    return this.darkModeSubject.value;
  }

  /**
   * Sets dark mode state explicitly
   * @param isDark Whether to enable dark mode
   */
  private setDarkMode(isDark: boolean): void {
    if (isDark) {
      enableDarkMode(ThemeService.DARK_READER_CONFIG, ThemeService.DARK_READER_FIXES);
    } else {
      disableDarkMode();
    }
    this.darkModeSubject.next(isDark);
  }

  /**
   * Follows system color scheme preference using Dark Reader auto mode
   */
  private followSystemPreference(): void {
    followSystemColorScheme(ThemeService.DARK_READER_CONFIG, ThemeService.DARK_READER_FIXES);
    this.darkModeSubject.next(isEnabled());
  }

  /**
   * Ensures __spreadValues polyfill is available for Dark Reader compatibility
   * 
   * Dark Reader requires this polyfill for proper operation in certain environments.
   * This method adds it to the global scope if not already present.
   */
  private ensureSpreadValuesPolyfill(): void {
    const globalWindow = window as unknown as Record<string, unknown>;
    
    if (typeof globalWindow['__spreadValues'] === 'undefined') {
      globalWindow['__spreadValues'] = function(
        target: Record<string, unknown>, 
        source: Record<string, unknown>
      ): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        
        // Copy target properties
        for (const key in target) {
          if (Object.prototype.hasOwnProperty.call(target, key)) {
            result[key] = target[key];
          }
        }
        
        // Copy source properties (overwriting target if duplicate keys)
        for (const key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            result[key] = source[key];
          }
        }
        
        return result;
      };
    }
  }
}
