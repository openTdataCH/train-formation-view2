/**
 * @fileoverview Scroll Management Service
 * 
 * This service provides centralized scroll management for the train formation visualization.
 * Handles:
 * - Smooth scrolling to anchor points after search form submission
 * - Integration with OverlayScrollbars for enhanced scrolling experience
 * - Responsive anchor point calculation based on screen size
 * - Queue management to prevent conflicting scroll operations
 * - User scroll detection to avoid interrupting manual navigation
 */

import { Injectable } from '@angular/core';
import { OverlayScrollbars } from 'overlayscrollbars';

/**
 * Core service for application scroll behavior management
 */
@Injectable({
  providedIn: 'root'
})
export class ScrollService {
  // Static constants
  private static readonly BASE_ANCHOR_POINT = 78;
  private static readonly SCROLL_ANIMATION_DURATION = 300;
  private static readonly USER_SCROLL_TIMEOUT = 150;
  private static readonly MAX_SCROLL_POSITION = 10000; // Safety limit
  
  // Responsive breakpoints for anchor point adjustment
  private static readonly RESPONSIVE_BREAKPOINTS = {
    SMALL: 320,
    MEDIUM: 370
  };
  
  private static readonly ANCHOR_ADJUSTMENTS = {
    SMALL_SCREEN: -8,  // 320px: padding reduces from 24px to 16px
    MEDIUM_SCREEN: -4  // 370px: padding reduces from 24px to 20px
  };

  // State management
  private isScrolling = false;
  private scrollQueue: (() => void)[] = [];
  private isUserScrolling = false;
  private userScrollTimeout: NodeJS.Timeout | undefined;
  private bodyOsInstance: OverlayScrollbars | null = null;

  constructor() {
    this.initializeScrollListeners();
  }

  /**
   * Initializes event listeners for user scroll detection
   */
  private initializeScrollListeners(): void {
    window.addEventListener('wheel', this.handleUserScroll, { passive: true });
    window.addEventListener('touchmove', this.handleUserScroll, { passive: true });
  }

  /**
   * Sets the body OverlayScrollbars instance for enhanced scroll operations
   * @param instance OverlayScrollbars instance or null to use native scrolling
   */
  setBodyOverlayScrollbarsInstance(instance: OverlayScrollbars | null): void {
    try {
      this.bodyOsInstance = instance;
    } catch (error) {
      console.error('Error setting OverlayScrollbars instance:', error);
      this.bodyOsInstance = null;
    }
  }

  /**
   * Scrolls an element to the calculated anchor point
   * @param element Target element to scroll to
   * @param behavior Scroll behavior type
   * @param force Whether to force scroll even during user interaction
   */
  scrollToAnchor(element: Element, behavior: ScrollBehavior = 'smooth', force = false): void {
    this.performScroll(() => {
      if (force || !this.isUserScrolling) {
        try {
          const rect = element.getBoundingClientRect();
          const targetPosition = this.calculateTargetPosition(rect);
          
          this.executeScroll(targetPosition, behavior);
        } catch (error) {
          console.error('Error in scrollToAnchor:', error);
          this.emergencyScrollToTop();
        }
      }
    });
  }

  /**
   * Maintains the anchor point position during stop navigation
   * @param element Element to maintain position for
   */
  maintainAnchorPoint(element: Element): void {
    // Always force during stop navigation to maintain consistent positioning
    this.scrollToAnchor(element, 'smooth', true);
  }

  /**
   * Forces immediate scroll to top of page
   */
  scrollToTop(): void {
    this.performScroll(() => {
      try {
        if (this.bodyOsInstance) {
          this.executeOverlayScrollTop();
        } else {
          this.executeNativeScrollTop();
        }
      } catch (error) {
        console.error('Error in scrollToTop:', error);
        this.executeNativeScrollTop();
      }
    });
  }

  /**
   * Cleanup method to remove event listeners and clear timeouts
   */
  destroy(): void {
    window.removeEventListener('wheel', this.handleUserScroll);
    window.removeEventListener('touchmove', this.handleUserScroll);
    
    if (this.userScrollTimeout) {
      clearTimeout(this.userScrollTimeout);
    }
  }

