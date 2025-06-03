/**
 * @fileoverview Root Application Component for SKI+ Train Formation Visualization
 * 
 * This component serves as the primary application container and orchestrates:
 * - Main application layout with header and navigation
 * - Search form integration for train formation lookup
 * - Train formation visualization component management
 * - Legend component display based on search results
 * - Dynamic spacing calculations for optimal scrolling
 * - OverlayScrollbars integration for consistent scrollbars across
 * - SVG asset preloading for improved performance
 * 
 * The component manages complex state synchronization between search results,
 * legend visibility, and dynamic viewport spacing calculations.
 */

import { Component, ViewEncapsulation, OnInit, OnDestroy, AfterViewInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, BehaviorSubject } from 'rxjs';
import { OverlayScrollbars } from 'overlayscrollbars';

// Application components
import { HeaderComponent } from './components/header/header.component';
import { SearchFormComponent } from './components/search-form/search-form.component';
import { TrainFormationComponent } from './components/train-formation/train-formation.component';
import { TrainLegendComponent } from './components/train-legend/train-legend.component';

// Application services
import { FormationService } from './services/formation.service';
import { SvgPreloaderService } from './services/svg-preloader.service';
import { ScrollService } from './services/scroll.service';

/**
 * Root application component managing layout and state coordination
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    SearchFormComponent,
    TrainFormationComponent,
    TrainLegendComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
  // Static constants for layout calculations
  private static readonly ANCHOR_POINT = 78; // Fixed header height as anchor point
  private static readonly MIN_SPACING = 40; // Minimum bottom spacing
  private static readonly SPACING_CALCULATION_DELAY = 100; // Delay for spacing recalculation
  private static readonly SCROLLBAR_THEME = 'os-theme-ski-body';
  private static readonly SCROLLBAR_AUTO_HIDE_DELAY = 1000;

  // Public properties for template
  readonly title = 'Train Formation Visualization';
  showLegend = false;
  bottomSpacingHeight = '0px';

  // State management
  private readonly spacingReadySubject = new BehaviorSubject<boolean>(false);
  private readonly subscriptions: Subscription[] = [];
  private bodyOsInstance: OverlayScrollbars | null = null;

  constructor(
    private formationService: FormationService,
    private scrollService: ScrollService,
    private svgPreloaderService: SvgPreloaderService,
    private ngZone: NgZone
  ) {}

  /**
   * Initializes component after view initialization
   * Sets up OverlayScrollbars and initial scroll positioning
   */
  ngAfterViewInit(): void {
    this.initializeBodyOverlayScrollbars();
    this.setInitialScrollPosition();
  }

  /**
   * Initializes component and sets up service subscriptions
   * Starts SVG preloading and monitors formation/error state changes
   */
  ngOnInit(): void {
    this.startSvgPreloading();
    this.subscribeToFormationUpdates();
    this.subscribeToErrorUpdates();
  }

  /**
   * Returns observable for spacing calculation completion state
   * @returns Observable that emits when spacing calculations are ready
   */
  getSpacingReadyState() {
    return this.spacingReadySubject.asObservable();
  }

  /**
   * Cleanup method to prevent memory leaks
   * Unsubscribes from all observables and destroys OverlayScrollbars instance
   */
  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.spacingReadySubject.complete();
    this.destroyOverlayScrollbars();
  }

  /**
   * Initializes OverlayScrollbars for the body element
   * 
   * CRITICAL: Must run outside Angular zone to prevent infinite loops 
   * with MutationObserver that OverlayScrollbars uses internally.
   */
  private initializeBodyOverlayScrollbars(): void {
    this.ngZone.runOutsideAngular(() => {
      this.bodyOsInstance = OverlayScrollbars(
        {
          target: document.body,
          cancel: {
            body: false,
          },
        },
        {
          scrollbars: {
            theme: AppComponent.SCROLLBAR_THEME,
            autoHide: 'scroll' as const,
            autoHideDelay: AppComponent.SCROLLBAR_AUTO_HIDE_DELAY,
          },
        }
      );

      // Register instance with ScrollService for coordinated scrolling
      this.scrollService.setBodyOverlayScrollbarsInstance(this.bodyOsInstance);
    });
  }

  /**
   * Sets initial scroll position to search form at anchor point
   */
  private setInitialScrollPosition(): void {
    const searchForm = document.querySelector('app-search-form');
    if (!searchForm) {
      return;
    }

    // Force initial scroll to top, then position search form at anchor
    this.scrollService.scrollToTop();
    this.scrollService.scrollToAnchor(searchForm, 'instant');
  }

  /**
   * Starts SVG preloading for improved theme switching performance
   */
  private startSvgPreloading(): void {
    this.svgPreloaderService.preloadAllSvgs()
      .then(() => {
        // SVG preloading completed silently
      })
      .catch(error => {
        console.warn('SVG preloading failed:', error);
      });
  }

  /**
   * Subscribes to formation service updates for legend visibility and spacing
   */
  private subscribeToFormationUpdates(): void {
    this.subscriptions.push(
      this.formationService.currentFormation$.subscribe(formation => {
        this.handleFormationUpdate(formation);
      })
    );
  }

  /**
   * Subscribes to error state updates
   */
  private subscribeToErrorUpdates(): void {
    this.subscriptions.push(
      this.formationService.currentError$.subscribe(error => {
        this.handleErrorUpdate(error);
      })
    );
  }

  /**
   * Handles formation data updates and manages legend visibility
   * @param formation Current formation data or null
   */
  private handleFormationUpdate(formation: unknown): void {
    this.showLegend = !!formation;

    if (formation) {
      this.scheduleSpacingCalculation();
    } else {
      this.resetSpacing();
    }
  }

  /**
   * Handles error state updates
   * @param error Current error state or null
   */
  private handleErrorUpdate(error: unknown): void {
    if (error) {
      this.showLegend = false;
      this.resetSpacing();
    }
  }

  /**
   * Schedules dynamic spacing calculation with proper timing
   */
  private scheduleSpacingCalculation(): void {
    // Reset spacing ready state
    this.spacingReadySubject.next(false);

    // Ensure components are rendered before calculating spacing
    requestAnimationFrame(() => {
      this.calculateDynamicSpacing();

      // Double check spacing after delay for component stabilization
      setTimeout(() => {
        this.calculateDynamicSpacing();

        // Final verification of spacing
        requestAnimationFrame(() => {
          this.calculateDynamicSpacing();
          this.spacingReadySubject.next(true);
        });
      }, AppComponent.SPACING_CALCULATION_DELAY);
    });
  }

  /**
   * Resets spacing to default state
   */
  private resetSpacing(): void {
    this.bottomSpacingHeight = '0px';
    this.spacingReadySubject.next(false);
  }

  /**
   * Calculates dynamic bottom spacing for optimal scrolling experience
   * 
   * This method ensures the train formation can always reach the anchor point
   * by calculating the required bottom spacing based on:
   * - Current viewport height
   * - Formation component height
   * - Legend component height
   * - Footer height
   * - Minimum spacing requirements
   */
  private calculateDynamicSpacing(): void {
    const elements = this.getDomElements();
    if (!elements.trainFormation || !elements.footer) {
      return;
    }

    const viewportHeight = this.getViewportHeight();
    const componentHeights = this.calculateComponentHeights({
      trainFormation: elements.trainFormation,
      trainLegend: elements.trainLegend,
      footer: elements.footer
    });
    const requiredSpacing = this.calculateRequiredSpacing(viewportHeight, componentHeights);

    this.applySpacing(requiredSpacing);
    this.ensureProperScrollPosition(elements.trainFormation);
  }

  /**
   * Gets relevant DOM elements for spacing calculations
   * @returns Object containing DOM element references
   */
  private getDomElements() {
    return {
      trainFormation: document.querySelector('app-train-formation'),
      trainLegend: document.querySelector('app-train-legend'),
      footer: document.querySelector('.footer')
    };
  }

  /**
   * Gets current viewport height, preferring OverlayScrollbars viewport if available
   * @returns Viewport height in pixels
   */
  private getViewportHeight(): number {
    if (this.bodyOsInstance) {
      const { viewport } = this.bodyOsInstance.elements();
      return viewport.clientHeight;
    }
    return window.innerHeight;
  }

  /**
   * Calculates heights of all relevant components
   * @param elements DOM elements object
   * @returns Object containing component heights
   */
  private calculateComponentHeights(elements: {
    trainFormation: Element;
    trainLegend?: Element | null;
    footer: Element;
  }) {
    return {
      formation: elements.trainFormation.getBoundingClientRect().height,
      legend: elements.trainLegend?.getBoundingClientRect().height || 0,
      footer: elements.footer.getBoundingClientRect().height
    };
  }

  /**
   * Calculates required spacing based on viewport and component heights
   * @param viewportHeight Current viewport height
   * @param heights Component heights object
   * @returns Required spacing in pixels
   */
  private calculateRequiredSpacing(viewportHeight: number, heights: {
    formation: number;
    legend: number;
    footer: number;
  }): number {
    const minRequiredHeight = AppComponent.ANCHOR_POINT + 
                              heights.formation + 
                              heights.legend + 
                              heights.footer + 
                              AppComponent.MIN_SPACING;

    let requiredSpace = Math.max(
      viewportHeight - minRequiredHeight + AppComponent.ANCHOR_POINT,
      AppComponent.MIN_SPACING
    );

    // Ensure enough space to scroll formation to anchor for larger viewports
    if (viewportHeight > minRequiredHeight) {
      const extraSpaceNeeded = viewportHeight - minRequiredHeight;
      requiredSpace = Math.max(requiredSpace, extraSpaceNeeded + AppComponent.MIN_SPACING);
    }

    return requiredSpace;
  }

  /**
   * Applies calculated spacing to the bottom spacing element
   * @param spacing Spacing value in pixels
   */
  private applySpacing(spacing: number): void {
    this.bottomSpacingHeight = `${spacing}px`;
    this.spacingReadySubject.next(true);
  }

  /**
   * Ensures proper scroll position after spacing calculation
   * @param trainFormation Train formation DOM element
   */
  private ensureProperScrollPosition(trainFormation: Element): void {
    if (trainFormation.getBoundingClientRect().top !== AppComponent.ANCHOR_POINT) {
      this.scrollService.scrollToAnchor(trainFormation);
    }
  }

  /**
   * Destroys OverlayScrollbars instance and cleans up resources
   */
  private destroyOverlayScrollbars(): void {
    if (this.bodyOsInstance) {
      this.bodyOsInstance.destroy();
      this.bodyOsInstance = null;
    }
  }
}
