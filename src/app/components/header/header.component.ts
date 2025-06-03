/**
 * @fileoverview Header Component for SKI+ Train Formation Visualization
 * 
 * This component implements the application header using the SBB Design System's
 * header-lean component for consistent branding and navigation. Features include:
 * - Application title and SKI+ branding
 * - Dark/light theme toggle functionality  
 * - Responsive design following SBB design guidelines
 * - Integration with ThemeService for theme state management
 * 
 * The component uses ViewEncapsulation.None to allow custom styling of SBB components.
 */

import { Component, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';

// SBB Angular components
import { SbbHeaderLeanModule } from '@sbb-esta/angular/header-lean';
import { SbbIconModule } from '@sbb-esta/angular/icon';
import { SbbButtonModule } from '@sbb-esta/angular/button';
import { SbbTooltipModule } from '@sbb-esta/angular/tooltip';

// Application services
import { ThemeService } from '../../services/theme.service';

/**
 * Header component providing application branding and theme controls
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    SbbHeaderLeanModule,
    SbbIconModule,
    SbbButtonModule,
    SbbTooltipModule
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class HeaderComponent {
  /** Observable for current dark mode state */
  readonly darkMode$: Observable<boolean>;

  constructor(private themeService: ThemeService) {
    this.darkMode$ = this.themeService.darkMode$;
  }

  /**
   * Toggles between light and dark theme modes
   * Theme state is automatically persisted by the ThemeService
   */
  toggleDarkMode(): void {
    this.themeService.toggleDarkMode();
  }

  // Simple component with no logic, hamburger menu is hidden via CSS
}