  /**
   * Calculates responsive anchor point based on current screen width
   * @returns Adjusted anchor point value
   */
  private getResponsiveAnchorPoint(): number {
    const screenWidth = window.innerWidth;
    
    if (screenWidth <= ScrollService.RESPONSIVE_BREAKPOINTS.SMALL) {
      return ScrollService.BASE_ANCHOR_POINT + ScrollService.ANCHOR_ADJUSTMENTS.SMALL_SCREEN;
    }
    
    if (screenWidth <= ScrollService.RESPONSIVE_BREAKPOINTS.MEDIUM) {
      return ScrollService.BASE_ANCHOR_POINT + ScrollService.ANCHOR_ADJUSTMENTS.MEDIUM_SCREEN;
    }
    
    return ScrollService.BASE_ANCHOR_POINT;
  }

  /**
   * Handles user scroll events to prevent interrupting manual navigation
   */
  private handleUserScroll = (): void => {
    this.isUserScrolling = true;
    
    if (this.userScrollTimeout) {
      clearTimeout(this.userScrollTimeout);
    }
    
    // Reset user scrolling flag after timeout
    this.userScrollTimeout = setTimeout(() => {
      this.isUserScrolling = false;
    }, ScrollService.USER_SCROLL_TIMEOUT);
  };

  /**
   * Performs scroll operation with queue management to prevent conflicts
   * @param operation Scroll operation to execute
   */
  private performScroll(operation: () => void): void {
    if (this.isScrolling) {
      this.scrollQueue.push(operation);
      return;
    }
    
    this.isScrolling = true;
    
    // Ensure DOM is ready and measurements are stable
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!this.isUserScrolling) {
          operation();
        }
        
        this.scheduleScrollCleanup();
      });
    });
  }

  /**
   * Schedules cleanup after scroll animation completes
   */
  private scheduleScrollCleanup(): void {
    setTimeout(() => {
      this.isScrolling = false;
      this.processScrollQueue();
    }, ScrollService.SCROLL_ANIMATION_DURATION);
  }

  /**
   * Processes next operation in scroll queue if available
   */
  private processScrollQueue(): void {
    if (this.scrollQueue.length > 0 && !this.isUserScrolling) {
      const nextOperation = this.scrollQueue.shift();
      if (nextOperation) {
        this.performScroll(nextOperation);
      }
    }
  }

  /**
   * Calculates target scroll position based on element rect and anchor point
   * @param rect Element's bounding rectangle
   * @returns Target scroll position
   */
  private calculateTargetPosition(rect: DOMRect): number {
    const anchorPoint = this.getResponsiveAnchorPoint();
    
    if (this.bodyOsInstance) {
      const { viewport } = this.bodyOsInstance.elements();
      return (rect.top + (viewport?.scrollTop || 0)) - anchorPoint;
    }
    
    return (rect.top + window.scrollY) - anchorPoint;
  }

  /**
   * Executes scroll operation using available scrolling method
   * @param targetPosition Target scroll position
   * @param behavior Scroll behavior
   */
  private executeScroll(targetPosition: number, behavior: ScrollBehavior): void {
    // Safety check to prevent invalid scroll positions
    if (targetPosition < 0 || targetPosition > ScrollService.MAX_SCROLL_POSITION) {
      return;
    }

    if (this.bodyOsInstance) {
      this.executeOverlayScroll(targetPosition, behavior);
    } else {
      this.executeNativeScroll(targetPosition, behavior);
    }
  }

  /**
   * Executes scroll using OverlayScrollbars
   * @param targetPosition Target scroll position
   * @param behavior Scroll behavior
   */
  private executeOverlayScroll(targetPosition: number, behavior: ScrollBehavior): void {
    const { viewport } = this.bodyOsInstance!.elements();
    
    if (viewport && typeof viewport.scrollTo === 'function') {
      viewport.scrollTo({
        top: targetPosition,
        behavior
      });
    } else {
      this.executeNativeScroll(targetPosition, behavior);
    }
  }

  /**
   * Executes scroll using native browser API
   * @param targetPosition Target scroll position
   * @param behavior Scroll behavior
   */
  private executeNativeScroll(targetPosition: number, behavior: ScrollBehavior): void {
    window.scrollTo({
      top: targetPosition,
      behavior
    });
  }

  /**
   * Executes scroll to top using OverlayScrollbars
   */
  private executeOverlayScrollTop(): void {
    const { viewport } = this.bodyOsInstance!.elements();
    
    if (viewport && typeof viewport.scrollTo === 'function') {
      viewport.scrollTo(0, 0);
    } else {
      this.executeNativeScrollTop();
    }
  }

  /**
   * Executes scroll to top using native browser API
   */
  private executeNativeScrollTop(): void {
    window.scrollTo(0, 0);
  }

  /**
   * Emergency fallback to scroll to top instantly
   */
  private emergencyScrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
} 